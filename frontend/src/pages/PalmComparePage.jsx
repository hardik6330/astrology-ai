// Two-hand "Full Life Comparison" flow. Walks the user through picking a
// left-hand photo, then a right-hand photo, then kicks off the comparison
// analysis in the background and routes them to /palm where the synthesis
// renders. Mirrors PalmStepPage's UX (mobile chooser modal, file inputs)
// so it feels like a natural extension.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChart } from "../context/ChartContext";
import { useComparePalms } from "@/features/palm/hooks";
import { gatePalmImage, warmUpGate } from "../utils/palmGate";
import Card from "@/common/Card";
import Button from "@/common/Button";
import { EMOJIS } from "@/utils/emojis";

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch =
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(ua) || touch;
}

// Same resize as PalmStepPage / PalmPage — keep payload small + format normalized.
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

const CARD_BTN =
  "flex w-full cursor-pointer items-center gap-4 rounded-[14px] border border-[rgba(168,85,247,0.35)] bg-[rgba(168,85,247,0.08)] px-4.5 py-4 text-left text-ink";
const GHOST_BTN =
  "mt-2 w-full cursor-pointer rounded-[14px] border border-white/12 bg-transparent px-4 py-3 font-semibold text-dim";
const THUMB = "h-24 w-24 overflow-hidden rounded-xl border border-[rgba(168,85,247,0.35)]";

export default function PalmComparePage() {
  const navigate = useNavigate();
  const {
    form,
    setPalmComparison,
    setPalmLeftPhoto,
    setPalmRightPhoto,
    setPalmAnalyzing,
    setPalmOverloaded,
  } = useChart();

  const compare = useComparePalms({ form });
  const [left, setLeft] = useState(null); // data URL
  const [right, setRight] = useState(null); // data URL
  // Which slot is being picked into — drives the camera/gallery chooser.
  const [pickingHand, setPickingHand] = useState(null); // "left" | "right" | null
  const [chooserOpen, setChooserOpen] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const isMobile = useMemo(() => isMobileDevice(), []);
  const ready = !!(left && right);

  // Warm up the MediaPipe model while the user is reading the intro.
  useEffect(() => {
    warmUpGate();
  }, []);

  function startPick(hand) {
    setError("");
    setPickingHand(hand);
    if (isMobile) setChooserOpen(true);
    else fileRef.current?.click();
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
    e.target.value = "";
    if (!file || !pickingHand) return;
    try {
      // Client-side gate per hand — if the photo is bad we tell the user
      // immediately without consuming any API call. Passing the claim lets
      // MediaPipe catch obvious wrong-hand mistakes.
      const claim = pickingHand === "left" ? "Left" : "Right";
      const gateResult = await gatePalmImage(file, claim);
      if (!gateResult.ok) {
        const side = pickingHand === "left" ? "Left" : "Right";
        setError(`${side} hand: ${gateResult.retakeReason}`);
        setPickingHand(null);
        return;
      }
      const dataUrl = await resizeToBase64(file);
      if (pickingHand === "left") {
        setLeft(dataUrl);
        setPalmLeftPhoto(dataUrl);
      }
      if (pickingHand === "right") {
        setRight(dataUrl);
        setPalmRightPhoto(dataUrl);
      }
    } catch {
      setError("Couldn't read that photo. Try a different one.");
    }
    setPickingHand(null);
  }

  function analyzeInBackground() {
    setPalmAnalyzing(true);
    setPalmOverloaded(false);
    compare
      .mutateAsync({ leftImage: left, rightImage: right })
      .then((result) => setPalmComparison(result))
      .catch((err) => {
        // Pro 2.5 was overloaded (502 / AI_OVERLOADED). PalmPage's compare
        // view picks up palmOverloaded and renders the cooldown card.
        if (err?.code === "AI_OVERLOADED") setPalmOverloaded(true);
      })
      .finally(() => setPalmAnalyzing(false));
  }

  function submit() {
    if (!ready) return;
    analyzeInBackground();
    // Both photos are kept in context; PalmPage will render the comparison
    // view (with scan animation while analyzing) when palmAnalyzing flips.
    navigate("/reading");
  }

  return (
    <div className="relative mx-auto max-w-140 px-4 py-8">
      <div className="cosmos"></div>
      <div className="stars"></div>

      <button
        type="button"
        onClick={() => navigate("/palm-step")}
        className="mb-4 cursor-pointer rounded-lg border border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.1)] px-4 py-2 text-xs text-[#a5b4fc]"
      >
        {EMOJIS.LEFT_ARROW} Back
      </button>

      {/* cosmic-card bottom margin (unlayered) overridden inline. */}
      <Card className="text-center" style={{ marginBottom: "1.5rem" }}>
        <h2 className="m-0 mb-2 text-2xl font-bold">{EMOJIS.HANDS} Full Life Comparison</h2>
        <p className="m-0 text-[13px] leading-[1.6] text-dim">
          Compare your left palm (the potential you were born with) against your right palm (how your choices
          have reshaped it). We'll read the gap between them.
        </p>
      </Card>

      <Card className="grid gap-3">
        {/* LEFT */}
        <button type="button" onClick={() => startPick("left")} className={CARD_BTN}>
          {left ? (
            <div className={THUMB}>
              <img src={left} alt="left palm" className="block h-full w-full object-cover" />
            </div>
          ) : (
            <span className="w-9 text-center text-[28px]">{EMOJIS.HAND_LEFT}</span>
          )}
          <span className="flex-1">
            <strong className="block text-[15px]">Step 1 · Left Hand</strong>
            <span className="text-xs text-dim">
              Potential — what you were born with{left ? " (tap to replace)" : ""}
            </span>
          </span>
          <span className="text-[22px] text-[#a855f7]">{left ? "✓" : EMOJIS.CHEVRON_RIGHT}</span>
        </button>

        {/* RIGHT */}
        <button
          type="button"
          onClick={() => startPick("right")}
          disabled={!left}
          className={CARD_BTN}
          // Locked-until-left state (opacity/cursor) is data-driven → inline.
          style={{ opacity: left ? 1 : 0.5, cursor: left ? "pointer" : "not-allowed" }}
        >
          {right ? (
            <div className={THUMB}>
              <img src={right} alt="right palm" className="block h-full w-full object-cover" />
            </div>
          ) : (
            <span className="w-9 text-center text-[28px]">{EMOJIS.HAND}</span>
          )}
          <span className="flex-1">
            <strong className="block text-[15px]">Step 2 · Right Hand</strong>
            <span className="text-xs text-dim">
              Reality — what you've shaped through choices{right ? " (tap to replace)" : ""}
            </span>
          </span>
          <span className="text-[22px] text-[#a855f7]">{right ? "✓" : EMOJIS.CHEVRON_RIGHT}</span>
        </button>

        <Button
          variant="magic"
          type="button"
          onClick={submit}
          disabled={!ready}
          fullWidth
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          {EMOJIS.SPARKLES} Read the Evolution
        </Button>

        <button type="button" onClick={() => navigate("/reading")} className={GHOST_BTN}>
          Skip → Go to my kundali
        </button>

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

        {error && <p className="mx-0 mt-2 mb-0 text-center text-[13px] text-danger">{error}</p>}
      </Card>

      <p className="mt-4 text-center text-[11px] leading-[1.6] text-muted">
        Tip: bright, even lighting and a clear view of each palm work best. Photos are analyzed and discarded
        — never stored.
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
              <span className="w-9 text-center text-[26px]">{EMOJIS.CAMERA}</span>
              <span className="flex-1">
                <strong className="block text-[15px]">Take a Photo</strong>
                <span className="text-xs text-dim">Use your camera</span>
              </span>
            </button>
            <button type="button" onClick={openGallery} className={CARD_BTN}>
              <span className="w-9 text-center text-[26px]">{EMOJIS.GALLERY}</span>
              <span className="flex-1">
                <strong className="block text-[15px]">Choose from Gallery</strong>
                <span className="text-xs text-dim">Pick an existing photo</span>
              </span>
            </button>
            <button type="button" onClick={() => setChooserOpen(false)} className={GHOST_BTN}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
