// Small helpers shared by the palm screens (upload pipeline + device checks).

import { useEffect, useState } from "react";

// Resize an image File to max 800px on the long edge, output JPEG base64.
// Keeps the upload small + speeds up the Gemini call.
export function resizeToBase64(file, maxDim = 600, quality = 0.8) {
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

// Resolve `promise`, or reject with a timeout error after `ms`.
export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("gate timeout")), ms)),
  ]);
}

// Detect whether to offer a "Take Photo" (camera) button alongside upload.
// We show camera only on devices that (a) report a video input AND (b) look
// touch-first (mobile/tablet) — laptops with webcams keep just the upload
// button since taking a palm selfie with a built-in webcam is awkward.
export function useCameraSupport() {
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
