// Onboarding step shown between the birth-detail form and the kundali
// reading. The user can upload a palm photo (right or left) which is
// analysed in the background while they read their kundali, or skip
// straight to the reading. Hand-side is a UI label only — not sent to AI.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChart } from "../context/ChartContext";
import { useAnalyzePalm } from "@/features/palm/hooks";
import { gatePalmImage, warmUpGate } from "../utils/palmGate";
import Card from "@/common/Card";
import { EMOJIS } from "@/utils/emojis";

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
      const analyze = useAnalyzePalm({ form });
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PalmStepPage() {
  const navigate = useNavigate();
  const { form, setPalm, setPalmComparison, setPalmPhoto, setPalmAnalyzing, setPalmClaimedHand } = useChart();
  const fileRef = useRef(null); // generic file picker (desktop default)
  const cameraRef = useRef(null); // mobile-only camera capture
  const galleryRef = useRef(null); // mobile-only gallery picker
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chooserOpen, setChooserOpen] = useState(false); // shown on mobile
  // Which hand button the user just tapped — sent to the backend so the
  // gate can reject if the photo actually shows the opposite hand.
  const [claimedHand, setClaimedHand] = useState(null); // "Left" | "Right" | null

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

  function analyzeInBackground(dataUrl, hand) {
    setPalmAnalyzing(true);
    analyze
      .mutateAsync({ imageBase64: dataUrl, claimedHand: hand })
      .then((result) => setPalm(result))
      .catch(() => {
        /* surfaced on /palm if the user visits it */
      })
      .finally(() => setPalmAnalyzing(false));
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
    try {
      // Client-side gate — MediaPipe Hands + pixel heuristics. Rejected
      // photos never leave the device, never spend a Gemini token. Passing
      // claimedHand lets MediaPipe reject obvious wrong-hand mistakes.
      const gateResult = await gatePalmImage(file, claimedHand);
      if (!gateResult.ok) {
        setError(gateResult.retakeReason);
        return;
      }
      const dataUrl = await resizeToBase64(file);
      // Clear old data so PalmPage shows the scanning animation for the new photo
      setPalm(null);
      setPalmComparison(null);
      setPalmPhoto(dataUrl);
      setPalmClaimedHand(claimedHand);
      analyzeInBackground(dataUrl, claimedHand);
      goToPalm();
    } catch {
      setError("Couldn't read that photo. Try another one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto max-w-140 px-4 py-8">
      <div className="cosmos"></div>
      <div className="stars"></div>

      {/* cosmic-card bottom margin (unlayered) overridden inline. */}
      <Card className="text-center" style={{ marginBottom: "1.5rem" }}>
        <h2 className="m-0 mb-2 text-2xl font-bold">{EMOJIS.HAND} Add a Palm Reading?</h2>
        <p className="m-0 text-[13px] leading-normal text-dim">
          Optional — we'll analyse your palm while your kundali is being built.
        </p>
      </Card>

      <Card className="grid gap-3">
        <button type="button" onClick={() => onHandTap("Right")} disabled={busy} className={CARD_BTN}>
          <span className="w-9 text-center text-[28px]">{EMOJIS.HAND}</span>
          <span className="flex-1">
            <strong className="block text-[15px]">Right Hand</strong>
            <span className="text-xs text-dim">
              {isMobile ? "Take a photo or pick from gallery" : "Upload a clear photo of your right palm"}
            </span>
          </span>
          <span className="text-[22px] text-[#a855f7]">{EMOJIS.CHEVRON_RIGHT}</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/palm-compare")}
          disabled={busy}
          className={COMPARE_BTN}
        >
          <span className="w-9 text-center text-[28px]">✋🤚</span>
          <span className="flex-1">
            <strong className="block text-[15px]">Both Hands · Full Life Comparison</strong>
            <span className="text-xs text-[#c4b5fd]">
              Compare your inborn potential against your current reality
            </span>
          </span>
          <span className="text-[22px] text-[#c084fc]">›</span>
        </button>

        <button type="button" onClick={() => onHandTap("Left")} disabled={busy} className={CARD_BTN}>
          <span className="w-9 text-center text-[28px]">{EMOJIS.HAND}</span>
          <span className="flex-1">
            <strong className="block text-[15px]">Left Hand</strong>
            <span className="text-xs text-dim">
              {isMobile ? "Take a photo or pick from gallery" : "Upload a clear photo of your left palm"}
            </span>
          </span>
          <span className="text-[22px] text-[#a855f7]">{EMOJIS.CHEVRON_RIGHT}</span>
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
        <input ref={galleryRef} type="file" accept="image/*" onChange={onFileSelected} className="hidden" />

        {busy && <p className="mx-0 mt-2 mb-0 text-center text-[13px] text-dim">Reading photo…</p>}
        {error && <p className="mx-0 mt-2 mb-0 text-center text-[13px] text-danger">{error}</p>}
      </Card>

      <p className="mt-4 text-center text-[11px] leading-normal text-muted">
        Tip: bright, even lighting and a clear view of the palm work best.
      </p>

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
              <span className="w-9 text-center text-[26px]">📷</span>
              <span className="flex-1">
                <strong className="block text-[15px]">Take a Photo</strong>
                <span className="text-xs text-dim">Use your camera</span>
              </span>
            </button>
            <button type="button" onClick={openGallery} className={CARD_BTN}>
              <span className="w-9 text-center text-[26px]">🖼️</span>
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
