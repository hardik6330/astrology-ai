import { requireNativeModule } from "expo-modules-core";

// Native MediaPipe Tasks HandLandmarker (IMAGE mode). Replaces the unreliable
// TFJS hand-pose-detection on mobile. The native side returns the 21 landmarks
// in IMAGE-PIXEL coordinates (x in [0,width], y in [0,height]) — the SAME space
// the web gate sends — so the backend landmark-geometry embedding matches across
// web and mobile. See backend/src/utils/palmEmbedding.js (landmarkEmbedding).
let Native = null;
try {
  Native = requireNativeModule("HandLandmarker");
} catch (e) {
  console.error("Failed to load HandLandmarker module:", e);
}

export interface HandPoint {
  x: number; // pixels (0..width)
  y: number; // pixels (0..height)
  z: number; // relative depth (unused by the embedding, kept for parity)
}

export interface HandResult {
  landmarks: HandPoint[]; // 21 points, or [] if no hand was found
  handedness?: "Left" | "Right"; // "Left" or "Right" as detected by the model
  score: number; // confidence score (0..1)
  handCount: number; // total number of hands detected in the frame
  width: number; // decoded image width  (pixels)
  height: number; // decoded image height (pixels)
}

// Detect a single hand in a still image. `uri` is a file:// or content:// URI
// (what expo-image-picker / expo-image-manipulator produce). Resolves with the
// 21 landmarks in pixel coords; landmarks is [] when no hand is detected.
export async function detectHandLandmarks(uri: string): Promise<HandResult> {
  if (!Native) {
    throw new Error("HandLandmarker native module not found (are you in Expo Go?)");
  }
  return await Native.detect(uri);
}

// Build the detector ahead of time (loads the ~7 MB .task model). Call this
// while the picker is open so the first detect() is fast. Safe to call repeatedly.
export async function warmUpHandLandmarker(): Promise<void> {
  if (!Native) return;
  await Native.prepare();
}
