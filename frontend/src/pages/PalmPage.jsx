import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChart } from "../context/ChartContext";
import { analyzePalm, comparePalms, fetchSaved, fetchPalmHistory, fetchPalmById } from "../services/api";
import { gatePalmImage, warmUpGate, ensureGate } from "../utils/palmGate";
import BottomNav from "../components/BottomNav";
import PalmSkeletonOverlay from "../components/PalmSkeletonOverlay";
import Card from "@/common/Card";
import Button from "@/common/Button";
import { useCosts } from "@/common/useCosts";
import { useCredits } from "@/common/useCredits";
import LowCreditsCard from "@/common/LowCreditsCard";

// Resize an image File to max 800px on the long edge, output JPEG base64.
// Keeps the upload small + speeds up the Gemini call.
function resizeToBase64(file, maxDim = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
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

// We wait for the gate MODEL to load (one-time TFJS download) before scanning,
// so the gate reliably produces the hand landmarks the biometric match needs —
// rather than racing a timeout that would drop them. The load gets a generous
// budget; the gate inference itself is fast once the model is ready. Only a
// genuine load failure (beyond MODEL_READY_TIMEOUT_MS) falls back to the
// backend gate (no landmarks).
const MODEL_READY_TIMEOUT_MS = 25000; // one-time model download
const GATE_INFER_TIMEOUT_MS = 8000; // per-photo inference (model already warm)

// Resolve `promise`, or reject with a timeout error after `ms`.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("gate timeout")), ms)),
  ]);
}

import { EMOJIS } from "@/utils/emojis";

// Friendly UI copy for each rejection category Gemini can return.
const REJECT_INFO = {
  not_a_palm: {
    icon: EMOJIS.PUZZLE,
    title: "That's not a palm",
    tip: "Please upload a clear photo of your open hand, palm facing the camera.",
  },
  screen_photo: {
    icon: EMOJIS.PROHIBITED,
    title: "Don't photograph a screen",
    tip: "Take a photo of your real hand with the camera — pictures of a screen, monitor, or another photo can't be read.",
  },
  back_of_hand: {
    icon: EMOJIS.REFRESH,
    title: "Wrong side of the hand",
    tip: "Flip your hand so the PALM (not the back) faces the camera.",
  },
  blurry: {
    icon: EMOJIS.CAMERA,
    title: "Photo is too blurry",
    tip: "Hold steady and take a sharp, focused photo of your palm.",
  },
  too_dark: {
    icon: EMOJIS.LIGHT_BULB,
    title: "Lighting is too dark",
    tip: "Move into bright, even light so the lines on your palm are clearly visible.",
  },
  too_far: {
    icon: EMOJIS.MAGNIFIER,
    title: "Palm is too far away",
    tip: "Bring the camera closer — your palm should fill most of the frame.",
  },
  cropped: {
    icon: EMOJIS.SCISSORS,
    title: "Palm is cropped",
    tip: "Include your full palm — from wrist to fingertips — in the photo.",
  },
  multiple_hands: {
    icon: EMOJIS.HAND_OPEN,
    title: "More than one hand",
    tip: "Show just one open palm in the photo.",
  },
  wrong_hand: {
    icon: EMOJIS.REPEAT,
    title: "Wrong hand uploaded",
    tip: "The photo shows your other hand. Please retake using the hand you selected.",
  },
  obstructed: {
    icon: EMOJIS.PROHIBITED,
    title: "Palm is blocked",
    tip: "Open your hand flat — remove rings, mehndi, or anything covering the main lines.",
  },
  lines_faint: {
    icon: EMOJIS.MAGNIFIER,
    title: "Palm lines too faint",
    tip: "Take a sharp photo of your real hand in bright light so the fine lines stand out — a photo of a screen or another picture won't have enough detail.",
  },
  uneven_light: {
    icon: EMOJIS.LIGHT_BULB,
    title: "Lighting is uneven",
    tip: "Even out the lighting — avoid harsh shadow or glare falling across your palm.",
  },
  default: {
    icon: EMOJIS.CAMERA,
    title: "Photo unreadable",
    tip: "Please retake with a clear, well-lit photo of your open palm.",
  },
};

const SCAN_MSGS = [
  "Detecting your palm…",
  "Tracing the life line…",
  "Reading the head line…",
  "Examining the heart line…",
  "Following your fate line…",
  "Weaving the reading together…",
];

// Shared presentation classes (kept DRY across the compare + single-hand views).
const BLUEPRINT =
  "mb-6 rounded-[20px] border border-[rgba(168,85,247,0.3)] bg-[linear-gradient(135deg,rgba(99,102,241,0.2)_0%,rgba(168,85,247,0.2)_100%)] p-[clamp(1.25rem,5vw,2rem)] text-center shadow-[0_0_30px_rgba(168,85,247,0.15)]";
const BLUEPRINT_KICKER = "mx-0 mt-0 mb-1.5 text-xs font-bold tracking-[3px] text-[#a855f7] uppercase";
const BLUEPRINT_QUOTE = "m-0 text-[clamp(15px,4.2vw,19px)] font-semibold leading-[1.6] text-ink italic";
const LINE_TITLE = "m-0 text-[15px] font-bold tracking-[0.5px] text-ink";
const BULLET_ROW = "mb-2 flex gap-2.5 text-[13.5px] leading-[1.5] text-dim";
const DISCLAIMER = "mx-auto mt-8 mb-0 max-w-125 text-center text-[11px] leading-[1.8] text-[#444]";

// Detect whether to offer a "Take Photo" (camera) button alongside upload.
// We show camera only on devices that (a) report a video input AND (b) look
// touch-first (mobile/tablet) — laptops with webcams keep just the upload
// button since taking a palm selfie with a built-in webcam is awkward.
function useCameraSupport() {
  const [hasCamera, setHasCamera] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const isTouchFirst =
      window.matchMedia?.("(pointer: coarse)").matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if (!isTouchFirst || !navigator.mediaDevices?.enumerateDevices) {
      setHasCamera(false);
      return;
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) return;
        setHasCamera(devices.some((d) => d.kind === "videoinput"));
      })
      .catch(() => setHasCamera(false));

    return () => {
      cancelled = true;
    };
  }, []);

  return hasCamera;
}

export default function PalmPage() {
  const navigate = useNavigate();
  const costs = useCosts();
  const palmCost = costs?.palm ?? 30;
  const credits = useCredits();
  const {
    form,
    palm,
    setPalm,
    palmPhoto,
    setPalmPhoto,
    palmAnalyzing,
    setPalmAnalyzing,
    palmClaimedHand,
    setPalmClaimedHand,
    palmLandmarks,
    setPalmLandmarks,
    palmComparison,
    setPalmComparison,
    palmOverloaded,
    setPalmOverloaded,
    palmLowCredits,
    setPalmLowCredits,
    palmLeftPhoto,
    setPalmLeftPhoto,
    palmRightPhoto,
    setPalmRightPhoto,
  } = useChart();
  // Local preview mirrors context.palmPhoto so the photo survives a navigation
  // away from /palm (e.g. user uploaded on the Palm Step page).
  const [preview, setPreview] = useState(palmPhoto || null);
  // Reflect a background analyze (started on PalmStepPage) as the scanning
  // state on mount, so opening /palm mid-analysis shows the scan animation.
  const [scanning, setScanning] = useState(palmAnalyzing);
  const [scanMsg, setScanMsg] = useState(SCAN_MSGS[0]);
  const [error, setError] = useState("");
  // Set when a palm action is rejected for INSUFFICIENT_CREDITS — drives the
  // prominent "not enough credits" card instead of a tiny red line.
  const [lowCredits, setLowCredits] = useState(false);
  const [overloaded, setOverloaded] = useState(false);
  const [cooldown, setCooldown] = useState(0); // seconds remaining before retry is allowed (shared with compare overload)
  // After the user clicks "Scan a Different Palm" we must NOT auto-restore the
  // saved reading from the DB — otherwise the upload screen never shows.
  const [rescan, setRescan] = useState(false);
  const [history, setHistory] = useState([]);
  // True while the client-side MediaPipe gate is checking the just-picked
  // photo (1–3s on cold-cache). Mirrors PalmStepPage's `busy` so the upload
  // screen never appears frozen between "pick file" and "scan animation".
  const [gating, setGating] = useState(false);
  // Lazy-load the MediaPipe model in the background as soon as the page mounts.
  useEffect(() => {
    warmUpGate();
  }, []);
  // Which hand the user just tapped on the upload screen. Falls back to
  // the context value so a scan kicked off on PalmStepPage still shows
  // the badge when the user opens /palm mid-flight.
  const [claimedHand, setClaimedHand] = useState(palmClaimedHand); // "Left" | "Right" | null
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
    const iv = setInterval(() => {
      i++;
      setScanMsg(SCAN_MSGS[i % SCAN_MSGS.length]);
    }, 1800);
    return () => clearInterval(iv);
  }, [palmAnalyzing]);

  // Re-sync the local preview + hand from context whenever they change. The
  // mount-time `useState(palmPhoto)` only captures the value at mount, so a scan
  // started/continued while the user was on another page wouldn't show on
  // return (the scan view needs `preview && scanning`). This keeps them aligned.
  useEffect(() => {
    if (palmPhoto && palmPhoto !== preview) setPreview(palmPhoto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palmPhoto]);
  useEffect(() => {
    if (palmClaimedHand && palmClaimedHand !== claimedHand) setClaimedHand(palmClaimedHand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palmClaimedHand]);

  // Load history list — used to show "Past Readings" on the rescan screen.
  useEffect(() => {
    fetchPalmHistory(form)
      .then(setHistory)
      .catch(() => {});
  }, [form, palm]);

  // Cooldown tick — disables the retry button so users can't spam Pro
  // while it's overloaded.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
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

  async function runAnalyze(dataUrl, hand, skipGate = true, landmarks = null) {
    setError("");
    setLowCredits(false);
    setOverloaded(false);
    setPreview(dataUrl);
    setPalmPhoto(dataUrl);
    // Drive the scan through the CONTEXT flag (not local `scanning`) so the
    // analysis keeps running and re-shows its progress if the user navigates
    // away from /palm and back. The effect that mirrors palmAnalyzing owns the
    // scan animation + message ticker. The await below is detached from this
    // component — results land in context (setPalm), so an unmount can't lose
    // them.
    setPalmAnalyzing(true);
    try {
      // hand falls back to claimedHand state for the retry-with-same-photo path.
      console.log("[palm] POST /palm — analyzing", {
        hand: hand ?? claimedHand,
        skipGate,
        landmarks: landmarks?.length || 0,
      });
      const result = await analyzePalm(dataUrl, form, hand ?? claimedHand, skipGate, landmarks);
      console.log("[palm] reading received");
      setPalm(result);
      setRescan(false);
    } catch (err) {
      if (err.code === "AI_OVERLOADED") {
        setOverloaded(true);
        setCooldown(50); // disable retry button for 50s
      } else if (err.code === "INSUFFICIENT_CREDITS") {
        setLowCredits(true);
        // Drop the un-analyzed photo so the upload card shows the hand-pick
        // buttons again instead of rendering an empty shell.
        setPreview(null);
        setPalmPhoto(null);
      } else setError(err.message);
    } finally {
      setPalmAnalyzing(false);
    }
  }

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setGating(true);
    try {
      // Persist the photo + mark a scan in progress in CONTEXT up front, so the
      // whole flow (photo-check → AI analysis) survives the user navigating away
      // from /palm and re-shows on return. Cleared below if the gate rejects.
      const dataUrl = await resizeToBase64(file);
      setRescan(false);
      setPreview(dataUrl);
      setPalmPhoto(dataUrl);
      setPalmAnalyzing(true);

      // Client-side gate first — rejected photos never hit the API, and it
      // produces the 21 landmarks the biometric match needs. Wait for the model
      // to be READY (one-time load), THEN run the fast inference — so landmarks
      // are reliably captured instead of being dropped by a timeout. Only a
      // genuine model-load failure falls back to the backend gate.
      console.log("[palm] waiting for gate model…");
      let gateResult = null;
      try {
        await withTimeout(ensureGate(), MODEL_READY_TIMEOUT_MS);
        console.log("[palm] gate model ready — scanning");
        gateResult = await withTimeout(gatePalmImage(file, claimedHand), GATE_INFER_TIMEOUT_MS);
        console.log("[palm] gate result", {
          ok: gateResult?.ok,
          landmarks: gateResult?.landmarks?.length || 0,
        });
      } catch (gateErr) {
        console.warn("[palm] gate unavailable — deferring to backend gate", gateErr?.message);
      }

      if (gateResult && !gateResult.ok) {
        setError(gateResult.retakeReason);
        setPreview(null);
        setPalmPhoto(null);
        setPalmAnalyzing(false);
        return;
      }
      // Stash the detected landmarks so the scan animation can draw the skeleton.
      setPalmLandmarks(
        gateResult?.landmarks
          ? { keypoints: gateResult.landmarks, imgW: gateResult.imgW, imgH: gateResult.imgH }
          : null
      );
      // gateResult present → client already gated (skipGate:true). Null → gate
      // didn't run; let the backend gate (skipGate:false). Pass the 21 landmarks
      // (when present) for the biometric match.
      await runAnalyze(dataUrl, claimedHand, !!gateResult, gateResult?.landmarks || null);
    } catch (err) {
      console.error("[palm] onPick failed", err);
      setError("Could not read the image — try a different photo.");
      setPreview(null);
      setPalmPhoto(null);
      setPalmAnalyzing(false);
    } finally {
      setGating(false);
    }
  }

  // Hand tap on the upload screen — record the claim, then open the picker.
  // We always use the plain file input; mobile browsers natively show a
  // camera/gallery chooser, desktop opens the file dialog.
  function pickForHand(hand) {
    setError("");
    setClaimedHand(hand);
    setPalmClaimedHand(hand); // share with context for cross-screen badge
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
    setPalmLandmarks(null);
    setError("");
    setLowCredits(false);
    setPalmLowCredits(false);
    setRescan(true);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  const unusable = palm?.imageQuality === "unusable";

  // Can't afford a palm reading — either the balance is already too low, or a
  // single-hand (`lowCredits`) / compare (`palmLowCredits`) attempt came back
  // 402. Drives the prominent card and disables every scan button.
  const cannotAfford = lowCredits || palmLowCredits || (credits != null && credits < palmCost);

  // Prominent "not enough credits" card — shown on both the single-hand and
  // compare views.
  const lowCreditsCard = cannotAfford && <LowCreditsCard cost={palmCost} action="A palm reading" />;

  // Both-Hands comparison view replaces the single-hand UI entirely. Four
  // states: still analyzing (scan animation), Pro overloaded (cooldown
  // card), either hand unusable (per-hand retake card), or ready.
  const inCompareMode =
    !!palmComparison ||
    (palmAnalyzing && palmLeftPhoto && palmRightPhoto) ||
    (palmOverloaded && palmLeftPhoto && palmRightPhoto) ||
    (palmLowCredits && palmLeftPhoto && palmRightPhoto);
  if (inCompareMode) {
    const c = palmComparison?.comparison;
    const leftBad = palmComparison?.left?.imageQuality === "unusable";
    const rightBad = palmComparison?.right?.imageQuality === "unusable";
    const eitherBad = leftBad || rightBad;

    function resetCompare() {
      setPalmComparison(null);
      setPalmLeftPhoto(null);
      setPalmRightPhoto(null);
      setPalmAnalyzing(false);
      setPalmOverloaded(false);
      setPalmLowCredits(false);
      navigate("/palm-compare");
    }

    // Retry the Both-Hands Pro call with the same two photos (still cached
    // in palmLeftPhoto / palmRightPhoto). Disabled while the cooldown is
    // still ticking down — see compareCooldown below.
    function retryCompare() {
      setPalmOverloaded(false);
      setPalmLowCredits(false);
      setPalmAnalyzing(true);
      comparePalms(palmLeftPhoto, palmRightPhoto, form)
        .then((result) => setPalmComparison(result))
        .catch((err) => {
          if (err?.code === "AI_OVERLOADED") setPalmOverloaded(true);
          else if (err?.code === "INSUFFICIENT_CREDITS") setPalmLowCredits(true);
        })
        .finally(() => setPalmAnalyzing(false));
    }

    // Card border override stays inline — .cosmic-card is unlayered and would
    // otherwise beat a Tailwind border utility.
    const cardStyle = { borderColor: "rgba(168,85,247,0.35)" };
    return (
      <div className="relative mx-auto max-w-180 px-4 pt-8 pb-30">
        <div className="cosmos"></div>
        <div className="stars"></div>

        <div className="mb-6 text-center">
          <p className="text-[13px] font-semibold tracking-[1px] text-[#a855f7] uppercase">
            {form.name || "Your"} · Full Life Comparison
          </p>
          <p className="mt-1.5 text-[11px] text-muted">
            🔒 Your photos are analyzed and discarded — never stored.
          </p>
        </div>

        {lowCreditsCard}

        {/* Both photos, side by side */}
        {(palmLeftPhoto || palmRightPhoto) && (
          <Card style={cardStyle}>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Potential", palmLeftPhoto, "Left"],
                ["Reality", palmRightPhoto, "Right"],
              ].map(([label, src, hand]) => (
                <div
                  key={hand}
                  className="overflow-hidden rounded-xl border border-[rgba(168,85,247,0.3)] bg-[rgba(15,14,32,0.6)]"
                >
                  <div className="aspect-3/4 bg-[#0f0e20]">
                    {src ? (
                      <img src={src} alt={`${hand} palm`} className="block h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="px-2.5 py-2 text-center">
                    <p className="m-0 text-[11px] font-bold tracking-[1.5px] text-[#c4b5fd] uppercase">
                      {hand}
                    </p>
                    <p className="mx-0 mt-0.5 mb-0 text-xs text-dim">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Scan / overloaded / unusable / ready */}
        {palmAnalyzing && !palmComparison && (
          <Card className="text-center" style={cardStyle}>
            {palmLeftPhoto && palmRightPhoto ? (
              <div className="mb-4 flex justify-center gap-5">
                {[palmLeftPhoto, palmRightPhoto].map((src, idx) => (
                  <div
                    key={idx}
                    className="relative h-33 w-25 overflow-hidden rounded-xl border border-[rgba(168,85,247,0.4)] shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                  >
                    <img src={src} alt="scanning palm" className="h-full w-full object-cover" />
                    <div
                      className="absolute top-0 right-0 left-0 h-0.5 bg-[#c084fc] shadow-[0_0_8px_#c084fc]"
                      style={{ animation: "palmScan 1.8s ease-in-out infinite" }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            <p className="m-0 text-sm font-semibold text-[#c084fc]">{scanMsg}</p>
            <p className="mt-1.5 text-[11px] text-muted">Comparing the two hands — usually 20–45 seconds.</p>
          </Card>
        )}

        {palmOverloaded && !palmAnalyzing && !palmComparison && (
          <Card
            className="text-center"
            style={{ borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)" }}
          >
            <div className="mb-2 text-4xl">⏳</div>
            <p className="mx-0 mt-0 mb-1.5 text-[15px] font-semibold text-warning">AI is busy right now</p>
            <p className="mx-0 mt-0 mb-4 text-[12.5px] leading-[1.6] text-subtle">
              Our reader couldn't compare your palms after several tries.
              {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
            </p>
            <Button
              variant="magic"
              onClick={retryCompare}
              disabled={cooldown > 0}
              fullWidth
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again"}
            </Button>
          </Card>
        )}

        {palmComparison &&
          eitherBad &&
          (() => {
            // Pull the specific reject reason + tip for each failed hand so
            // the user knows *exactly* what to fix (wrong_hand vs blurry vs
            // too_dark etc.) instead of a generic lighting prompt.
            const badHands = [
              leftBad
                ? {
                    side: "Left",
                    info: REJECT_INFO[palmComparison.left.rejectReason] || REJECT_INFO.default,
                    server: palmComparison.left.retakeReason,
                  }
                : null,
              rightBad
                ? {
                    side: "Right",
                    info: REJECT_INFO[palmComparison.right.rejectReason] || REJECT_INFO.default,
                    server: palmComparison.right.retakeReason,
                  }
                : null,
            ].filter(Boolean);

            return (
              <Card style={{ borderColor: "rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.06)" }}>
                <p className="mx-0 mt-0 mb-3.5 text-center text-[15px] font-bold text-danger">
                  {badHands.length === 2
                    ? "Both photos need a retake"
                    : `${badHands[0].side} photo needs a retake`}
                </p>

                <div className="grid gap-3">
                  {badHands.map(({ side, info, server }) => (
                    <div
                      key={side}
                      className="flex items-start gap-3 rounded-[10px] border border-[rgba(248,113,113,0.35)] bg-[rgba(15,14,32,0.55)] px-3.5 py-3"
                    >
                      <div className="shrink-0 text-[28px] leading-none">{info.icon}</div>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-xs font-bold tracking-[1.5px] text-warning uppercase">
                          {side} Hand
                        </p>
                        <p className="my-1 text-sm font-bold text-danger">{info.title}</p>
                        <p className="m-0 text-[12.5px] leading-[1.55] text-subtle">{server || info.tip}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="magic" onClick={resetCompare} fullWidth className="mt-3.5">
                  📷 Retake Both Photos
                </Button>
              </Card>
            );
          })()}

        {c && !eitherBad && (
          <div className="animate-[slideUp_0.8s_ease-out]">
            {/* Evolution headline */}
            <div className={BLUEPRINT}>
              <p className="mx-0 mt-0 mb-1.5 text-xs font-bold tracking-[3px] text-[#a855f7] uppercase">
                Alignment · {c.alignment || "—"}
              </p>
              <p className={BLUEPRINT_QUOTE}>"{c.evolution}"</p>
            </div>

            {/* Per-line gap analysis */}
            <div className="grid gap-4">
              {[
                ["Life Line", "🌿", c.lifeLine],
                ["Head Line", "🧠", c.headLine],
                ["Heart Line", "💛", c.heartLine],
                ["Fate Line", "🪐", c.fateLine],
              ].map(
                ([title, icon, content]) =>
                  content && (
                    <Card key={title} style={{ margin: 0 }}>
                      <div className="mb-2.5 flex items-center gap-2.5">
                        <span className="text-[22px]">{icon}</span>
                        <p className={LINE_TITLE}>{title}</p>
                      </div>
                      <p className="m-0 text-[13px] leading-[1.7] text-dim">{content}</p>
                    </Card>
                  )
              )}
            </div>

            {/* Grown / Watch */}
            <div className="grid-2 my-5">
              {c.grownStronger?.length > 0 && (
                <Card
                  style={{ margin: 0, borderColor: "rgba(34,197,94,0.2)", background: "rgba(20,30,20,0.4)" }}
                >
                  <p className="mb-3.5 text-[15px] font-bold text-[#4ade80]">✦ Grown Stronger</p>
                  {c.grownStronger.map((s, i) => (
                    <div key={i} className={BULLET_ROW}>
                      <span className="font-bold text-[#4ade80]">↑</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </Card>
              )}
              {c.watchPoints?.length > 0 && (
                <Card
                  style={{ margin: 0, borderColor: "rgba(251,191,36,0.2)", background: "rgba(30,25,20,0.4)" }}
                >
                  <p className="mb-3.5 text-[15px] font-bold text-warning">✦ Still Showing Up</p>
                  {c.watchPoints.map((w, i) => (
                    <div key={i} className={BULLET_ROW}>
                      <span className="font-bold text-warning">•</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </Card>
              )}
            </div>

            {c.lifeAdvice && (
              <Card style={{ borderColor: "rgba(168,85,247,0.25)", background: "rgba(30,20,45,0.5)" }}>
                <p className="mx-0 mt-0 mb-2.5 text-[15px] font-bold text-[#c084fc]">🎯 Direction</p>
                <p className="m-0 text-[13.5px] leading-[1.7] text-body">{c.lifeAdvice}</p>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={resetCompare}
                className="w-full cursor-pointer rounded-[10px] border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] p-3 text-[13px] font-semibold text-[#c084fc]"
              >
                🔄 Re-do Comparison
              </button>

              <button
                onClick={() => {
                  setPalmComparison(null);
                  setPalmLeftPhoto(null);
                  setPalmRightPhoto(null);
                  setPalmAnalyzing(false);
                  setPalmOverloaded(false);
                  reset();
                  navigate("/palm");
                }}
                className="w-full cursor-pointer rounded-[10px] border border-white/12 bg-white/5 p-3 text-[13px] font-semibold text-dim"
              >
                🖐️ Scan Different Hand
              </button>
            </div>

            <p className={DISCLAIMER}>
              Palmistry is a tool for self-reflection. Insights here are interpretive, not predictive.
            </p>
          </div>
        )}

        <BottomNav activeKey="palm" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-180 px-4 pt-8 pb-30">
      <div className="cosmos"></div>
      <div className="stars"></div>

      <div className="mb-6 text-center">
        <p className="text-[13px] font-semibold tracking-[1px] text-accent uppercase">
          {form.name || "Your"} Palm Reading
        </p>
        <p className="mt-1.5 text-[11px] text-muted">
          🔒 Your photo is analyzed and discarded — never stored.
        </p>
      </div>

      {lowCreditsCard}

      {overloaded && !palm && (
        <Card
          className="text-center"
          style={{ borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)" }}
        >
          <div className="mb-2 text-4xl">⏳</div>
          <p className="mx-0 mt-0 mb-1.5 text-[15px] font-semibold text-warning">AI is busy right now</p>
          <p className="mx-0 mt-0 mb-4 text-[12.5px] leading-[1.6] text-subtle">
            Our reader couldn't analyze your palm after several tries.
            {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
          </p>
          {preview ? (
            <Button
              variant="magic"
              onClick={retry}
              disabled={cooldown > 0}
              fullWidth
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again with Same Photo"}
            </Button>
          ) : (
            <Button
              variant="magic"
              onClick={() => setOverloaded(false)}
              disabled={cooldown > 0}
              fullWidth
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cooldown > 0 ? `🕒 Wait ${cooldown}s` : "Upload a New Photo"}
            </Button>
          )}
        </Card>
      )}

      {/* Past readings — appears above upload when there's history */}
      {!palm && !scanning && history.length > 0 && (
        <Card>
          <p className="mx-0 mt-0 mb-1 text-sm font-semibold text-ink">📂 Your Past Readings</p>
          <p className="mx-0 mt-0 mb-3.5 text-[11px] text-muted">Tap to view — no AI re-run.</p>
          <div className="grid gap-2">
            {history.map((h) => {
              const d = new Date(h.createdAt);
              const when =
                d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
                ", " +
                d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
              const bad = h.imageQuality === "unusable";
              return (
                <button
                  key={h.id}
                  onClick={() => loadPast(h.id)}
                  disabled={bad}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[rgba(168,85,247,0.25)] bg-[rgba(168,85,247,0.06)] px-3.5 py-2.5 text-left"
                  // Disabled (unreadable) state recolors text + dims → inline.
                  style={{
                    cursor: bad ? "not-allowed" : "pointer",
                    color: bad ? "#475569" : "#e2e8f0",
                    opacity: bad ? 0.6 : 1,
                  }}
                >
                  <span className="min-w-0 text-[13px] font-semibold">
                    🖐️ {h.handType || "Unclear"} Hand
                    {bad && <span className="ml-2 text-[10px] text-danger">· unreadable</span>}
                  </span>
                  <span className="text-[11px] whitespace-nowrap text-muted">{when}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Upload / scanning view */}
      {!palm && (
        <Card className="text-center" style={{ padding: "2rem 1.25rem" }}>
          {!preview && !scanning && (
            <>
              <div className="astrology-icon" style={{ fontSize: 56, marginBottom: 12 }}>
                🖐️
              </div>
              <p className="mx-0 mt-0 mb-1.5 text-[15px] font-semibold text-ink">Scan Your Palm</p>
              <p className="mx-0 mt-0 mb-3 text-xs leading-[1.6] text-dim">
                Pick which hand you're uploading. We'll check the photo matches the hand you choose.
              </p>
              {/* Cost reminder — palm reading is a charged AI action. */}
              <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] px-3 py-1 text-[11.5px] font-semibold text-[#c084fc]">
                ✨ {palmCost} credits per reading
              </div>
              <div className="grid gap-2.5">
                <button
                  onClick={() => pickForHand("Right")}
                  disabled={gating || cannotAfford}
                  className="flex w-full items-center gap-3.5 rounded-xl border border-[rgba(168,85,247,0.35)] bg-[rgba(168,85,247,0.08)] px-4 py-3.5 text-left text-ink"
                  style={{
                    cursor: gating || cannotAfford ? "not-allowed" : "pointer",
                    opacity: gating || cannotAfford ? 0.5 : 1,
                  }}
                >
                  <span className="w-8 text-center text-[26px]">✋</span>
                  <span className="flex-1">
                    <strong className="block text-sm">Right Hand</strong>
                    <span className="text-xs text-dim">
                      {hasCamera ? "Tap to take or pick a photo" : "Upload a clear photo of your right palm"}
                    </span>
                  </span>
                  <span className="text-[22px] text-[#a855f7]">›</span>
                </button>
                <button
                  onClick={() => pickForHand("Left")}
                  disabled={gating || cannotAfford}
                  className="flex w-full items-center gap-3.5 rounded-xl border border-[rgba(168,85,247,0.35)] bg-[rgba(168,85,247,0.08)] px-4 py-3.5 text-left text-ink"
                  style={{
                    cursor: gating || cannotAfford ? "not-allowed" : "pointer",
                    opacity: gating || cannotAfford ? 0.5 : 1,
                  }}
                >
                  <span className="w-8 text-center text-[26px]">🤚</span>
                  <span className="flex-1">
                    <strong className="block text-sm">Left Hand</strong>
                    <span className="text-xs text-dim">
                      {hasCamera ? "Tap to take or pick a photo" : "Upload a clear photo of your left palm"}
                    </span>
                  </span>
                  <span className="text-[22px] text-[#a855f7]">›</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPick}
                className="hidden"
              />

              {/* Premium upsell — both-hands "Full Life Comparison". */}
              <button
                onClick={() => navigate("/palm-compare")}
                disabled={cannotAfford}
                className="mt-3.5 w-full cursor-pointer rounded-[10px] border border-[rgba(192,132,252,0.4)] bg-[linear-gradient(135deg,rgba(168,85,247,0.10),rgba(99,102,241,0.10))] px-3 py-2.5 text-[12.5px] font-semibold text-[#c4b5fd] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✋🤚 Compare Both Hands · Full Life Reading · {palmCost} Credits →
              </button>

              {gating && <p className="mx-0 mt-3 mb-0 text-center text-[13px] text-dim">Reading photo…</p>}

              {error && (
                <p className="mt-3 animate-[slideUp_0.3s_ease-out] text-center text-[13px] text-danger">
                  {error}
                </p>
              )}
            </>
          )}

          {preview && scanning && (
            <>
              {claimedHand && (
                <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(168,85,247,0.5)] bg-[rgba(168,85,247,0.12)] px-3.5 py-1.5 text-xs font-bold tracking-[1.5px] text-[#c4b5fd] uppercase">
                  <span className="text-sm">{claimedHand === "Right" ? "✋" : "🤚"}</span>
                  {claimedHand} Hand
                </div>
              )}
              <div className="relative mx-auto mb-4.5 w-full max-w-80 overflow-hidden rounded-2xl border border-[rgba(168,85,247,0.4)] shadow-[0_0_30px_rgba(168,85,247,0.25)]">
                <img src={preview} alt="palm" className="block w-full" />
                {/* detected hand skeleton (landmarks + bones), pinned on the photo */}
                <PalmSkeletonOverlay landmarks={palmLandmarks} />
                {/* sweeping scan line */}
                <div
                  className="absolute top-0 right-0 left-0 h-[3px] bg-[linear-gradient(90deg,transparent,#c084fc,transparent)] shadow-[0_0_18px_4px_rgba(192,132,252,0.6)]"
                  style={{ animation: "palmScan 1.8s ease-in-out infinite" }}
                />
                {/* dotted overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: "radial-gradient(rgba(168,85,247,0.18) 1px, transparent 1px)",
                    backgroundSize: "14px 14px",
                    mixBlendMode: "screen",
                  }}
                />
              </div>
              <p className="m-0 text-sm font-semibold text-[#c084fc]">{scanMsg}</p>
              <p className="mt-1.5 text-[11px] text-muted">This usually takes 10–30 seconds.</p>
              <style>{`@keyframes palmScan { 0%{top:0} 50%{top:calc(100% - 3px)} 100%{top:0} }`}</style>
            </>
          )}
        </Card>
      )}

      {/* Reading view */}
      {palm && !unusable && (
        <div className="animate-[slideUp_0.8s_ease-out]">
          {/* Clean photo header — no overlay (Gemini's spatial accuracy isn't reliable). */}
          {preview && (
            <Card className="text-center" style={{ padding: 14 }}>
              {palm.handType && palm.handType !== "Unclear" && (
                <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(168,85,247,0.5)] bg-[rgba(168,85,247,0.12)] px-3.5 py-1.5 text-xs font-bold tracking-[1.5px] text-[#c4b5fd] uppercase">
                  <span className="text-sm">{palm.handType === "Right" ? "✋" : "🤚"}</span>
                  {palm.handType} Hand
                </div>
              )}
              <div className="mx-auto w-full max-w-80 overflow-hidden rounded-[14px] border border-[rgba(168,85,247,0.3)]">
                <img src={preview} alt="palm" className="block w-full" />
              </div>
            </Card>
          )}

          <div className={BLUEPRINT}>
            <p className="mx-0 mt-0 mb-1.5 text-xs font-bold tracking-[3px] text-[#a855f7] uppercase">
              {palm.handType} Hand · {palm.imageQuality}
            </p>
            <p className={BLUEPRINT_QUOTE}>"{palm.overallVibe}"</p>
          </div>

          <div className="grid gap-4">
            {[
              ["Life Line", "🌿", palm.lifeLine],
              ["Head Line", "🧠", palm.headLine],
              ["Heart Line", "💛", palm.heartLine],
              ["Fate Line", "🪐", palm.fateLine],
              ["Mount of Venus", "✨", palm.mountOfVenus],
              ["Marriage Lines", "💍", palm.marriageLines],
            ].map(
              ([title, icon, content]) =>
                content && (
                  <Card key={title} style={{ margin: 0 }}>
                    <div className="mb-2.5 flex items-center gap-2.5">
                      <span className="text-[22px]">{icon}</span>
                      <p className={LINE_TITLE}>{title}</p>
                    </div>
                    <p className="m-0 text-[13px] leading-[1.7] text-dim">{content}</p>
                  </Card>
                )
            )}
          </div>

          <div className="grid-2 my-5">
            {palm.strengths?.length > 0 && (
              <Card
                style={{
                  margin: 0,
                  borderColor: "rgba(34, 197, 94, 0.2)",
                  background: "rgba(20, 30, 20, 0.4)",
                }}
              >
                <p className="mb-3.5 text-[15px] font-bold text-[#4ade80]">✦ Strengths</p>
                {palm.strengths.map((s, i) => (
                  <div key={i} className={BULLET_ROW}>
                    <span className="font-bold text-[#4ade80]">✓</span>
                    <span>{s}</span>
                  </div>
                ))}
              </Card>
            )}
            {palm.watchOuts?.length > 0 && (
              <Card
                style={{
                  margin: 0,
                  borderColor: "rgba(251, 191, 36, 0.2)",
                  background: "rgba(30, 25, 20, 0.4)",
                }}
              >
                <p className="mb-3.5 text-[15px] font-bold text-warning">✦ Watch For</p>
                {palm.watchOuts.map((c, i) => (
                  <div key={i} className={BULLET_ROW}>
                    <span className="font-bold text-warning">↑</span>
                    <span>{c}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          {palm.practicalGuidance && (palm.practicalGuidance.career || palm.practicalGuidance.love) && (
            <Card style={{ borderColor: "rgba(168,85,247,0.25)", background: "rgba(30,20,45,0.5)" }}>
              <p className="mx-0 mt-0 mb-1 text-[15px] font-bold text-[#c084fc]">🎯 Practical Guidance</p>
              <p className="mx-0 mt-0 mb-3.5 text-[11px] text-muted">
                Concrete next steps from your Fate and Heart lines
              </p>
              <div className="grid gap-3">
                {palm.practicalGuidance.career && (
                  <div className="rounded-[10px] border-l-[3px] border-[#fbbf24] bg-[rgba(251,191,36,0.08)] px-3.5 py-3">
                    <p className="mx-0 mt-0 mb-1 text-[10px] font-bold tracking-[1.5px] text-warning">
                      CAREER
                    </p>
                    <p className="m-0 text-[13px] leading-[1.65] text-body">
                      {palm.practicalGuidance.career}
                    </p>
                  </div>
                )}
                {palm.practicalGuidance.love && (
                  <div className="rounded-[10px] border-l-[3px] border-[#f87171] bg-[rgba(248,113,113,0.08)] px-3.5 py-3">
                    <p className="mx-0 mt-0 mb-1 text-[10px] font-bold tracking-[1.5px] text-danger">LOVE</p>
                    <p className="m-0 text-[13px] leading-[1.65] text-body">{palm.practicalGuidance.love}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {palm.palmistryNotes?.length > 0 && (
            <Card style={{ borderColor: "rgba(99,102,241,0.25)", background: "rgba(20,22,40,0.5)" }}>
              <p className="mx-0 mt-0 mb-1 text-[15px] font-bold text-[#a5b4fc]">
                📜 Classical Palmistry Notes
              </p>
              <p className="mx-0 mt-0 mb-3.5 text-[11px] text-muted">
                Traditional rules cross-checked against your reading
              </p>
              <div className="grid gap-2">
                {palm.palmistryNotes.map((n, i) => (
                  <div
                    key={i}
                    className="flex gap-2.5 rounded-lg border-l-[3px] border-accent bg-white/3 px-3 py-2 text-[13px] leading-[1.55] text-subtle"
                  >
                    <span className="font-bold text-[#a5b4fc]">✓</span>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <button
            onClick={reset}
            className="w-full cursor-pointer rounded-[10px] border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] p-3 text-[13px] font-semibold text-[#c084fc]"
          >
            🔄 Scan a Different Palm
          </button>

          <p className={DISCLAIMER}>
            Palmistry is a tool for self-reflection. Insights here are interpretive, not predictive.
          </p>
        </div>
      )}

      {/* Unusable image — categorized retake message */}
      {palm &&
        unusable &&
        (() => {
          const info = REJECT_INFO[palm.rejectReason] || REJECT_INFO.default;
          return (
            <Card
              className="text-center"
              style={{
                padding: "2rem 1.5rem",
                borderColor: "rgba(248,113,113,0.4)",
                background: "rgba(248,113,113,0.06)",
              }}
            >
              {preview && (
                <div className="mx-auto mb-4 h-35 w-35 overflow-hidden rounded-xl border border-[rgba(248,113,113,0.45)] shadow-[0_0_18px_rgba(248,113,113,0.2)]">
                  <img src={preview} alt="uploaded palm" className="block h-full w-full object-cover" />
                </div>
              )}
              <div className="mb-3 text-[44px]">{info.icon}</div>
              <p className="mx-0 mt-0 mb-2 text-base font-bold text-danger">{info.title}</p>
              <p className="mx-0 mt-0 mb-1.5 text-[13.5px] leading-[1.65] text-subtle">{info.tip}</p>
              {palm.retakeReason && (
                <p className="mx-0 mt-0 mb-4.5 text-xs leading-[1.6] text-muted italic">
                  {palm.retakeReason}
                </p>
              )}
              <Button variant="magic" onClick={reset} fullWidth>
                📷 Upload Another Photo
              </Button>
            </Card>
          );
        })()}

      <BottomNav activeKey="palm" />
    </div>
  );
}
