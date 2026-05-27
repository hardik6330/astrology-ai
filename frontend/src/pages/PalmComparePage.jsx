// Two-hand "Full Life Comparison" flow. Walks the user through picking a
// left-hand photo, then a right-hand photo, then kicks off the comparison
// analysis in the background and routes them to /palm where the synthesis
// renders. Mirrors PalmStepPage's UX (mobile chooser modal, file inputs)
// so it feels like a natural extension.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChart } from "../context/ChartContext";
import { comparePalms } from "../services/api";
import { gatePalmImage, warmUpGate } from "../utils/palmGate";

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch = typeof window !== "undefined" &&
    window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
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

const cardBtn = {
  display: "flex", alignItems: "center", gap: 16,
  padding: "16px 18px", borderRadius: 14,
  border: "1px solid rgba(168, 85, 247, 0.35)",
  background: "rgba(168, 85, 247, 0.08)",
  cursor: "pointer", color: "#fff", textAlign: "left", width: "100%",
};

const ghostBtn = {
  marginTop: 8, padding: "12px 16px", borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  cursor: "pointer", color: "#94a3b8", fontWeight: 600,
  width: "100%",
};

const thumb = {
  width: 96, height: 96, borderRadius: 12, overflow: "hidden",
  border: "1px solid rgba(168,85,247,0.35)",
};

export default function PalmComparePage() {
  const navigate = useNavigate();
  const {
    form,
    setPalmComparison,
    setPalmLeftPhoto, setPalmRightPhoto,
    setPalmAnalyzing,
    setPalmOverloaded,
  } = useChart();

  const [left, setLeft]   = useState(null);   // data URL
  const [right, setRight] = useState(null);   // data URL
  // Which slot is being picked into — drives the camera/gallery chooser.
  const [pickingHand, setPickingHand] = useState(null);  // "left" | "right" | null
  const [chooserOpen, setChooserOpen] = useState(false);
  const [error, setError] = useState("");

  const fileRef    = useRef(null);
  const cameraRef  = useRef(null);
  const galleryRef = useRef(null);

  const isMobile = useMemo(() => isMobileDevice(), []);
  const ready    = !!(left && right);

  // Warm up the MediaPipe model while the user is reading the intro.
  useEffect(() => { warmUpGate(); }, []);

  function startPick(hand) {
    setError("");
    setPickingHand(hand);
    if (isMobile) setChooserOpen(true);
    else fileRef.current?.click();
  }

  function openCamera()  { setChooserOpen(false); cameraRef.current?.click(); }
  function openGallery() { setChooserOpen(false); galleryRef.current?.click(); }

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
      if (pickingHand === "left")  { setLeft(dataUrl);  setPalmLeftPhoto(dataUrl); }
      if (pickingHand === "right") { setRight(dataUrl); setPalmRightPhoto(dataUrl); }
    } catch {
      setError("Couldn't read that photo. Try a different one.");
    }
    setPickingHand(null);
  }

  function analyzeInBackground() {
    setPalmAnalyzing(true);
    setPalmOverloaded(false);
    comparePalms(left, right, form)
      .then((result) => setPalmComparison(result))
      .catch((err) => {
        // Pro 2.5 was overloaded (502 / AI_OVERLOADED). PalmPage's compare
        // view picks up palmOverloaded and renders the cooldown card.
        if (err?.code === 'AI_OVERLOADED') setPalmOverloaded(true);
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
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem", position: "relative" }}>
      <div className="cosmos"></div>
      <div className="stars"></div>

      <button
        type="button"
        onClick={() => navigate("/palm-step")}
        style={{
          fontSize: 12, padding: "8px 16px", borderRadius: 8, cursor: "pointer", color: "#a5b4fc",
          border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", marginBottom: 16,
        }}
      >
        ← Back
      </button>

      <div className="cosmic-card" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
          ✋🤚 Full Life Comparison
        </h2>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
          Compare your left palm (the potential you were born with) against your right
          palm (how your choices have reshaped it). We'll read the gap between them.
        </p>
      </div>

      <div className="cosmic-card" style={{ display: "grid", gap: 12 }}>
        {/* LEFT */}
        <button type="button" onClick={() => startPick("left")} style={cardBtn}>
          {left ? (
            <div style={thumb}>
              <img src={left} alt="left palm" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          ) : (
            <span style={{ fontSize: 28, width: 36, textAlign: "center" }}>🤚</span>
          )}
          <span style={{ flex: 1 }}>
            <strong style={{ display: "block", fontSize: 15 }}>Step 1 · Left Hand</strong>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              Potential — what you were born with{left ? " (tap to replace)" : ""}
            </span>
          </span>
          <span style={{ fontSize: 22, color: "#a855f7" }}>{left ? "✓" : "›"}</span>
        </button>

        {/* RIGHT */}
        <button
          type="button"
          onClick={() => startPick("right")}
          disabled={!left}
          style={{ ...cardBtn, opacity: left ? 1 : 0.5, cursor: left ? "pointer" : "not-allowed" }}
        >
          {right ? (
            <div style={thumb}>
              <img src={right} alt="right palm" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          ) : (
            <span style={{ fontSize: 28, width: 36, textAlign: "center" }}>✋</span>
          )}
          <span style={{ flex: 1 }}>
            <strong style={{ display: "block", fontSize: 15 }}>Step 2 · Right Hand</strong>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              Reality — what you've shaped through choices{right ? " (tap to replace)" : ""}
            </span>
          </span>
          <span style={{ fontSize: 22, color: "#a855f7" }}>{right ? "✓" : "›"}</span>
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="magic-btn"
          style={{ width: "100%", opacity: ready ? 1 : 0.5, cursor: ready ? "pointer" : "not-allowed" }}
        >
          ✨ Read the Evolution
        </button>

        <button type="button" onClick={() => navigate("/reading")} style={ghostBtn}>
          Skip → Go to my kundali
        </button>

        <input ref={fileRef}    type="file" accept="image/*"                       onChange={onFileSelected} style={{ display: "none" }} />
        <input ref={cameraRef}  type="file" accept="image/*" capture="environment" onChange={onFileSelected} style={{ display: "none" }} />
        <input ref={galleryRef} type="file" accept="image/*"                       onChange={onFileSelected} style={{ display: "none" }} />

        {error && (
          <p style={{ color: "#f87171", fontSize: 13, textAlign: "center", margin: "8px 0 0" }}>{error}</p>
        )}
      </div>

      <p style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        Tip: bright, even lighting and a clear view of each palm work best. Photos are analyzed and discarded — never stored.
      </p>

      {chooserOpen && (
        <div
          onClick={() => setChooserOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480,
              background: "#0f0e20",
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              border: "1px solid rgba(168,85,247,0.35)",
              padding: 18, display: "grid", gap: 10,
            }}
          >
            <p style={{ color: "#94a3b8", textAlign: "center", margin: "4px 0 8px", fontSize: 13 }}>
              How would you like to add the photo?
            </p>
            <button type="button" onClick={openCamera} style={cardBtn}>
              <span style={{ fontSize: 26, width: 36, textAlign: "center" }}>📷</span>
              <span style={{ flex: 1 }}>
                <strong style={{ display: "block", fontSize: 15 }}>Take a Photo</strong>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Use your camera</span>
              </span>
            </button>
            <button type="button" onClick={openGallery} style={cardBtn}>
              <span style={{ fontSize: 26, width: 36, textAlign: "center" }}>🖼️</span>
              <span style={{ flex: 1 }}>
                <strong style={{ display: "block", fontSize: 15 }}>Choose from Gallery</strong>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Pick an existing photo</span>
              </span>
            </button>
            <button type="button" onClick={() => setChooserOpen(false)} style={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
