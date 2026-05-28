import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChart } from "../context/ChartContext";
import { analyzePalm, comparePalms, fetchSaved, fetchPalmHistory, fetchPalmById } from "../services/api";
import { gatePalmImage, warmUpGate } from "../utils/palmGate";
import BottomNav from "../components/BottomNav";

// Resize an image File to max 800px on the long edge, output JPEG base64.
// Keeps the upload small + speeds up the Gemini call.
function resizeToBase64(file, maxDim = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Friendly UI copy for each rejection category Gemini can return.
const REJECT_INFO = {
  not_a_palm:     { icon: "🤔", title: "That's not a palm",        tip: "Please upload a clear photo of your open hand, palm facing the camera." },
  back_of_hand:   { icon: "🔄", title: "Wrong side of the hand",   tip: "Flip your hand so the PALM (not the back) faces the camera." },
  blurry:         { icon: "📸", title: "Photo is too blurry",      tip: "Hold steady and take a sharp, focused photo of your palm." },
  too_dark:       { icon: "💡", title: "Lighting is too dark",     tip: "Move into bright, even light so the lines on your palm are clearly visible." },
  too_far:        { icon: "🔍", title: "Palm is too far away",     tip: "Bring the camera closer — your palm should fill most of the frame." },
  cropped:        { icon: "✂️", title: "Palm is cropped",          tip: "Include your full palm — from wrist to fingertips — in the photo." },
  multiple_hands: { icon: "🖐️", title: "More than one hand",       tip: "Show just one open palm in the photo." },
  wrong_hand:     { icon: "🔁", title: "Wrong hand uploaded",      tip: "The photo shows your other hand. Please retake using the hand you selected." },
  obstructed:     { icon: "🚫", title: "Palm is blocked",          tip: "Open your hand flat — remove rings, mehndi, or anything covering the main lines." },
  default:        { icon: "📸", title: "Photo unreadable",         tip: "Please retake with a clear, well-lit photo of your open palm." },
};

const SCAN_MSGS = [
  "Detecting your palm…",
  "Tracing the life line…",
  "Reading the head line…",
  "Examining the heart line…",
  "Following your fate line…",
  "Weaving the reading together…",
];

// Detect whether to offer a "Take Photo" (camera) button alongside upload.
// We show camera only on devices that (a) report a video input AND (b) look
// touch-first (mobile/tablet) — laptops with webcams keep just the upload
// button since taking a palm selfie with a built-in webcam is awkward.
function useCameraSupport() {
  const [hasCamera, setHasCamera] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const isTouchFirst = window.matchMedia?.("(pointer: coarse)").matches
      || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if (!isTouchFirst || !navigator.mediaDevices?.enumerateDevices) {
      setHasCamera(false);
      return;
    }
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        if (cancelled) return;
        setHasCamera(devices.some(d => d.kind === "videoinput"));
      })
      .catch(() => setHasCamera(false));

    return () => { cancelled = true; };
  }, []);

  return hasCamera;
}

export default function PalmPage() {
  const navigate = useNavigate();
  const {
    form, palm, setPalm,
    palmPhoto, setPalmPhoto,
    palmAnalyzing, setPalmAnalyzing,
    palmClaimedHand, setPalmClaimedHand,
    palmComparison, setPalmComparison,
    palmOverloaded, setPalmOverloaded,
    palmLeftPhoto, setPalmLeftPhoto,
    palmRightPhoto, setPalmRightPhoto,
  } = useChart();
  // Local preview mirrors context.palmPhoto so the photo survives a navigation
  // away from /palm (e.g. user uploaded on the Palm Step page).
  const [preview, setPreview] = useState(palmPhoto || null);
  // Reflect a background analyze (started on PalmStepPage) as the scanning
  // state on mount, so opening /palm mid-analysis shows the scan animation.
  const [scanning, setScanning] = useState(palmAnalyzing);
  const [scanMsg, setScanMsg] = useState(SCAN_MSGS[0]);
  const [error, setError] = useState("");
  const [overloaded, setOverloaded] = useState(false);
  const [cooldown, setCooldown] = useState(0);  // seconds remaining before retry is allowed (shared with compare overload)
  // After the user clicks "Scan a Different Palm" we must NOT auto-restore the
  // saved reading from the DB — otherwise the upload screen never shows.
  const [rescan, setRescan] = useState(false);
  const [history, setHistory] = useState([]);
  // Lazy-load the MediaPipe model in the background as soon as the page mounts.
  useEffect(() => { warmUpGate(); }, []);
  // Which hand the user just tapped on the upload screen. Falls back to
  // the context value so a scan kicked off on PalmStepPage still shows
  // the badge when the user opens /palm mid-flight.
  const [claimedHand, setClaimedHand] = useState(palmClaimedHand);   // "Left" | "Right" | null
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const hasCamera = useCameraSupport();

  // Try to load a previously-saved palm reading on mount. Skipped during
  // rescan, and while a fresh background analysis is in flight (otherwise
  // we'd briefly show a stale prior reading and then swap to the new one).
  useEffect(() => {
    if (palm || palmComparison || rescan || palmAnalyzing) return;
    fetchSaved("palm", form)
      .then((saved) => {
        if (saved) {
          if (saved.handType === "Both") {
            setPalmComparison(saved);
          } else {
            setPalm(saved);
          }
        }
      })
      .catch(() => {});
  }, [form, palm, palmComparison, rescan, palmAnalyzing, setPalm, setPalmComparison]);

  // Mirror the background-analyze flag into the local scanning state +
  // rotating message ticker, so the existing scan UI works for analyses
  // that were kicked off on another screen.
  useEffect(() => {
    if (!palmAnalyzing) {
      setScanning(false);
      return;
    }
    setScanning(true);
    let i = 0;
    setScanMsg(SCAN_MSGS[0]);
    const iv = setInterval(() => { i++; setScanMsg(SCAN_MSGS[i % SCAN_MSGS.length]); }, 1800);
    return () => clearInterval(iv);
  }, [palmAnalyzing]);

  // Load history list — used to show "Past Readings" on the rescan screen.
  useEffect(() => {
    fetchPalmHistory(form).then(setHistory).catch(() => {});
  }, [form, palm]);

  // Cooldown tick — disables the retry button so users can't spam Pro
  // while it's overloaded.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Compare-flow overload: when palmOverloaded flips on (from the Both-Hands
  // Pro call returning 502), arm the shared cooldown so the retry button is
  // disabled for 50s. Reuses the same `cooldown` state as the single-hand
  // overload card.
  useEffect(() => {
    if (palmOverloaded && cooldown === 0) setCooldown(50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palmOverloaded]);

  async function loadPast(id) {
    try {
      const past = await fetchPalmById(id, form);
      if (past) {
        if (past.handType === "Both") {
          setPalmComparison(past);
          setPalm(null);
        } else {
          setPalm(past);
          setPalmComparison(null);
        }
        setPreview(null); // no photo for historical readings
        setRescan(false);
      }
    } catch (err) {
      setError("Couldn't load that reading.");
    }
  }

  async function runAnalyze(dataUrl, hand) {
    setError("");
    setOverloaded(false);
    setPreview(dataUrl);
    setPalmPhoto(dataUrl);
    setScanning(true);
    let i = 0;
    setScanMsg(SCAN_MSGS[0]);
    const iv = setInterval(() => { i++; setScanMsg(SCAN_MSGS[i % SCAN_MSGS.length]); }, 1800);
    try {
      // hand falls back to claimedHand state for the retry-with-same-photo path.
      const result = await analyzePalm(dataUrl, form, hand ?? claimedHand);
      setPalm(result);
      setRescan(false);
    } catch (err) {
      if (err.code === 'AI_OVERLOADED') {
        setOverloaded(true);
        setCooldown(50);   // disable retry button for 50s
      } else setError(err.message);
    } finally {
      clearInterval(iv);
      setScanning(false);
    }
  }

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      // Client-side gate first — rejected photos never hit the API.
      // Passing claimedHand lets MediaPipe catch obvious wrong-hand mistakes.
      const gateResult = await gatePalmImage(file, claimedHand);
      if (!gateResult.ok) {
        setError(gateResult.retakeReason);
        return;
      }
      const dataUrl = await resizeToBase64(file);
      await runAnalyze(dataUrl, claimedHand);
    } catch (err) {
      setError("Could not read the image — try a different photo.");
    }
  }

  // Hand tap on the upload screen — record the claim, then open the picker.
  // We always use the plain file input; mobile browsers natively show a
  // camera/gallery chooser, desktop opens the file dialog.
  function pickForHand(hand) {
    setError("");
    setClaimedHand(hand);
    setPalmClaimedHand(hand);   // share with context for cross-screen badge
    fileRef.current?.click();
  }

  function retry() {
    if (preview) runAnalyze(preview);
  }

  function reset() {
    setPalm(null);
    setPreview(null);
    setPalmPhoto(null);
    setPalmAnalyzing(false);
    setClaimedHand(null);
    setPalmClaimedHand(null);
    setError("");
    setRescan(true);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  const unusable = palm?.imageQuality === "unusable";

  // Both-Hands comparison view replaces the single-hand UI entirely. Four
  // states: still analyzing (scan animation), Pro overloaded (cooldown
  // card), either hand unusable (per-hand retake card), or ready.
  const inCompareMode =
    !!palmComparison
    || (palmAnalyzing && palmLeftPhoto && palmRightPhoto)
    || (palmOverloaded && palmLeftPhoto && palmRightPhoto);
  if (inCompareMode) {
    const c = palmComparison?.comparison;
    const leftBad  = palmComparison?.left?.imageQuality  === "unusable";
    const rightBad = palmComparison?.right?.imageQuality === "unusable";
    const eitherBad = leftBad || rightBad;

    function resetCompare() {
      setPalmComparison(null);
      setPalmLeftPhoto(null);
      setPalmRightPhoto(null);
      setPalmAnalyzing(false);
      setPalmOverloaded(false);
      navigate("/palm-compare");
    }

    // Retry the Both-Hands Pro call with the same two photos (still cached
    // in palmLeftPhoto / palmRightPhoto). Disabled while the cooldown is
    // still ticking down — see compareCooldown below.
    function retryCompare() {
      setPalmOverloaded(false);
      setPalmAnalyzing(true);
      comparePalms(palmLeftPhoto, palmRightPhoto, form)
        .then((result) => setPalmComparison(result))
        .catch((err) => {
          if (err?.code === 'AI_OVERLOADED') setPalmOverloaded(true);
        })
        .finally(() => setPalmAnalyzing(false));
    }

    const cardStyle = { borderColor: "rgba(168,85,247,0.35)" };
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem 7.5rem", position: "relative" }}>
        <div className="cosmos"></div>
        <div className="stars"></div>

        <button onClick={() => navigate("/", { state: { edit: true } })} style={{
          fontSize: 12, padding: "8px 16px", borderRadius: 8, cursor: "pointer", color: "#a5b4fc",
          border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", marginBottom: 20 }}>
          ← New Reading
        </button>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: "#a855f7", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>
            {form.name || "Your"} · Full Life Comparison
          </p>
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
            🔒 Your photos are analyzed and discarded — never stored.
          </p>
        </div>

        {/* Both photos, side by side */}
        {(palmLeftPhoto || palmRightPhoto) && (
          <div className="cosmic-card" style={cardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["Potential", palmLeftPhoto, "Left"],
                ["Reality",   palmRightPhoto, "Right"],
              ].map(([label, src, hand]) => (
                <div key={hand} style={{
                  borderRadius: 12, overflow: "hidden",
                  border: "1px solid rgba(168,85,247,0.3)",
                  background: "rgba(15,14,32,0.6)",
                }}>
                  <div style={{ aspectRatio: "3 / 4", background: "#0f0e20" }}>
                    {src ? (
                      <img src={src} alt={`${hand} palm`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : null}
                  </div>
                  <div style={{ padding: "8px 10px", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 11, color: "#c4b5fd", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>{hand}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scan / overloaded / unusable / ready */}
        {palmAnalyzing && !palmComparison && (
          <div className="cosmic-card" style={{ ...cardStyle, textAlign: "center" }}>
            {palmLeftPhoto && palmRightPhoto ? (
              <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 16 }}>
                {[palmLeftPhoto, palmRightPhoto].map((src, idx) => (
                  <div key={idx} style={{
                    position: "relative", width: 100, height: 133, borderRadius: 12, overflow: "hidden",
                    border: "1px solid rgba(168,85,247,0.4)", boxShadow: "0 0 15px rgba(168,85,247,0.2)"
                  }}>
                    <img src={src} alt="scanning palm" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{
                      position: "absolute", left: 0, right: 0, top: 0, height: 2,
                      background: "#c084fc", boxShadow: "0 0 8px #c084fc",
                      animation: "palmScan 1.8s ease-in-out infinite"
                    }} />
                  </div>
                ))}
              </div>
            ) : null}
            <p style={{ fontSize: 14, fontWeight: 600, color: "#c084fc", margin: 0 }}>{scanMsg}</p>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
              Comparing the two hands — usually 20–45 seconds.
            </p>
          </div>
        )}

        {palmOverloaded && !palmAnalyzing && !palmComparison && (
          <div className="cosmic-card" style={{ textAlign: "center", borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
            <p style={{ color: "#fbbf24", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>AI is busy right now</p>
            <p style={{ color: "#cbd5e1", fontSize: 12.5, margin: "0 0 16px", lineHeight: 1.6 }}>
              Our reader couldn't compare your palms after several tries.
              {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
            </p>
            <button
              onClick={retryCompare}
              disabled={cooldown > 0}
              className="magic-btn"
              style={{ width: "100%", opacity: cooldown > 0 ? 0.5 : 1, cursor: cooldown > 0 ? "not-allowed" : "pointer" }}
            >
              {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again"}
            </button>
          </div>
        )}

        {palmComparison && eitherBad && (() => {
          // Pull the specific reject reason + tip for each failed hand so
          // the user knows *exactly* what to fix (wrong_hand vs blurry vs
          // too_dark etc.) instead of a generic lighting prompt.
          const badHands = [
            leftBad  ? { side: "Left",  info: REJECT_INFO[palmComparison.left.rejectReason]  || REJECT_INFO.default, server: palmComparison.left.retakeReason  } : null,
            rightBad ? { side: "Right", info: REJECT_INFO[palmComparison.right.rejectReason] || REJECT_INFO.default, server: palmComparison.right.retakeReason } : null,
          ].filter(Boolean);

          return (
            <div className="cosmic-card" style={{ borderColor: "rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.06)" }}>
              <p style={{ color: "#f87171", fontSize: 15, fontWeight: 700, margin: "0 0 14px", textAlign: "center" }}>
                {badHands.length === 2 ? "Both photos need a retake" : `${badHands[0].side} photo needs a retake`}
              </p>

              <div style={{ display: "grid", gap: 12 }}>
                {badHands.map(({ side, info, server }) => (
                  <div key={side} style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "12px 14px", borderRadius: 10,
                    border: "1px solid rgba(248,113,113,0.35)",
                    background: "rgba(15,14,32,0.55)",
                  }}>
                    <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{info.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#fbbf24", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>
                        {side} Hand
                      </p>
                      <p style={{ margin: "4px 0 4px", fontSize: 14, fontWeight: 700, color: "#f87171" }}>
                        {info.title}
                      </p>
                      <p style={{ margin: 0, fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.55 }}>
                        {server || info.tip}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={resetCompare} className="magic-btn" style={{ width: "100%", marginTop: 14 }}>
                📷 Retake Both Photos
              </button>
            </div>
          );
        })()}

        {c && !eitherBad && (
          <div style={{ animation: "slideUp 0.8s ease-out" }}>
            {/* Evolution headline */}
            <div style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(168,85,247,0.2) 100%)",
              border: "1px solid rgba(168,85,247,0.3)",
              borderRadius: 20, padding: "clamp(1.25rem, 5vw, 2rem)", marginBottom: 24,
              boxShadow: "0 0 30px rgba(168,85,247,0.15)", textAlign: "center",
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#a855f7", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 3 }}>
                Alignment · {c.alignment || "—"}
              </p>
              <p style={{ fontSize: "clamp(15px, 4.2vw, 19px)", fontWeight: 600, color: "#fff", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
                "{c.evolution}"
              </p>
            </div>

            {/* Per-line gap analysis */}
            <div style={{ display: "grid", gap: 16 }}>
              {[
                ["Life Line",  "🌿", c.lifeLine],
                ["Head Line",  "🧠", c.headLine],
                ["Heart Line", "💛", c.heartLine],
                ["Fate Line",  "🪐", c.fateLine],
              ].map(([title, icon, content]) => content && (
                <div key={title} className="cosmic-card" style={{ margin: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 22 }}>{icon}</span>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#fff", letterSpacing: 0.5 }}>{title}</p>
                  </div>
                  <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.7 }}>{content}</p>
                </div>
              ))}
            </div>

            {/* Grown / Watch */}
            <div className="grid-2" style={{ margin: "20px 0" }}>
              {c.grownStronger?.length > 0 && (
                <div className="cosmic-card" style={{ margin: 0, borderColor: "rgba(34,197,94,0.2)", background: "rgba(20,30,20,0.4)" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#4ade80", marginBottom: 14 }}>✦ Grown Stronger</p>
                  {c.grownStronger.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13.5, color: "#94a3b8", lineHeight: 1.5 }}>
                      <span style={{ color: "#4ade80", fontWeight: 700 }}>↑</span><span>{s}</span>
                    </div>
                  ))}
                </div>
              )}
              {c.watchPoints?.length > 0 && (
                <div className="cosmic-card" style={{ margin: 0, borderColor: "rgba(251,191,36,0.2)", background: "rgba(30,25,20,0.4)" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#fbbf24", marginBottom: 14 }}>✦ Still Showing Up</p>
                  {c.watchPoints.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13.5, color: "#94a3b8", lineHeight: 1.5 }}>
                      <span style={{ color: "#fbbf24", fontWeight: 700 }}>•</span><span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {c.lifeAdvice && (
              <div className="cosmic-card" style={{ borderColor: "rgba(168,85,247,0.25)", background: "rgba(30,20,45,0.5)" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#c084fc", margin: "0 0 10px" }}>🎯 Direction</p>
                <p style={{ fontSize: 13.5, color: "#e2e8f0", margin: 0, lineHeight: 1.7 }}>{c.lifeAdvice}</p>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button onClick={resetCompare} style={{
                width: "100%", padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: "pointer", color: "#c084fc",
                border: "1px solid rgba(168,85,247,0.4)", background: "rgba(168,85,247,0.12)" }}>
                🔄 Re-do Comparison
              </button>

              <button onClick={() => {
                 setPalmComparison(null);
                 setPalmLeftPhoto(null);
                 setPalmRightPhoto(null);
                 setPalmAnalyzing(false);
                 setPalmOverloaded(false);
                 reset();
                 navigate("/palm");
               }} style={{
                 width: "100%", padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                 cursor: "pointer", color: "#94a3b8",
                 border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                 🖐️ Scan Different Hand
               </button>
            </div>

            <p style={{ fontSize: 11, color: "#444", textAlign: "center", marginTop: 32, lineHeight: 1.8, maxWidth: 500, margin: "32px auto 0" }}>
              Palmistry is a tool for self-reflection. Insights here are interpretive, not predictive.
            </p>
          </div>
        )}

        <BottomNav activeKey="palm" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem 7.5rem", position: "relative" }}>
      <div className="cosmos"></div>
      <div className="stars"></div>

      <button onClick={() => navigate("/")} style={{
        fontSize: 12, padding: "8px 16px", borderRadius: 8, cursor: "pointer", color: "#a5b4fc",
        border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", marginBottom: 20 }}>
        ← New Reading
      </button>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: "#6366f1", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>
          {form.name || "Your"} Palm Reading
        </p>
        <p style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
          🔒 Your photo is analyzed and discarded — never stored.
        </p>
      </div>

      {error && (
        <div className="cosmic-card" style={{ borderColor: "#ef4444", background: "rgba(239, 68, 68, 0.08)", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⚠️</div>
          <p style={{ color: "#f87171", fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>Something went wrong</p>
          <p style={{ color: "#cbd5e1", fontSize: 12.5, margin: "0 0 12px", lineHeight: 1.6 }}>{error}</p>
          <button onClick={() => setError("")} style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            color: "#fca5a5", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)" }}>
            Dismiss
          </button>
        </div>
      )}

      {overloaded && !palm && (
        <div className="cosmic-card" style={{ textAlign: "center", borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
          <p style={{ color: "#fbbf24", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>AI is busy right now</p>
          <p style={{ color: "#cbd5e1", fontSize: 12.5, margin: "0 0 16px", lineHeight: 1.6 }}>
            Our reader couldn't analyze your palm after several tries.
            {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
          </p>
          {preview ? (
            <button onClick={retry} disabled={cooldown > 0} className="magic-btn" style={{ width: "100%", opacity: cooldown > 0 ? 0.5 : 1, cursor: cooldown > 0 ? "not-allowed" : "pointer" }}>
              {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again with Same Photo"}
            </button>
          ) : (
            <button onClick={() => setOverloaded(false)} disabled={cooldown > 0} className="magic-btn" style={{ width: "100%", opacity: cooldown > 0 ? 0.5 : 1, cursor: cooldown > 0 ? "not-allowed" : "pointer" }}>
              {cooldown > 0 ? `🕒 Wait ${cooldown}s` : "Upload a New Photo"}
            </button>
          )}
        </div>
      )}

      {/* Past readings — appears above upload when there's history */}
      {!palm && !scanning && history.length > 0 && (
        <div className="cosmic-card">
          <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 4px" }}>📂 Your Past Readings</p>
          <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 14px" }}>Tap to view — no AI re-run.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {history.map(h => {
              const d = new Date(h.createdAt);
              const when = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
              const bad = h.imageQuality === "unusable";
              return (
                <button key={h.id} onClick={() => loadPast(h.id)} disabled={bad} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap",
                  padding: "10px 14px", borderRadius: 10, cursor: bad ? "not-allowed" : "pointer",
                  border: "1px solid rgba(168,85,247,0.25)", background: "rgba(168,85,247,0.06)",
                  color: bad ? "#475569" : "#e2e8f0", textAlign: "left", opacity: bad ? 0.6 : 1,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0 }}>
                    🖐️ {h.handType || "Unclear"} Hand
                    {bad && <span style={{ fontSize: 10, color: "#f87171", marginLeft: 8 }}>· unreadable</span>}
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>{when}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload / scanning view */}
      {!palm && (
        <div className="cosmic-card" style={{ textAlign: "center", padding: "2rem 1.25rem" }}>
          {!preview && !scanning && (
            <>
              <div className="astrology-icon" style={{ fontSize: 56, marginBottom: 12 }}>🖐️</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>Scan Your Palm</p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 20px", lineHeight: 1.6 }}>
                Pick which hand you're uploading. We'll check the photo matches the hand you choose.
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                <button
                  onClick={() => pickForHand("Right")}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", borderRadius: 12,
                    border: "1px solid rgba(168,85,247,0.35)",
                    background: "rgba(168,85,247,0.08)",
                    cursor: "pointer", color: "#fff", textAlign: "left", width: "100%",
                  }}
                >
                  <span style={{ fontSize: 26, width: 32, textAlign: "center" }}>✋</span>
                  <span style={{ flex: 1 }}>
                    <strong style={{ display: "block", fontSize: 14 }}>Right Hand</strong>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      {hasCamera ? "Tap to take or pick a photo" : "Upload a clear photo of your right palm"}
                    </span>
                  </span>
                  <span style={{ fontSize: 22, color: "#a855f7" }}>›</span>
                </button>
                <button
                  onClick={() => pickForHand("Left")}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", borderRadius: 12,
                    border: "1px solid rgba(168,85,247,0.35)",
                    background: "rgba(168,85,247,0.08)",
                    cursor: "pointer", color: "#fff", textAlign: "left", width: "100%",
                  }}
                >
                  <span style={{ fontSize: 26, width: 32, textAlign: "center" }}>🤚</span>
                  <span style={{ flex: 1 }}>
                    <strong style={{ display: "block", fontSize: 14 }}>Left Hand</strong>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      {hasCamera ? "Tap to take or pick a photo" : "Upload a clear photo of your left palm"}
                    </span>
                  </span>
                  <span style={{ fontSize: 22, color: "#a855f7" }}>›</span>
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPick}
                style={{ display: "none" }}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPick}
                style={{ display: "none" }}
              />

              {/* Premium upsell — both-hands "Full Life Comparison". */}
              <button onClick={() => navigate("/palm-compare")} style={{
                marginTop: 14, width: "100%", padding: "10px 12px", borderRadius: 10,
                fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "#c4b5fd",
                border: "1px solid rgba(192,132,252,0.4)",
                background: "linear-gradient(135deg, rgba(168,85,247,0.10), rgba(99,102,241,0.10))",
              }}>
                ✋🤚 Compare Both Hands · Full Life Reading →
              </button>
            </>
          )}

          {preview && scanning && (
            <>
              {claimedHand && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  margin: "0 auto 12px", padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(168,85,247,0.5)",
                  background: "rgba(168,85,247,0.12)",
                  color: "#c4b5fd", fontSize: 12, fontWeight: 700,
                  letterSpacing: 1.5, textTransform: "uppercase",
                }}>
                  <span style={{ fontSize: 14 }}>{claimedHand === "Right" ? "✋" : "🤚"}</span>
                  {claimedHand} Hand
                </div>
              )}
              <div style={{
                position: "relative", width: "100%", maxWidth: 320, margin: "0 auto 18px",
                borderRadius: 16, overflow: "hidden",
                border: "1px solid rgba(168,85,247,0.4)",
                boxShadow: "0 0 30px rgba(168,85,247,0.25)",
              }}>
                <img src={preview} alt="palm" style={{ width: "100%", display: "block" }} />
                {/* sweeping scan line */}
                <div style={{
                  position: "absolute", left: 0, right: 0, top: 0, height: 3,
                  background: "linear-gradient(90deg, transparent, #c084fc, transparent)",
                  boxShadow: "0 0 18px 4px rgba(192,132,252,0.6)",
                  animation: "palmScan 1.8s ease-in-out infinite",
                }} />
                {/* dotted overlay */}
                <div style={{
                  position: "absolute", inset: 0,
                  backgroundImage: "radial-gradient(rgba(168,85,247,0.18) 1px, transparent 1px)",
                  backgroundSize: "14px 14px",
                  mixBlendMode: "screen",
                }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#c084fc", margin: 0 }}>{scanMsg}</p>
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>This usually takes 10–30 seconds.</p>
              <style>{`@keyframes palmScan { 0%{top:0} 50%{top:calc(100% - 3px)} 100%{top:0} }`}</style>
            </>
          )}
        </div>
      )}

      {/* Reading view */}
      {palm && !unusable && (
        <div style={{ animation: "slideUp 0.8s ease-out" }}>
          {/* Clean photo header — no overlay (Gemini's spatial accuracy isn't reliable). */}
          {preview && (
            <div className="cosmic-card" style={{ padding: 14, textAlign: "center" }}>
              {palm.handType && palm.handType !== "Unclear" && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  margin: "0 auto 12px", padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(168,85,247,0.5)",
                  background: "rgba(168,85,247,0.12)",
                  color: "#c4b5fd", fontSize: 12, fontWeight: 700,
                  letterSpacing: 1.5, textTransform: "uppercase",
                }}>
                  <span style={{ fontSize: 14 }}>{palm.handType === "Right" ? "✋" : "🤚"}</span>
                  {palm.handType} Hand
                </div>
              )}
              <div style={{ width: "100%", maxWidth: 320, margin: "0 auto", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(168,85,247,0.3)" }}>
                <img src={preview} alt="palm" style={{ width: "100%", display: "block" }} />
              </div>
            </div>
          )}

          <div style={{
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            borderRadius: 20, padding: "clamp(1.25rem, 5vw, 2rem)", marginBottom: 24,
            boxShadow: "0 0 30px rgba(168, 85, 247, 0.15)", textAlign: "center",
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#a855f7", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "3px" }}>
              {palm.handType} Hand · {palm.imageQuality}
            </p>
            <p style={{ fontSize: "clamp(15px, 4.2vw, 19px)", fontWeight: 600, color: "#fff", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
              "{palm.overallVibe}"
            </p>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {[
              ["Life Line", "🌿", palm.lifeLine],
              ["Head Line", "🧠", palm.headLine],
              ["Heart Line", "💛", palm.heartLine],
              ["Fate Line", "🪐", palm.fateLine],
              ["Mount of Venus", "✨", palm.mountOfVenus],
              ["Marriage Lines", "💍", palm.marriageLines],
            ].map(([title, icon, content]) => content && (
              <div key={title} className="cosmic-card" style={{ margin: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#fff", letterSpacing: "0.5px" }}>{title}</p>
                </div>
                <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.7 }}>{content}</p>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ margin: "20px 0" }}>
            {palm.strengths?.length > 0 && (
              <div className="cosmic-card" style={{ margin: 0, borderColor: "rgba(34, 197, 94, 0.2)", background: "rgba(20, 30, 20, 0.4)" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#4ade80", marginBottom: 14 }}>✦ Strengths</p>
                {palm.strengths.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13.5, color: "#94a3b8", lineHeight: 1.5 }}>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>✓</span><span>{s}</span>
                  </div>
                ))}
              </div>
            )}
            {palm.watchOuts?.length > 0 && (
              <div className="cosmic-card" style={{ margin: 0, borderColor: "rgba(251, 191, 36, 0.2)", background: "rgba(30, 25, 20, 0.4)" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#fbbf24", marginBottom: 14 }}>✦ Watch For</p>
                {palm.watchOuts.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13.5, color: "#94a3b8", lineHeight: 1.5 }}>
                    <span style={{ color: "#fbbf24", fontWeight: 700 }}>↑</span><span>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {palm.practicalGuidance && (palm.practicalGuidance.career || palm.practicalGuidance.love) && (
            <div className="cosmic-card" style={{ borderColor: "rgba(168,85,247,0.25)", background: "rgba(30,20,45,0.5)" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#c084fc", margin: "0 0 4px" }}>🎯 Practical Guidance</p>
              <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 14px" }}>Concrete next steps from your Fate and Heart lines</p>
              <div style={{ display: "grid", gap: 12 }}>
                {palm.practicalGuidance.career && (
                  <div style={{ padding: "12px 14px", background: "rgba(251,191,36,0.08)", borderRadius: 10, borderLeft: "3px solid #fbbf24" }}>
                    <p style={{ fontSize: 10, color: "#fbbf24", margin: "0 0 4px", letterSpacing: "1.5px", fontWeight: 700 }}>CAREER</p>
                    <p style={{ fontSize: 13, color: "#e2e8f0", margin: 0, lineHeight: 1.65 }}>{palm.practicalGuidance.career}</p>
                  </div>
                )}
                {palm.practicalGuidance.love && (
                  <div style={{ padding: "12px 14px", background: "rgba(248,113,113,0.08)", borderRadius: 10, borderLeft: "3px solid #f87171" }}>
                    <p style={{ fontSize: 10, color: "#f87171", margin: "0 0 4px", letterSpacing: "1.5px", fontWeight: 700 }}>LOVE</p>
                    <p style={{ fontSize: 13, color: "#e2e8f0", margin: 0, lineHeight: 1.65 }}>{palm.practicalGuidance.love}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {palm.palmistryNotes?.length > 0 && (
            <div className="cosmic-card" style={{ borderColor: "rgba(99,102,241,0.25)", background: "rgba(20,22,40,0.5)" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#a5b4fc", margin: "0 0 4px" }}>📜 Classical Palmistry Notes</p>
              <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 14px" }}>Traditional rules cross-checked against your reading</p>
              <div style={{ display: "grid", gap: 8 }}>
                {palm.palmistryNotes.map((n, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "#cbd5e1", lineHeight: 1.55, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, borderLeft: "3px solid #6366f1" }}>
                    <span style={{ color: "#a5b4fc", fontWeight: 700 }}>✓</span><span>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={reset} style={{
            width: "100%", padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: "pointer", color: "#c084fc",
            border: "1px solid rgba(168,85,247,0.4)", background: "rgba(168,85,247,0.12)" }}>
            🔄 Scan a Different Palm
          </button>

          <p style={{ fontSize: 11, color: "#444", textAlign: "center", marginTop: 32, lineHeight: 1.8, maxWidth: 500, margin: "32px auto 0" }}>
            Palmistry is a tool for self-reflection. Insights here are interpretive, not predictive.
          </p>
        </div>
      )}

      {/* Unusable image — categorized retake message */}
      {palm && unusable && (() => {
        const info = REJECT_INFO[palm.rejectReason] || REJECT_INFO.default;
        return (
          <div className="cosmic-card" style={{ textAlign: "center", padding: "2rem 1.5rem", borderColor: "rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.06)" }}>
            {preview && (
              <div style={{
                width: 140, height: 140, margin: "0 auto 16px",
                borderRadius: 12, overflow: "hidden",
                border: "1px solid rgba(248,113,113,0.45)",
                boxShadow: "0 0 18px rgba(248,113,113,0.2)",
              }}>
                <img src={preview} alt="uploaded palm" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            )}
            <div style={{ fontSize: 44, marginBottom: 12 }}>{info.icon}</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#f87171", margin: "0 0 8px" }}>{info.title}</p>
            <p style={{ fontSize: 13.5, color: "#cbd5e1", margin: "0 0 6px", lineHeight: 1.65 }}>
              {info.tip}
            </p>
            {palm.retakeReason && (
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 18px", lineHeight: 1.6, fontStyle: "italic" }}>
                {palm.retakeReason}
              </p>
            )}
            <button onClick={reset} className="magic-btn" style={{ width: "100%" }}>
              📷 Upload Another Photo
            </button>
          </div>
        );
      })()}

      <BottomNav activeKey="palm" />
    </div>
  );
}
