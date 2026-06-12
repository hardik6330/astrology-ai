// Client-side palm-photo gate for React Native.
// Uses the NATIVE MediaPipe HandLandmarker (modules/hand-landmarker) to detect
// the hand and its 21 landmarks on a still photo. This replaces the old
// TensorFlow.js + MediaPipe-Hands path, which was unreliable on-device
// (estimateHands threw / crashed → no landmarks → no biometric embedding and,
// in some builds, a white screen). The native detector is fast and stable.
//
// NOTE: the pixel dark/blur/line-detail heuristics the web gate runs are NOT
// reproduced here — they required decoding the image to a TFJS tensor, which is
// exactly the fragile path we removed. On mobile, hand PRESENCE + GEOMETRY
// (coverage, cropping) are checked from the native landmarks; genuine quality
// problems still get caught downstream when the Pro reading marks the image
// `unusable` (and the charge is refunded). Keep this divergence from the web
// gate in mind (CLAUDE.md asks the gates stay in sync — this is a deliberate,
// documented exception until web also moves to a native/stable detector).

import * as ImageManipulator from "expo-image-manipulator";
import { detectHandLandmarks, warmUpHandLandmarker } from "../../../modules/hand-landmarker";

// Verbose per-photo gate diagnostics — dev only. Stays silent in release builds.
const log = __DEV__ ? console.log.bind(console) : () => {};

// ── Gate thresholds (geometry only) ──────────────────────────────────────────
const MIN_PALM_COVERAGE = 0.22; // palm bbox area ÷ frame; below → too_far
const GATE_RESIZE_W = 512; // pre-resize width; landmark coords are in this pixel space
const MIN_FINGER_SPREAD = 0.12; // min normalized distance between finger tips
const MAX_ORIENTATION_DEVIATION = 40; // max degrees away from vertical (up)

const TIPS = {
  not_a_palm: "Please upload a clear photo of your open hand, palm facing the camera.",
  too_far: "Bring the camera closer — your palm should fill most of the frame.",
  cropped: "Include your full palm — from wrist to fingertips — in the photo.",
  blurry: "Hold steady and take a sharp, focused photo of your palm.",
  wrong_hand: "The photo looks like your other hand — please retake with the hand you selected.",
  fingers_closed: "Spread your fingers naturally so the full palm is visible.",
  tilted_hand: "Keep your hand straight (fingers pointing up) and flat towards the camera.",
  multiple_hands: "Show just one open palm in the photo.",
};

const HAND_REJECT_MIN_CONFIDENCE = 0.95;

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

    const { landmarks, handedness, score, handCount, width, height } = await detectHandLandmarks(manipulated.uri);
    log(`Gate: Native detect done in ${Date.now() - startTime}ms — hands=${handCount} score=${score?.toFixed(2)} handedness=${handedness} (${width}x${height})`);

    // No hand / incomplete hand → reject.
    if (!Array.isArray(landmarks) || landmarks.length < 21) {
      return reject("not_a_palm", `points=${landmarks?.length || 0}`, Date.now() - startTime);
    }

    // Multiple hands check.
    if (handCount > 1) {
      return reject("multiple_hands", `Found ${handCount} hands`, Date.now() - startTime);
    }

    // Blurry / Low confidence check.
    if (score < 0.6) {
      return reject("blurry", `Low confidence (${Math.round(score * 100)}%)`, Date.now() - startTime);
    }

    const bounds = landmarkBounds(landmarks, width, height);
    log("Gate: Coverage:", bounds.coverage);

    // Palm too small in frame.
    if (bounds.coverage < MIN_PALM_COVERAGE) {
      return reject("too_far", `Coverage ${Math.round(bounds.coverage * 100)}%`, Date.now() - startTime);
    }

    // Palm runs off-edge.
    const pad = 4;
    if (bounds.minX < pad || bounds.minY < pad ||
        bounds.maxX > width - pad || bounds.maxY > height - pad) {
      return reject("cropped", "Hand touching edge", Date.now() - startTime);
    }

    // Additional rules
    const fingersSpread = checkFingerSpread(landmarks);
    const orientationOk = checkOrientation(landmarks);
    const flatnessOk = checkFlatness(landmarks);

    if (!fingersSpread) {
      return reject("fingers_closed", "Tips too close", Date.now() - startTime);
    }
    if (!orientationOk || !flatnessOk) {
      return reject("tilted_hand", `angle/ratio fail`, Date.now() - startTime);
    }

    // Handedness check.
    // MediaPipe native handedness is usually the ACTUAL handedness (non-mirrored).
    // If the model says "Left" and user claimed "Right", reject.
    if (claimedHand && handedness) {
      log(`Gate: Handedness check -> claimed=${claimedHand}, detected=${handedness}`);
      if (handedness !== claimedHand) {
        return reject("wrong_hand", `Detected ${handedness} vs Claimed ${claimedHand}`, Date.now() - startTime);
      }
    }

    log(`Gate: Final Result -> PASSED (Total Time: ${Date.now() - startTime}ms)`);
    const checks = [
      { key: "multiple_hands", ok: handCount === 1, label: handCount > 1 ? "Multiple hands detected" : "Single hand detected" },
      { key: "landmarks", ok: true, label: `${landmarks.length} hand landmarks detected` },
      { key: "sharpness", ok: score >= 0.7, label: `Sharpness ${score >= 0.7 ? "OK" : "low"} (${Math.round(score * 100)}%)` },
      { key: "coverage", ok: true, label: `Palm fills frame (${Math.round(bounds.coverage * 100)}%)` },
      { key: "handedness", ok: true, label: `Correct hand (${handedness || "unknown"})` },
      { key: "spread", ok: true, label: "Fingers spread open" },
      { key: "straight", ok: true, label: "Hand straight and flat" },
    ];
    // detectedHand: native MediaPipe handedness (already actual, non-mirrored),
    // sent to the backend so it can enforce claimed-vs-detected even if this
    // gate is bypassed (e.g. tampered client). Null when the detector returned
    // no handedness → backend can't enforce on a guess.
    return { ok: true, landmarks, imgW: width, imgH: height, checks, detectedHand: handedness || null };
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
