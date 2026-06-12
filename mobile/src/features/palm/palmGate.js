// Client-side palm-photo gate for React Native.
// Uses the NATIVE MediaPipe HandLandmarker (modules/hand-landmarker) to detect
// the hand and its 21 landmarks on a still photo. This replaces the old
// TensorFlow.js + MediaPipe-Hands path, which was unreliable on-device
// (estimateHands threw / crashed → no landmarks → no geometry hint and,
// in some builds, a white screen). The native detector is fast and stable.
//
// Quality checks (blur + brightness) are computed in the NATIVE module on a
// 256px downsample of the decoded bitmap — the old TFJS-tensor path JS used was
// the fragile code we removed, so the pixel work now lives in Kotlin/Swift where
// the Bitmap/UIImage is already in hand. The numbers (sharpness = Laplacian
// variance, brightness = mean luma) share the web gate's 256px space, so the
// thresholds match frontend/src/utils/palmGate.js. Keep the two in sync (CLAUDE.md).
//
// Check order: hand present → single hand → handedness → clarity → blur →
// coverage/crop/spread/orientation/flatness.

import * as ImageManipulator from "expo-image-manipulator";
import { detectHandLandmarks, warmUpHandLandmarker } from "../../../modules/hand-landmarker";

// Verbose per-photo gate diagnostics — dev only. Stays silent in release builds.
const log = __DEV__ ? console.log.bind(console) : () => {};

// ── Gate thresholds ──────────────────────────────────────────────────────────
// Quality metrics (sharpness/brightness) come from the native module, measured
// on a 256px downsample — SAME space as the web gate — so these thresholds match
// frontend/src/utils/palmGate.js. Keep the two in sync (CLAUDE.md).
const MIN_LUMINANCE = 55; // mean brightness below → too_dark
const MIN_LAPLACIAN_VAR = 160; // sharpness (Laplacian variance) below → blurry
const MIN_PALM_COVERAGE = 0.22; // palm bbox area ÷ frame; below → too_far
const GATE_RESIZE_W = 512; // pre-resize width; landmark coords are in this pixel space
const MIN_FINGER_SPREAD = 0.12; // min normalized distance between finger tips
const MAX_ORIENTATION_DEVIATION = 40; // max degrees away from vertical (up)

const TIPS = {
  not_a_palm: "Please upload a clear photo of your open hand, palm facing the camera.",
  too_far: "Bring the camera closer — your palm should fill most of the frame.",
  cropped: "Include your full palm — from wrist to fingertips — in the photo.",
  too_dark: "Find brighter, even lighting so your palm is clearly visible.",
  blurry: "Hold steady and take a sharp, focused photo of your palm.",
  wrong_hand: "The photo looks like your other hand — please retake with the hand you selected.",
  fingers_closed: "Spread your fingers naturally so the full palm is visible.",
  tilted_hand: "Keep your hand straight (fingers pointing up) and flat towards the camera.",
  multiple_hands: "Show just one open palm in the photo.",
};

// Determine handedness from LANDMARK GEOMETRY, not MediaPipe's label. MediaPipe
// reports handedness under a mirror (selfie) assumption that doesn't hold
// reliably across cameras/gallery imports, so we compute it ourselves: with the
// palm facing the camera and fingers pointing up (enforced by the orientation
// check), a NON-mirrored photo puts the thumb on the image-LEFT for a RIGHT hand
// and the image-RIGHT for a LEFT hand. Calibrated against real samples.
// Returns null when the thumb and pinky aren't clearly separated horizontally
// (hand rotated / pointing at the camera) — too ambiguous to hard-reject on.
function geometricHand(landmarks) {
  const thumbTip = landmarks[4];
  const pinkyMcp = landmarks[17];
  const palmWidth = Math.abs(landmarks[5].x - landmarks[17].x) || 1;
  const dx = thumbTip.x - pinkyMcp.x;
  if (Math.abs(dx) < palmWidth * 0.15) return null; // too ambiguous to call
  return dx < 0 ? "Right" : "Left";
}

function reject(rejectReason, debugInfo = "", duration = 0) {
  const response = {
    ok: false,
    rejectReason,
    retakeReason: TIPS[rejectReason] || "Please retake with a clearer palm photo.",
  };
  log(`Gate: Final Result -> REJECTED (Time: ${duration}ms)`, { reason: rejectReason, debug: debugInfo });
  return response;
}

function landmarkBounds(landmarks, imgW, imgH) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
    minX, minY, maxX, maxY,
  };
}

function checkFingerSpread(landmarks) {
  const p5 = landmarks[5];
  const p17 = landmarks[17];
  const palmWidth = Math.sqrt((p5.x - p17.x) ** 2 + (p5.y - p17.y) ** 2);
  const tips = [8, 12, 16, 20];
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
  const p0 = landmarks[0];
  const p9 = landmarks[9];
  const angle = (Math.atan2(p9.y - p0.y, p9.x - p0.x) * 180) / Math.PI;
  const deviation = Math.abs(angle + 90);
  return deviation <= MAX_ORIENTATION_DEVIATION;
}

function checkFlatness(landmarks) {
  const p5 = landmarks[5];
  const p17 = landmarks[17];
  const p0 = landmarks[0];
  const p9 = landmarks[9];
  const w = Math.sqrt((p5.x - p17.x) ** 2 + (p5.y - p17.y) ** 2);
  const h = Math.sqrt((p0.x - p9.x) ** 2 + (p0.y - p9.y) ** 2);
  const ratio = w / h;
  // Widened from 0.6–1.4 to tolerate a hand held at an angle / slightly
  // foreshortened (was producing false "tilted_hand" rejects).
  return ratio > 0.45 && ratio < 1.8;
}

// Gate a single palm photo. Returns:
//   { ok: true, landmarks: [{x,y,z}], imgW, imgH, checks }   when usable
//   { ok: false, rejectReason, retakeReason }                otherwise
// landmarks are in PIXEL coords of the resized image — same space as the web
// gate — so the backend landmark-geometry embedding matches across platforms.
export async function gatePalmImage(asset, claimedHand) {
  const startTime = Date.now();
  log("Gate: Starting native detection flow...");

  try {
    // Pre-resize so the native decode + detect is fast and the landmark pixel
    // space is consistent (width = GATE_RESIZE_W). No base64 needed — the native
    // module reads the file URI directly.
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: GATE_RESIZE_W } }],
      { format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 },
    );
    log(`Gate: Pre-resize done in ${Date.now() - startTime}ms`);

    const { landmarks, handedness, score, sharpness, brightness, handCount, width, height } = await detectHandLandmarks(manipulated.uri);
    log(`Gate: Native detect done in ${Date.now() - startTime}ms — hands=${handCount} handScore=${score?.toFixed(2)} handedness=${handedness} sharp=${sharpness?.toFixed(0)} bright=${brightness?.toFixed(0)} (${width}x${height})`);

    // ── Order: hand present → single hand → HANDEDNESS → CLARITY → BLUR →
    // geometry. Verify the right hand and a usable photo BEFORE the finer
    // geometry checks, so the user gets the most fundamental problem first.

    // 1. Hand present.
    if (!Array.isArray(landmarks) || landmarks.length < 21) {
      return reject("not_a_palm", `points=${landmarks?.length || 0}`, Date.now() - startTime);
    }

    // 2. Single hand.
    if (handCount > 1) {
      return reject("multiple_hands", `Found ${handCount} hands`, Date.now() - startTime);
    }

    // 3. Handedness — does the photo match the hand the user picked? Computed
    // from landmark geometry (see geometricHand), not MediaPipe's mirror-prone
    // label. Skipped only when the call is too ambiguous (returns null).
    const detectedHand = geometricHand(landmarks);
    if (claimedHand && detectedHand) {
      log(`Gate: Handedness -> claimed=${claimedHand}, detected=${detectedHand} (mp=${handedness})`);
      if (detectedHand !== claimedHand) {
        return reject("wrong_hand", `Detected ${detectedHand} vs Claimed ${claimedHand}`, Date.now() - startTime);
      }
    }

    // 4. Clarity — bright enough to read the lines?
    if (typeof brightness === "number" && brightness < MIN_LUMINANCE) {
      return reject("too_dark", `Brightness ${Math.round(brightness)}`, Date.now() - startTime);
    }

    // 5. Blur — sharp enough? (real Laplacian variance from the native module).
    if (typeof sharpness === "number" && sharpness < MIN_LAPLACIAN_VAR) {
      return reject("blurry", `Sharpness ${Math.round(sharpness)}`, Date.now() - startTime);
    }

    const bounds = landmarkBounds(landmarks, width, height);
    log("Gate: Coverage:", bounds.coverage);

    // 6. Palm too small in frame.
    if (bounds.coverage < MIN_PALM_COVERAGE) {
      return reject("too_far", `Coverage ${Math.round(bounds.coverage * 100)}%`, Date.now() - startTime);
    }

    // 7. Palm runs off-edge.
    const pad = 4;
    if (bounds.minX < pad || bounds.minY < pad ||
        bounds.maxX > width - pad || bounds.maxY > height - pad) {
      return reject("cropped", "Hand touching edge", Date.now() - startTime);
    }

    // 8. Fingers spread / orientation / flatness.
    const fingersSpread = checkFingerSpread(landmarks);
    const orientationOk = checkOrientation(landmarks);
    const flatnessOk = checkFlatness(landmarks);

    if (!fingersSpread) {
      return reject("fingers_closed", "Tips too close", Date.now() - startTime);
    }
    if (!orientationOk || !flatnessOk) {
      return reject("tilted_hand", `angle/ratio fail`, Date.now() - startTime);
    }

    log(`Gate: Final Result -> PASSED (Total Time: ${Date.now() - startTime}ms)`);
    const checks = [
      { key: "multiple_hands", ok: handCount === 1, label: handCount > 1 ? "Multiple hands detected" : "Single hand detected" },
      { key: "landmarks", ok: true, label: `${landmarks.length} hand landmarks detected` },
      { key: "handedness", ok: true, label: `Correct hand (${detectedHand || "unknown"})` },
      { key: "brightness", ok: true, label: `Lighting OK (brightness ${Math.round(brightness ?? 0)})` },
      { key: "sharpness", ok: true, label: `Sharp focus (score ${Math.round(sharpness ?? 0)})` },
      { key: "coverage", ok: true, label: `Palm fills frame (${Math.round(bounds.coverage * 100)}%)` },
      { key: "spread", ok: true, label: "Fingers spread open" },
      { key: "straight", ok: true, label: "Hand straight and flat" },
    ];
    return { ok: true, landmarks, imgW: width, imgH: height, checks };
  } catch (err) {
    // Fail OPEN so a detector crash never blocks a reading — but carry the error
    // out so the caller can surface WHY no landmarks were produced.
    const gateError = String(err?.message || err);
    console.warn("Palm gate (native) error — falling back to PASS:", gateError);
    return { ok: true, gateError };
  }
}

// Warm the native detector (loads the ~7 MB model) so the first gate is fast.
export function warmUpGate() {
  warmUpHandLandmarker().catch(() => {});
}

// Awaitable model readiness — callers await this BEFORE gating so the first
// inference isn't paying the model-load cost.
export function ensureGate() {
  return warmUpHandLandmarker();
}
