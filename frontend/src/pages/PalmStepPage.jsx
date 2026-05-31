// Onboarding step shown between the birth-detail form and the kundali
// reading. The user can upload a palm photo (right or left) which is
// analysed in the background while they read their kundali, or skip
// straight to the reading. Hand-side is a UI label only — not sent to AI.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChart } from "../context/ChartContext";
import { analyzePalm } from "../services/api";
import { gatePalmImage, warmUpGate } from "../utils/palmGate";

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

const cardBtn = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "16px 18px",
  borderRadius: 14,
  border: "1px solid rgba(168, 85, 247, 0.35)",
  background: "rgba(168, 85, 247, 0.08)",
  cursor: "pointer",
  color: "#fff",
  textAlign: "left",
  width: "100%",
};

const skipBtn = {
  marginTop: 8,
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  cursor: "pointer",
  color: "#94a3b8",
  fontWeight: 600,
  width: "100%",
};

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
    analyzePalm(dataUrl, form, hand)
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
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem", position: "relative" }}>
      <div className="cosmos"></div>
      <div className="stars"></div>

      <div className="cosmic-card" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>✋ Add a Palm Reading?</h2>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
          Optional — we'll analyse your palm while your kundali is being built.
        </p>
      </div>

      <div className="cosmic-card" style={{ display: "grid", gap: 12 }}>
        <button type="button" onClick={() => onHandTap("Right")} disabled={busy} style={cardBtn}>
          <span style={{ fontSize: 28, width: 36, textAlign: "center" }}>✋</span>
          <span style={{ flex: 1 }}>
            <strong style={{ display: "block", fontSize: 15 }}>Right Hand</strong>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              {isMobile ? "Take a photo or pick from gallery" : "Upload a clear photo of your right palm"}
            </span>
          </span>
          <span style={{ fontSize: 22, color: "#a855f7" }}>›</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/palm-compare")}
          disabled={busy}
          style={{
            ...cardBtn,
            border: "1px solid rgba(192, 132, 252, 0.55)",
            background: "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(99,102,241,0.18))",
          }}
        >
          <span style={{ fontSize: 28, width: 36, textAlign: "center" }}>✋🤚</span>
          <span style={{ flex: 1 }}>
            <strong style={{ display: "block", fontSize: 15 }}>Both Hands · Full Life Comparison</strong>
            <span style={{ fontSize: 12, color: "#c4b5fd" }}>
              Compare your inborn potential against your current reality
            </span>
          </span>
          <span style={{ fontSize: 22, color: "#c084fc" }}>›</span>
        </button>

        <button type="button" onClick={() => onHandTap("Left")} disabled={busy} style={cardBtn}>
          <span style={{ fontSize: 28, width: 36, textAlign: "center" }}>🤚</span>
          <span style={{ flex: 1 }}>
            <strong style={{ display: "block", fontSize: 15 }}>Left Hand</strong>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              {isMobile ? "Take a photo or pick from gallery" : "Upload a clear photo of your left palm"}
            </span>
          </span>
          <span style={{ fontSize: 22, color: "#a855f7" }}>›</span>
        </button>

        <button type="button" onClick={goToReading} disabled={busy} style={skipBtn}>
          Skip → Go to my kundali
        </button>

        {/* Desktop: single file input. Mobile: separate inputs so the
            camera-capture attribute only applies to the camera button. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onFileSelected}
          style={{ display: "none" }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileSelected}
          style={{ display: "none" }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          onChange={onFileSelected}
          style={{ display: "none" }}
        />

        {busy && (
          <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "8px 0 0" }}>
            Reading photo…
          </p>
        )}
        {error && (
          <p style={{ color: "#f87171", fontSize: 13, textAlign: "center", margin: "8px 0 0" }}>{error}</p>
        )}
      </div>

      <p style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
        Tip: bright, even lighting and a clear view of the palm work best.
      </p>

      {chooserOpen && (
        <div
          onClick={() => setChooserOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#0f0e20",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              border: "1px solid rgba(168,85,247,0.35)",
              padding: 18,
              display: "grid",
              gap: 10,
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
            <button type="button" onClick={() => setChooserOpen(false)} style={skipBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
