// Client-side palm-photo gate. Replaces the server-side Gemini Flash gate
// for web uploads — runs MediaPipe Hands locally in the browser to detect
// hand presence/quality, plus two pure-pixel heuristics (Laplacian variance
// for blur, mean luminance for darkness).
//
// Returns a result with the SAME shape as the old backend gate, so the
// existing REJECT_INFO mapping on the UI works unchanged:
//   { ok: true }
//   { ok: false, rejectReason: '<key>', retakeReason: '<one sentence>' }

import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";

// Memoized model — loaded once per page session, kept warm in module scope.
let _detector = null;
let _detectorPromise = null;

async function getDetector() {
  if (_detector) return _detector;
  if (_detectorPromise) return _detectorPromise;
  _detectorPromise = (async () => {
    await tf.setBackend("webgl");
    await tf.ready();
    _detector = await handPoseDetection.createDetector(
      handPoseDetection.SupportedModels.MediaPipeHands,
      {
        runtime: "tfjs",
        modelType: "lite",      // smaller (~6MB) and faster — accuracy plenty for a gate
        maxHands: 2,            // we need to detect multi-hand for rejection
      },
    );
    return _detector;
  })();
  return _detectorPromise;
}

// Convert a File → HTMLImageElement (decoded, sized as-is).
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode_failed")); };
    img.src = url;
  });
}

// Downsample to a small canvas for fast heuristic checks (no need for full
// resolution to compute mean luminance or a Laplacian).
function toSmallCanvas(img, maxDim = 256) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas;
}

// Mean luminance (0-255). < ~45 indicates the photo is too dim to read lines.
function meanLuminance(canvas) {
  const { width, height } = canvas;
  const { data } = canvas.getContext("2d").getImageData(0, 0, width, height);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return sum / (data.length / 4);
}

// Variance of a 3x3 Laplacian (edge response) over the grayscale image.
// Low variance → smooth/out-of-focus image. Threshold ~120 works well for
// downsampled palm photos (much lower for full-res; we sample at 256px).
function laplacianVariance(canvas) {
  const { width: w, height: h } = canvas;
  const { data } = canvas.getContext("2d").getImageData(0, 0, w, h);

  // Build a grayscale array first.
  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }

  // Apply 3x3 Laplacian [0,1,0; 1,-4,1; 0,1,0].
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return (sumSq / n) - (mean * mean);
}

// Bounding box of a set of MediaPipe landmarks (image-space x/y).
function landmarkBounds(landmarks, imgW, imgH) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    width:  maxX - minX,
    height: maxY - minY,
    coverage: ((maxX - minX) * (maxY - minY)) / (imgW * imgH),
    minX, minY, maxX, maxY,
  };
}

// Friendly retake copy keyed to the reject reason — matches the existing
// REJECT_INFO copy on the UI so the wording stays consistent.
const TIPS = {
  too_dark:       "Move into bright, even light so the lines on your palm are clearly visible.",
  blurry:         "Hold steady and take a sharp, focused photo of your palm.",
  not_a_palm:     "Please upload a clear photo of your open hand, palm facing the camera.",
  multiple_hands: "Show just one open palm in the photo.",
  too_far:        "Bring the camera closer — your palm should fill most of the frame.",
  cropped:        "Include your full palm — from wrist to fingertips — in the photo.",
  wrong_hand:     "The photo looks like your other hand — please retake with the hand you selected.",
};

// MediaPipe handedness is reported from the OPPOSITE side because the model
// assumes a mirrored image (selfie convention). With `flipHorizontal: false`
// on a non-mirrored photo, the convention is: model says "Right" → it's
// actually a LEFT hand, and vice versa. We invert below for the comparison.
// Confidence below this threshold → don't reject (mirror cameras + edge
// cases make low-confidence calls unreliable).
const HAND_REJECT_MIN_CONFIDENCE = 0.95;

function reject(rejectReason) {
  return { ok: false, rejectReason, retakeReason: TIPS[rejectReason] || "Please retake with a clearer palm photo." };
}

/**
 * Run the full gate on a File. Returns { ok: true } or { ok: false,
 * rejectReason, retakeReason }. NEVER throws — internal failures resolve
 * as { ok: true } so we always fall through to upload rather than block
 * the user on a model error.
 *
 * @param {File}   file        The user-picked image file.
 * @param {string} claimedHand Optional "Left" | "Right" — if set, the
 *   gate will reject when MediaPipe is highly confident the photo shows
 *   the opposite hand. Skipped under the confidence threshold to avoid
 *   false positives from mirror-camera selfies.
 */
export async function gatePalmImage(file, claimedHand) {
  let img;
  try {
    img = await fileToImage(file);
  } catch {
    // Can't decode → let backend handle it (validateImage will throw 400).
    return { ok: true };
  }

  // 1. Cheap pixel heuristics first.
  const small = toSmallCanvas(img, 256);
  const lum = meanLuminance(small);
  if (lum < 45) return reject("too_dark");

  const lapVar = laplacianVariance(small);
  if (lapVar < 100) return reject("blurry");

  // 2. MediaPipe hand detection.
  let hands = [];
  try {
    const detector = await getDetector();
    hands = await detector.estimateHands(img, { flipHorizontal: false });
  } catch {
    // Model load/inference failed — fall through (let Pro see the image).
    return { ok: true };
  }

  if (hands.length === 0)   return reject("not_a_palm");
  if (hands.length > 1)     return reject("multiple_hands");

  const hand = hands[0];
  if (!hand?.keypoints || hand.keypoints.length < 21) return reject("not_a_palm");
  const bounds = landmarkBounds(hand.keypoints, img.width, img.height);

  // 3. Palm too small in frame.
  if (bounds.coverage < 0.18) return reject("too_far");

  // 4. Palm runs off-edge — wrist or fingertips outside.
  const pad = 4;   // px tolerance
  if (bounds.minX < pad || bounds.minY < pad ||
      bounds.maxX > img.width - pad || bounds.maxY > img.height - pad) {
    return reject("cropped");
  }

  // 5. Hand-side check — only when the caller passed claimedHand AND
  // MediaPipe is highly confident. MediaPipe reports handedness from a
  // mirrored-image POV (since most webcams self-mirror), so when we feed
  // a non-mirrored file the model's "Right" maps to a real LEFT hand
  // (and vice versa). Invert before comparing.
  if (claimedHand && hand.handedness && hand.score >= HAND_REJECT_MIN_CONFIDENCE) {
    const modelLabel  = hand.handedness;                       // "Left" or "Right" per the model
    const actualLabel = modelLabel === "Left" ? "Right" : "Left"; // invert for non-mirrored image
    if (actualLabel !== claimedHand) {
      return reject("wrong_hand");
    }
  }

  return { ok: true };
}

// Eager-load the model in the background (e.g. when the Palm page mounts)
// so the first user upload doesn't pay the load cost.
export function warmUpGate() {
  getDetector().catch(() => { /* swallow — gate will retry on first use */ });
}
