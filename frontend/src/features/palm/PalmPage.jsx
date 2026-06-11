// Palm reading page — thin orchestrator. Owns the state machine (upload →
// gate → analyze → result, plus the compare-mode takeover) and delegates all
// presentation to sections/ (mirrors mobile's features/palm layout).

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChart } from "@/context/ChartContext";
import { analyzePalm, comparePalms, fetchSaved, fetchPalmHistory, fetchPalmById } from "@/services/api";
import { gatePalmImage, warmUpGate, ensureGate } from "./palmGate";
import { resizeToBase64, withTimeout, useCameraSupport } from "./palmUtils";
import { SCAN_MSGS, MODEL_READY_TIMEOUT_MS, GATE_INFER_TIMEOUT_MS } from "./constants";
import CompareView from "./sections/CompareView";
import UploadView from "./sections/UploadView";
import PastReadings from "./sections/PastReadings";
import OverloadCard from "./sections/OverloadCard";
import ReadingResult from "./sections/ReadingResult";
import BottomNav from "@/components/BottomNav";
import { useCosts } from "@/common/useCosts";
import { useCredits } from "@/common/useCredits";
import LowCreditsCard from "@/common/LowCreditsCard";

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

  // Can't afford a palm reading — either the balance is already too low, or a
  // single-hand (`lowCredits`) / compare (`palmLowCredits`) attempt came back
  // 402. Drives the prominent card and disables every scan button.
  const cannotAfford = lowCredits || palmLowCredits || (credits != null && credits < palmCost);

  // Prominent "not enough credits" card — shown on both the single-hand and
  // compare views.
  const lowCreditsCard = cannotAfford && <LowCreditsCard cost={palmCost} action="A palm reading" />;

  // Both-Hands comparison view replaces the single-hand UI entirely.
  const inCompareMode =
    !!palmComparison ||
    (palmAnalyzing && palmLeftPhoto && palmRightPhoto) ||
    (palmOverloaded && palmLeftPhoto && palmRightPhoto) ||
    (palmLowCredits && palmLeftPhoto && palmRightPhoto);
  if (inCompareMode) {
    const resetCompare = () => {
      setPalmComparison(null);
      setPalmLeftPhoto(null);
      setPalmRightPhoto(null);
      setPalmAnalyzing(false);
      setPalmOverloaded(false);
      setPalmLowCredits(false);
      navigate("/palm-compare");
    };

    // Retry the Both-Hands Pro call with the same two photos (still cached
    // in palmLeftPhoto / palmRightPhoto). Disabled while the cooldown is
    // still ticking down.
    const retryCompare = () => {
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
    };

    return (
      <CompareView
        form={form}
        comparison={palmComparison}
        leftPhoto={palmLeftPhoto}
        rightPhoto={palmRightPhoto}
        analyzing={palmAnalyzing}
        overloaded={palmOverloaded}
        cooldown={cooldown}
        scanMsg={scanMsg}
        lowCreditsCard={lowCreditsCard}
        onRetry={retryCompare}
        onResetCompare={resetCompare}
        onScanDifferentHand={() => {
          setPalmComparison(null);
          setPalmLeftPhoto(null);
          setPalmRightPhoto(null);
          setPalmAnalyzing(false);
          setPalmOverloaded(false);
          reset();
          navigate("/palm");
        }}
      />
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
        <OverloadCard
          cooldown={cooldown}
          preview={preview}
          onRetry={retry}
          onClear={() => setOverloaded(false)}
        />
      )}

      {/* Past readings — appears above upload when there's history */}
      {!palm && !scanning && history.length > 0 && <PastReadings history={history} onLoad={loadPast} />}

      {/* Upload / scanning view */}
      {!palm && (
        <UploadView
          preview={preview}
          scanning={scanning}
          scanMsg={scanMsg}
          claimedHand={claimedHand}
          palmLandmarks={palmLandmarks}
          error={error}
          gating={gating}
          cannotAfford={cannotAfford}
          palmCost={palmCost}
          hasCamera={hasCamera}
          pickForHand={pickForHand}
          onPick={onPick}
          onCompare={() => navigate("/palm-compare")}
          fileRef={fileRef}
          cameraRef={cameraRef}
        />
      )}

      {/* Reading view (or the categorized retake card when unusable) */}
      {palm && <ReadingResult palm={palm} preview={preview} onReset={reset} />}

      <BottomNav activeKey="palm" />
    </div>
  );
}
