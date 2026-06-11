// Client-side palm-photo gate. Replaces the server-side Gemini Flash gate
// for web uploads — runs MediaPipe Hands locally in the browser to detect
// hand presence/quality, plus two pure-pixel heuristics (Laplacian variance
// for blur, mean luminance for darkness).
//
// Returns a result with the SAME shape as the old backend gate, so the
// existing REJECT_INFO mapping on the UI works unchanged:
//   { ok: true }
//   { ok: false, rejectReason: '<key>', retakeReason: '<one sentence>' }

import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// ── Gate thresholds ──────────────────────────────────────────────────────────
// Luminance + blur run on the 256px downsample. The two palm-quality checks
// (lighting evenness, line detail) run ONLY on the detected palm region — never
// the whole frame — so palm-vs-background contrast can't skew them. Set
// GATE_DEBUG=true to log the live values for a photo; calibrate from those.
// Mobile (mobile/src/features/palm/palmGate.js) MUST mirror these.
const GATE_DEBUG = false; // true → console.debug every metric per photo
const MIN_LUMINANCE = 55; // mean luma below → too_dark
const MIN_LAPLACIAN_VAR = 160; // global focus; below → blurry
const MIN_PALM_COVERAGE = 0.22; // palm bbox area ÷ frame; below → too_far
// Palm-region checks (measured INSIDE the bounding box, so background contrast
// never skews them). edgeScore = Laplacian variance of the palm crop (line
// detail); lightingVar = luminance variance of a 9x9 low-frequency grid (broad
// shadow/glare). Both display their raw value in the gate checklist.
const MIN_PALM_EDGE_SCORE = 90; // below → lines_faint
const MAX_PALM_LIGHTING_VAR = 2800; // above → uneven_light
const MIN_FINGER_SPREAD = 0.12; // min normalized distance between finger tips
const MAX_ORIENTATION_DEVIATION = 55; // max degrees away from vertical (up)
const PALM_NORM_W = 200; // palm crop width for the in-region metrics
// (resolution-independent: web 256 ≈ mobile 512).

// Memoized model — loaded once per page session, kept warm in module scope.
let _detector = null;
let _detectorPromise = null;

async function getDetector() {
  if (_detector) return _detector;
  if (_detectorPromise) return _detectorPromise;
  _detectorPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
    );
    _detector = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numHands: 2,
    });
    return _detector;
  })();
  return _detectorPromise;
}

// Convert a File → HTMLImageElement (decoded, sized as-is).
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode_failed"));
    };
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
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas;
}

// Mean luminance (0-255). < MIN_LUMINANCE indicates the photo is too dim to
// read lines. (Lighting *evenness* is judged separately, inside the palm.)
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
  let sum = 0,
    sumSq = 0,
    n = 0;
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
  return sumSq / n - mean * mean;
}

// Quality metrics measured INSIDE the palm bounding box only (so background
// contrast never skews them). `bounds` are in full-image (img) coordinates.
//   - edgeScore — Laplacian variance of a width-normalized palm crop. High =
//     crisp lines; low = washed-out/faint (a global blur check can pass when
//     only the background is sharp). Resolution-independent via PALM_NORM_W.
//   - lightingVar — luminance variance of a 9x9 low-frequency grid of the crop
//     (line detail averaged out). High only when part of the palm is in harsh
//     shadow or glare relative to the rest.
// Returns { edgeScore: Infinity, lightingVar: 0 } when the box is too small to
// judge, so a tiny detection never trips a false reject.
function palmRegionStats(img, bounds) {
  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  if (bw < 8 || bh < 8) return { edgeScore: Infinity, lightingVar: 0 };

  // Width-normalized palm crop.
  const scale = PALM_NORM_W / bw;
  const w = Math.max(3, Math.round(bw * scale));
  const h = Math.max(3, Math.round(bh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, bounds.minX, bounds.minY, bw, bh, 0, 0, w, h);

  // Line detail = Laplacian variance of the palm crop.
  const edgeScore = laplacianVariance(canvas);

  // Lighting evenness = luminance variance of a tiny 9x9 grid (only broad
  // brightness gradients survive the downsample; line texture averages out).
  const G = 9;
  const grid = document.createElement("canvas");
  grid.width = G;
  grid.height = G;
  grid.getContext("2d").drawImage(canvas, 0, 0, G, G);
  const gd = grid.getContext("2d").getImageData(0, 0, G, G).data;
  let gs = 0,
    gsq = 0;
  for (let i = 0; i < gd.length; i += 4) {
    const l = 0.2126 * gd[i] + 0.7152 * gd[i + 1] + 0.0722 * gd[i + 2];
    gs += l;
    gsq += l * l;
  }
  const gm = gs / (G * G);
  const lightingVar = Math.max(0, gsq / (G * G) - gm * gm);

  return { edgeScore, lightingVar };
}

// Bounding box of a set of MediaPipe landmarks (image-space x/y).
function landmarkBounds(landmarks, imgW, imgH) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    width: maxX - minX,
    height: maxY - minY,
    coverage: ((maxX - minX) * (maxY - minY)) / (imgW * imgH),
    minX,
    minY,
    maxX,
    maxY,
  };
}

// Friendly retake copy keyed to the reject reason — matches the existing
// REJECT_INFO copy on the UI so the wording stays consistent.
const TIPS = {
  too_dark: "Move into bright, even light so the lines on your palm are clearly visible.",
  blurry: "Hold steady and take a sharp, focused photo of your palm.",
  not_a_palm: "Please upload a clear photo of your open hand, palm facing the camera.",
  multiple_hands: "Show just one open palm in the photo.",
  too_far: "Bring the camera closer — your palm should fill most of the frame.",
  cropped: "Include your full palm — from wrist to fingertips — in the photo.",
  wrong_hand: "The photo looks like your other hand — please retake with the hand you selected.",
  lines_faint:
    "Take a sharp photo of your real hand in bright light — a photo of a screen won't have enough line detail.",
  uneven_light: "Even out the lighting — avoid harsh shadow or glare falling across your palm.",
  fingers_closed: "Spread your fingers naturally so the full palm is visible.",
  tilted_hand: "Keep your hand straight (fingers pointing up) and flat towards the camera.",
};

// MediaPipe handedness is reported from the OPPOSITE side because the model
// assumes a mirrored image (selfie convention). With `flipHorizontal: false`
// on a non-mirrored photo, the convention is: model says "Right" → it's
// actually a LEFT hand, and vice versa. We invert below for the comparison.
// Confidence below this threshold → don't reject (mirror cameras + edge
// cases make low-confidence calls unreliable).
const HAND_REJECT_MIN_CONFIDENCE = 0.95;

function checkFingerSpread(landmarks) {
  const p5 = landmarks[5]; // Index base
  const p17 = landmarks[17]; // Pinky base
  const palmWidth = Math.sqrt((p5.x - p17.x) ** 2 + (p5.y - p17.y) ** 2);

  const tips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky tips
  let minGap = Infinity;

  for (let i = 0; i < tips.length - 1; i++) {
    const t1 = landmarks[tips[i]];
    const t2 = landmarks[tips[i + 1]];
    const dist = Math.sqrt((t1.x - t2.x) ** 2 + (t1.y - t2.y) ** 2);
    const normalized = dist / palmWidth;
    if (normalized < minGap) minGap = normalized;
  }

  return minGap >= MIN_FINGER_SPREAD;
}

function checkOrientation(landmarks) {
  const p0 = landmarks[0]; // Wrist
  const p9 = landmarks[9]; // Middle base

  // Angle in degrees. Math.atan2(dy, dx)
  // Upwards in screen space is dy < 0, dx = 0 -> -90 degrees
  const angle = (Math.atan2(p9.y - p0.y, p9.x - p0.x) * 180) / Math.PI;

  // Deviation from -90
  const deviation = Math.abs(angle + 90);
  return deviation <= MAX_ORIENTATION_DEVIATION;
}

// Simple flatness check: ratio of palm width to palm height.
// If too skewed, the hand is likely tilted away from the camera.
function checkFlatness(landmarks) {
  const p5 = landmarks[5];
  const p17 = landmarks[17];
  const p0 = landmarks[0];
  const p9 = landmarks[9];

  const w = Math.sqrt((p5.x - p17.x) ** 2 + (p5.y - p17.y) ** 2);
  const h = Math.sqrt((p0.x - p9.x) ** 2 + (p0.y - p9.y) ** 2);

  const ratio = w / h;
  // Normal palm ratio is roughly 0.8 to 1.2; widened to tolerate a hand held
  // at an angle / slightly foreshortened (false "tilted_hand" rejects).
  return ratio > 0.45 && ratio < 1.8;
}

function retakeFor(reason) {
  return TIPS[reason] || "Please retake with a clearer palm photo.";
}

/**
 * Run the full gate on a File. Computes EVERY metric (never short-circuits) so
 * the UI can render a per-check diagnostic list. Returns:
 *   { ok, checks, landmarks?, imgW, imgH, rejectReason?, retakeReason? }
 * where `checks` is an ordered [{ key, ok, label }] for the checklist UI and
 * `landmarks` (image-pixel coords) drives the skeleton overlay. NEVER throws —
 * decode/model failures resolve as { ok: true, checks: [] } so we always fall
 * through to upload rather than block the user on an internal error.
 *
 * @param {File}   file        The user-picked image file.
 * @param {string} claimedHand Optional "Left" | "Right" — if set, the gate
 *   rejects when MediaPipe is highly confident the photo shows the opposite
 *   hand. Skipped under the confidence threshold (mirror-camera false positives).
 */
export async function gatePalmImage(file, claimedHand) {
  let img;
  try {
    img = await fileToImage(file);
  } catch {
    // Can't decode → let backend handle it (validateImage will throw 400).
    return { ok: true, checks: [] };
  }

  // Global pixel metrics (whole 256px downsample).
  const small = toSmallCanvas(img, 256);
  const lum = meanLuminance(small);
  const lapVar = laplacianVariance(small);

  // MediaPipe hand detection.
  let hands;
  try {
    const detector = await getDetector();
    const result = detector.detect(img);

    // Convert normalized landmarks to pixel coordinates to match the gate's
    // coordinate space (same as the old TFJS detector).
    hands = result.landmarks.map((points, idx) => {
      const handedness = result.handedness[idx]?.[0];
      return {
        keypoints: points.map((p) => ({
          x: p.x * img.width,
          y: p.y * img.height,
          z: p.z,
        })),
        score: handedness?.score || 0,
        handedness: handedness?.categoryName || "Unknown",
      };
    });
  } catch (err) {
    console.warn("Gate: Model inference failed", err);
    // Model load/inference failed — fall through (let Pro see the image).
    return { ok: true, checks: [] };
  }

  const handCount = hands.length;
  const hand = hands[0];
  const hasHand = handCount === 1 && hand?.keypoints?.length >= 21;

  const bounds = hasHand ? landmarkBounds(hand.keypoints, img.width, img.height) : null;
  const region = hasHand ? palmRegionStats(img, bounds) : null;
  const fingersSpread = hasHand ? checkFingerSpread(hand.keypoints) : false;
  const orientationOk = hasHand ? checkOrientation(hand.keypoints) : false;
  const flatnessOk = hasHand ? checkFlatness(hand.keypoints) : false;

  const pad = 4; // px tolerance for the off-edge (cropped) test
  const cropped = bounds
    ? bounds.minX < pad ||
      bounds.minY < pad ||
      bounds.maxX > img.width - pad ||
      bounds.maxY > img.height - pad
    : false;

  // Hand-side check.
  // MediaPipe Tasks Vision handedness is usually the ACTUAL handedness (non-mirrored).
  let wrongHand = false;
  if (hasHand && claimedHand && hand.handedness && hand.score >= HAND_REJECT_MIN_CONFIDENCE) {
    wrongHand = hand.handedness !== claimedHand;
  }

  // User-facing checklist (astro-2 order). `cropped` + `wrong_hand` are enforced
  // below but kept off the list to match the reference UI.
  const checks = [
    handCount > 1
      ? { key: "multiple_hands", ok: false, label: "More than one hand detected" }
      : hasHand
        ? { key: "landmarks", ok: true, label: `${hand.keypoints.length} hand landmarks detected` }
        : { key: "not_a_palm", ok: false, label: "No clear hand detected" },
    {
      key: "lighting",
      ok: lum >= MIN_LUMINANCE,
      label: `Lighting ${lum >= MIN_LUMINANCE ? "OK" : "too dark"} (${Math.round(lum)} / 255)`,
    },
    {
      key: "sharpness",
      ok: lapVar >= MIN_LAPLACIAN_VAR,
      label: `Sharpness ${lapVar >= MIN_LAPLACIAN_VAR ? "OK" : "low"} (variance ${Math.round(lapVar)})`,
    },
  ];
  if (hasHand) {
    checks.push(
      {
        key: "coverage",
        ok: bounds.coverage >= MIN_PALM_COVERAGE,
        label: `Palm fills frame (${Math.round(bounds.coverage * 100)}%)`,
      },
      {
        key: "edge",
        ok: region.edgeScore >= MIN_PALM_EDGE_SCORE,
        label: `Palm lines visible (edge score ${Math.round(region.edgeScore)})`,
      },
      {
        key: "lighting_even",
        ok: region.lightingVar <= MAX_PALM_LIGHTING_VAR,
        label: `Even lighting (variance ${Math.round(region.lightingVar)})`,
      },
      {
        key: "spread",
        ok: fingersSpread,
        label: "Fingers spread open",
      },
      {
        key: "straight",
        ok: orientationOk && flatnessOk,
        label: "Hand straight and flat",
      }
    );
  }

  if (GATE_DEBUG) {
    console.debug("[palmGate]", {
      handCount,
      lum: +lum.toFixed(1),
      lapVar: +lapVar.toFixed(0),
      coverage: bounds ? +bounds.coverage.toFixed(3) : null,
      edgeScore: region ? +region.edgeScore.toFixed(1) : null,
      lightingVar: region ? +region.lightingVar.toFixed(1) : null,
      cropped,
      wrongHand,
    });
  }

  // First failing gate, in severity order → the reason surfaced to the user.
  let rejectReason = null;
  if (handCount > 1) rejectReason = "multiple_hands";
  else if (!hasHand) rejectReason = "not_a_palm";
  else if (lum < MIN_LUMINANCE) rejectReason = "too_dark";
  else if (lapVar < MIN_LAPLACIAN_VAR) rejectReason = "blurry";
  else if (bounds.coverage < MIN_PALM_COVERAGE) rejectReason = "too_far";
  else if (cropped) rejectReason = "cropped";
  else if (region.edgeScore < MIN_PALM_EDGE_SCORE) rejectReason = "lines_faint";
  else if (region.lightingVar > MAX_PALM_LIGHTING_VAR) rejectReason = "uneven_light";
  else if (!fingersSpread) rejectReason = "fingers_closed";
  else if (!orientationOk || !flatnessOk) rejectReason = "tilted_hand";
  else if (wrongHand) rejectReason = "wrong_hand";

  const base = {
    checks,
    landmarks: hasHand ? hand.keypoints : undefined,
    imgW: img.width,
    imgH: img.height,
  };
  if (rejectReason) {
    return { ok: false, rejectReason, retakeReason: retakeFor(rejectReason), ...base };
  }
  return { ok: true, ...base };
}

// Eager-load the model in the background (e.g. when the Palm page mounts)
// so the first user upload doesn't pay the load cost.
export function warmUpGate() {
  getDetector().catch(() => {
    /* swallow — gate will retry on first use */
  });
}

/**
 * Awaitable model readiness. Callers await this BEFORE gating so the gate
 * reliably produces landmarks (instead of racing a timeout that drops them).
 * Resolves the detector, or rejects if the model genuinely can't load.
 */
export function ensureGate() {
  return getDetector();
}
