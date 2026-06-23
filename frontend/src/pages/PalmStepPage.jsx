// Onboarding step shown between the birth-detail form and the kundali
// reading. The user can upload a palm photo (right or left) which is
// analysed in the background while they read their kundali, or skip
// straight to the reading. Hand-side is a UI label only — not sent to AI.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, usePalm } from "../context/ChartContext";
import { useAnalyzePalm } from "@/features/palm/hooks";
import { gatePalmImage, warmUpGate } from "../utils/palmGate";
import Card from "@/common/Card";
import PalmSkeletonOverlay from "../components/PalmSkeletonOverlay";
import PalmGateChecklist from "../components/PalmGateChecklist";
import { Icon } from "@/utils/icons";

// Mobile browsers can populate <input type=file capture="environment"> with
// the camera directly. Desktop/laptop browsers ignore `capture` and always
// show a file picker — so detecting touch-first devices lets us tailor the UX.
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch =
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(ua) || touch;
}

const CARD_BTN =
  "flex w-full cursor-pointer items-center gap-4 rounded-[14px] border border-[rgba(168,85,247,0.35)] bg-[rgba(168,85,247,0.08)] px-4.5 py-4 text-left text-ink";
const SKIP_BTN =
  "mt-2 w-full cursor-pointer rounded-[14px] border border-white/12 bg-transparent px-4 py-3 font-semibold text-dim";
// Compare upsell reuses the card-button shape but with a distinct gradient.
const COMPARE_BTN =
  "flex w-full cursor-pointer items-center gap-4 rounded-[14px] border border-[rgba(192,132,252,0.55)] bg-[linear-gradient(135deg,rgba(168,85,247,0.18),rgba(99,102,241,0.18))] px-4.5 py-4 text-left text-ink";

// Resize image File → JPEG base64 data URL (max 600px on long edge).
// Mirrors PalmPage.resizeToBase64 so first-time uploads get the same
// preprocessing as direct uploads — without this, full-resolution phone
// photos (HEIC, multi-MB) often confuse Gemini's image pipeline and come
// back as "too dark" / "blurry" even when the same hand reads fine after
// the smaller, normalized re-encode.
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

export default function PalmStepPage() {
  const navigate = useNavigate();
  const { form } = useForm();
  const { setPalm, setPalmComparison, setPalmPhoto, setPalmAnalyzing, setPalmClaimedHand, setPalmLandmarks } =
    usePalm();
  const analyze = useAnalyzePalm({ form });
  const fileRef = useRef(null); // generic file picker (desktop default)
  const cameraRef = useRef(null); // mobile-only camera capture
  const galleryRef = useRef(null); // mobile-only gallery picker
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chooserOpen, setChooserOpen] = useState(false); // shown on mobile
  // Which hand button the user just tapped — sent to the backend so the
  // gate can reject if the photo actually shows the opposite hand.
  const [claimedHand, setClaimedHand] = useState(null); // "Left" | "Right" | null
  // In-place scan view (matches astro-2 /palm-step): once a photo passes (or
  // fails) the gate we stay on this page and show the skeleton + diagnostic
  // checklist while the AI analysis runs, instead of navigating away first.
  const [preview, setPreview] = useState(null); // resized data URL on screen
  const [checks, setChecks] = useState([]); // gate diagnostic rows
  const [confidence, setConfidence] = useState(null); // 0-100 photo-quality score
  const [landmarks, setLandmarks] = useState(null); // { keypoints, imgW, imgH }
  const [analyzing, setAnalyzing] = useState(false);
  const [rejected, setRejected] = useState(false); // gate failed → show cross + retry

  // Pre-load the MediaPipe model in the background while the user is
  // still choosing a hand — so the first File they pick gets gated
  // without a noticeable delay.
  useEffect(() => {
    warmUpGate();
  }, []);

  const isMobile = useMemo(() => isMobileDevice(), []);

  // Both paths (upload + skip) land on /reading (Insights). When a palm photo
  // was provided we kick off the analysis in the background so the result is
  // ready in ChartContext.palm by the time the user opens the Palm tab.
  function goToReading() {
    navigate("/reading");
  }
  function goToPalm() {
    navigate("/palm");
  }

  // Back to the hand-pick screen (after a rejection or a "choose another").
  function resetToIdle() {
    setRejected(false);
    setAnalyzing(false);
    setPreview(null);
    setChecks([]);
    setConfidence(null);
    setLandmarks(null);
    setError("");
  }

  // Hand tap → record which hand the user claimed, then open picker.
  function onHandTap(hand) {
    setError("");
    setClaimedHand(hand);
    if (isMobile) {
      setChooserOpen(true);
    } else {
      fileRef.current?.click();
    }
  }

  function openCamera() {
    setChooserOpen(false);
    cameraRef.current?.click();
  }
  function openGallery() {
    setChooserOpen(false);
    galleryRef.current?.click();
  }

  async function onFileSelected(e) {
    const file = e.target.files?.[0];
    // Reset value so re-picking the same file still fires onChange.
    e.target.value = "";
    if (!file) {
      goToReading();
      return;
    }
    setBusy(true);
    setError("");
    setRejected(false);
    try {
      // Client-side gate — MediaPipe Hands + pixel heuristics. Rejected photos
      // never leave the device, never spend a Gemini token. It returns every
      // metric (the checklist) plus the landmarks for the skeleton overlay.
      const gateResult = await gatePalmImage(file, claimedHand);
      const dataUrl = await resizeToBase64(file);
      const lm = gateResult.landmarks
        ? { keypoints: gateResult.landmarks, imgW: gateResult.imgW, imgH: gateResult.imgH }
        : null;
      setPreview(dataUrl);
      setChecks(gateResult.checks || []);
      // Only surface the confidence number on a PASSING photo — a reject shows
      // the failing-check card instead, where a score would just be noise.
      setConfidence(gateResult.ok ? (gateResult.confidence ?? null) : null);
      setLandmarks(lm);

      if (!gateResult.ok) {
        // Show the checklist with the failing check + a retake affordance.
        setError(gateResult.retakeReason);
        setRejected(true);
        return;
      }

      // Passed → analyse here, showing the skeleton + checklist, then hand off
      // to /palm with the result ready in context.
      setPalm(null);
      setPalmComparison(null);
      setPalmPhoto(dataUrl);
      setPalmClaimedHand(claimedHand);
      setPalmLandmarks(lm);
      setAnalyzing(true);
      setPalmAnalyzing(true);
      try {
        const result = await analyze.mutateAsync({ imageBase64: dataUrl, claimedHand });
        setPalm(result);
        goToPalm();
      } catch {
        setError("Couldn't analyze that photo — please try again.");
        setAnalyzing(false);
        setRejected(true);
      } finally {
        setPalmAnalyzing(false);
      }
    } catch {
      setError("Couldn't read that photo. Try another one.");
      resetToIdle();
    } finally {
      setBusy(false);
    }
  }

  // Swap the hand-pick UI for the in-place scan/result view once a photo is in
  // flight (analyzing) or was rejected by the gate.
  const showResult = preview && (analyzing || rejected);

  return (
    <div className="relative mx-auto max-w-140 px-4 py-8">
      <div className="cosmos"></div>
      <div className="stars"></div>

      {showResult ? (
        <Card className="text-center">
          {claimedHand && (
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(168,85,247,0.5)] bg-[rgba(168,85,247,0.12)] px-3.5 py-1.5 text-xs font-bold tracking-[1.5px] text-[#c4b5fd] uppercase">
              <Icon name="HAND" size={14} />
              {claimedHand} Hand
            </div>
          )}
          <div className="relative mx-auto mb-4 w-full max-w-80 overflow-hidden rounded-2xl border border-[rgba(168,85,247,0.4)] shadow-[0_0_30px_rgba(168,85,247,0.25)]">
            <img src={preview} alt="palm" className="block w-full" />
            <PalmSkeletonOverlay landmarks={landmarks} />
            {analyzing && (
              <div
                className="absolute top-0 right-0 left-0 h-[3px] bg-[linear-gradient(90deg,transparent,#c084fc,transparent)] shadow-[0_0_18px_4px_rgba(192,132,252,0.6)]"
                style={{ animation: "palmScan 1.8s ease-in-out infinite" }}
              />
            )}
          </div>

          <PalmGateChecklist checks={checks} analyzing={analyzing} confidence={confidence} />

          {rejected && (
            <div className="mt-4 grid gap-2">
              <p className="m-0 text-[13px] text-danger">{error}</p>
              <button type="button" onClick={resetToIdle} className={CARD_BTN}>
                <span className="grid w-9 place-items-center">
                  <Icon name="CAMERA" size={24} />
                </span>
                <span className="flex-1">
                  <strong className="block text-[15px]">Choose a different photo</strong>
                </span>
              </button>
              <button type="button" onClick={goToReading} className={SKIP_BTN}>
                Skip → Go to my kundali
              </button>
            </div>
          )}
          <style>{`@keyframes palmScan { 0%{top:0} 50%{top:calc(100% - 3px)} 100%{top:0} }`}</style>
        </Card>
      ) : (
        <>
          {/* cosmic-card bottom margin (unlayered) overridden inline. */}
          <Card className="text-center" style={{ marginBottom: "1.5rem" }}>
            <h2 className="m-0 mb-2 inline-flex items-center justify-center gap-2 text-2xl font-bold">
              <Icon name="HAND" size={24} /> Add a Palm Reading?
            </h2>
            <p className="m-0 text-[13px] leading-normal text-dim">
              Optional — we'll analyze your palm while your kundali is being built.
            </p>
          </Card>

          <Card className="grid gap-3">
            <button type="button" onClick={() => onHandTap("Right")} disabled={busy} className={CARD_BTN}>
              <span className="grid w-9 place-items-center text-[#a855f7]">
                <Icon name="HAND" size={28} />
              </span>
              <span className="flex-1">
                <strong className="block text-[15px]">Right Hand</strong>
                <span className="text-xs text-dim">
                  {isMobile ? "Take a photo or pick from gallery" : "Upload a clear photo of your right palm"}
                </span>
              </span>
              <span className="grid place-items-center text-[#a855f7]">
                <Icon name="CHEVRON_RIGHT" size={22} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/palm-compare")}
              disabled={busy}
              className={COMPARE_BTN}
            >
              <span className="grid w-9 place-items-center text-[#c084fc]">
                <Icon name="HANDS" size={28} />
              </span>
              <span className="flex-1">
                <strong className="block text-[15px]">Both Hands · Full Life Comparison</strong>
                <span className="text-xs text-[#c4b5fd]">
                  Compare your inborn potential against your current reality
                </span>
              </span>
              <span className="grid place-items-center text-[#c084fc]">
                <Icon name="CHEVRON_RIGHT" size={22} />
              </span>
            </button>

            <button type="button" onClick={() => onHandTap("Left")} disabled={busy} className={CARD_BTN}>
              <span className="grid w-9 place-items-center text-[#a855f7]">
                <Icon name="HAND" size={28} />
              </span>
              <span className="flex-1">
                <strong className="block text-[15px]">Left Hand</strong>
                <span className="text-xs text-dim">
                  {isMobile ? "Take a photo or pick from gallery" : "Upload a clear photo of your left palm"}
                </span>
              </span>
              <span className="grid place-items-center text-[#a855f7]">
                <Icon name="CHEVRON_RIGHT" size={22} />
              </span>
            </button>

            <button type="button" onClick={goToReading} disabled={busy} className={SKIP_BTN}>
              Skip → Go to my kundali
            </button>

            {/* Desktop: single file input. Mobile: separate inputs so the
            camera-capture attribute only applies to the camera button. */}
            <input ref={fileRef} type="file" accept="image/*" onChange={onFileSelected} className="hidden" />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileSelected}
              className="hidden"
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              onChange={onFileSelected}
              className="hidden"
            />

            {busy && <p className="mx-0 mt-2 mb-0 text-center text-[13px] text-dim">Reading photo…</p>}
            {error && <p className="mx-0 mt-2 mb-0 text-center text-[13px] text-danger">{error}</p>}
          </Card>

          <p className="mt-4 text-center text-[11px] leading-normal text-muted">
            Tip: bright, even lighting and a clear view of the palm work best.
          </p>
        </>
      )}

      {chooserOpen && (
        <div
          onClick={() => setChooserOpen(false)}
          className="fixed inset-0 z-100 flex items-end justify-center bg-black/70"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="grid w-full max-w-120 gap-2.5 rounded-t-[20px] border border-[rgba(168,85,247,0.35)] bg-[#0f0e20] p-4.5"
          >
            <p className="mx-0 mt-1 mb-2 text-center text-[13px] text-dim">
              How would you like to add the photo?
            </p>
            <button type="button" onClick={openCamera} className={CARD_BTN}>
              <span className="grid w-9 place-items-center">
                <Icon name="CAMERA" size={26} />
              </span>
              <span className="flex-1">
                <strong className="block text-[15px]">Take a Photo</strong>
                <span className="text-xs text-dim">Use your camera</span>
              </span>
            </button>
            <button type="button" onClick={openGallery} className={CARD_BTN}>
              <span className="grid w-9 place-items-center">
                <Icon name="GALLERY" size={26} />
              </span>
              <span className="flex-1">
                <strong className="block text-[15px]">Choose from Gallery</strong>
                <span className="text-xs text-dim">Pick an existing photo</span>
              </span>
            </button>
            <button type="button" onClick={() => setChooserOpen(false)} className={SKIP_BTN}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
