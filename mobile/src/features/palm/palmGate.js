// Client-side palm-photo gate for React Native.
// Replaces the server-side Gemini Flash gate — runs TensorFlow.js and MediaPipe Hands 
// locally to detect hand presence/quality.

import * as tf from "@tensorflow/tfjs";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import { decode as decodeBase64 } from "base-64";
import { decodeJpeg } from "@tensorflow/tfjs-react-native";
import * as ImageManipulator from "expo-image-manipulator";
import "@tensorflow/tfjs-react-native";

// Memoized model.
let _detector = null;
let _detectorPromise = null;

async function getDetector() {
  if (_detector) return _detector;
  if (_detectorPromise) return _detectorPromise;
  _detectorPromise = (async () => {
    console.log("Gate: Initializing TensorFlow.js and MediaPipe Hands detector...");
    
    // Explicitly wait for TF and set the fastest backend
    await tf.ready();
    try {
      // Try to use WebGL for GPU acceleration
      await tf.setBackend('rn-webgl');
      console.log("Gate: Using rn-webgl backend");
    } catch (e) {
      console.log("Gate: rn-webgl failed, using default backend");
    }

    _detector = await handPoseDetection.createDetector(
      handPoseDetection.SupportedModels.MediaPipeHands,
      {
        runtime: "tfjs",
        modelType: "lite",
        maxHands: 1, // Optimized: Only look for one hand
      },
    );
    console.log("Gate: MediaPipe Hands detector initialized successfully.");
    return _detector;
  })();
  return _detectorPromise;
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

const TIPS = {
  too_dark:       "Move into bright, even light so the lines on your palm are clearly visible.",
  blurry:         "Hold steady and take a sharp, focused photo of your palm.",
  not_a_palm:     "Please upload a clear photo of your open hand, palm facing the camera.",
  multiple_hands: "Show just one open palm in the photo.",
  too_far:        "Bring the camera closer — your palm should fill most of the frame.",
  cropped:        "Include your full palm — from wrist to fingertips — in the photo.",
  wrong_hand:     "The photo looks like your other hand — please retake with the hand you selected.",
};

const HAND_REJECT_MIN_CONFIDENCE = 0.95;

function reject(rejectReason, debugInfo = "", duration = 0) {
  const response = { 
    ok: false, 
    rejectReason, 
    retakeReason: (TIPS[rejectReason] || "Please retake with a clearer palm photo.")
  };
  console.log(`Gate: Final Result -> REJECTED (Time: ${duration}ms)`, { reason: rejectReason, debug: debugInfo, response });
  return response;
}

/**
 * Cheap pixel heuristics using TFJS.
 * Downsamples to 256px to match web thresholds.
 */
function checkQuality(tensor) {
  return tf.tidy(() => {
    console.log("Gate: Running quality checks (Darkness & Blur)...");
    const [h, w] = tensor.shape;
    const scale = Math.min(1, 256 / Math.max(h, w));
    const newH = Math.max(1, Math.round(h * scale));
    const newW = Math.max(1, Math.round(w * scale));
    
    // Resize for faster processing and threshold consistency
    const small = tf.image.resizeBilinear(tensor.expandDims(0), [newH, newW]).squeeze(0);
    
    // 1. Mean Luminance (Darkness)
    const weights = tf.tensor1d([0.2126, 0.7152, 0.0722]);
    const gray = tf.sum(tf.mul(small, weights), -1);
    const lum = tf.mean(gray).dataSync()[0];
    console.log(`Gate: Mean Luminance = ${lum.toFixed(2)} (Threshold: 45)`);
    
    if (lum < 45) return { ok: false, reason: "too_dark", val: lum };

    // 2. Laplacian Variance (Blur)
    const laplacianKernel = tf.tensor2d([0, 1, 0, 1, -4, 1, 0, 1, 0], [3, 3]).reshape([3, 3, 1, 1]);
    const gray4d = gray.expandDims(0).expandDims(-1);
    const laplacian = tf.conv2d(gray4d, laplacianKernel, 1, "valid");
    const { variance } = tf.moments(laplacian);
    const lapVar = variance.dataSync()[0];
    console.log(`Gate: Laplacian Variance = ${lapVar.toFixed(2)} (Threshold: 100)`);
    
    if (lapVar < 100) return { ok: false, reason: "blurry", val: lapVar };

    console.log("Gate: Quality checks PASSED.");
    return { ok: true };
  });
}

/**
 * Run the full gate on a photo.
 * @param {object} asset The image asset from Expo ImagePicker.
 * @param {string} claimedHand Optional "Left" | "Right".
 */
export async function gatePalmImage(asset, claimedHand) {
  const startTime = Date.now();
  console.log("Gate: Starting detection flow...");

  let tensor = null;
  try {
    // CRITICAL SPEED FIX: Resize the image BEFORE decoding to tensor.
    // Decoding a 4096px image to tensor takes ~40-50s on CPU.
    // Resizing it via native ImageManipulator takes ~100ms.
    console.log("Gate: Pre-resizing image using Native ImageManipulator...");
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 512 } }], // Resize to 512px width first
      { base64: true, format: ImageManipulator.SaveFormat.JPEG, quality: 0.7 }
    );
    console.log(`Gate: Pre-resize done in ${Date.now() - startTime}ms`);

    const detector = await getDetector();
    
    // Decode the SMALLER base64
    const binary = decodeBase64(manipulated.base64);
    const uint8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      uint8[i] = binary.charCodeAt(i);
    }

    tensor = decodeJpeg(uint8);
    const [height, width] = tensor.shape;
    console.log(`Gate: Tensor ready (${width}x${height}) in ${Date.now() - startTime}ms`);

    // 1. Pixel heuristics first (darkness/blur)
    const quality = checkQuality(tensor);
    if (!quality.ok) {
      return reject(quality.reason, `Value: ${Math.round(quality.val)}`, Date.now() - startTime);
    }

    // 2. MediaPipe hand detection
    // No need to resize again, we are already at 512px
    const hands = await detector.estimateHands(tensor, { flipHorizontal: false });
    console.log("Gate: Hands detected:", hands.length);

    if (hands.length === 0)   return reject("not_a_palm", "No hand detected", Date.now() - startTime);
    if (hands.length > 1)     return reject("multiple_hands", `Found ${hands.length} hands`, Date.now() - startTime);

    const hand = hands[0];
    if (!hand?.keypoints || hand.keypoints.length < 21) {
      return reject("not_a_palm", "Incomplete hand data", Date.now() - startTime);
    }

    // Check detection confidence
    if (hand.score < 0.85) {
      return reject("not_a_palm", `Low confidence (${Math.round(hand.score * 100)}%)`, Date.now() - startTime);
    }
    
    const bounds = landmarkBounds(hand.keypoints, width, height);
    console.log("Gate: Coverage:", bounds.coverage);

    // 3. Palm too small in frame.
    if (bounds.coverage < 0.15) return reject("too_far", `Coverage ${Math.round(bounds.coverage * 100)}%`, Date.now() - startTime);

    // 4. Palm runs off-edge.
    const pad = 4;
    if (bounds.minX < pad || bounds.minY < pad ||
        bounds.maxX > width - pad || bounds.maxY > height - pad) {
      return reject("cropped", "Hand touching edge", Date.now() - startTime);
    }

    // 5. Hand-side check
    if (claimedHand && hand.handedness && hand.score >= HAND_REJECT_MIN_CONFIDENCE) {
      const modelLabel = hand.handedness;
      const actualLabel = modelLabel === "Left" ? "Right" : "Left"; 
      console.log("Gate: Model says", modelLabel, "Actual", actualLabel, "Claimed", claimedHand);
      if (actualLabel !== claimedHand) {
        return reject("wrong_hand", "", Date.now() - startTime);
      }
    }

    console.log(`Gate: Final Result -> PASSED (Total Time: ${Date.now() - startTime}ms)`);
    return { ok: true };
  } catch (err) {
    console.warn("Palm gate encountered an error, falling back to PASS:", err);
    return { ok: true }; 
  } finally {
    if (tensor) {
      tf.dispose(tensor);
      console.log("Gate: Tensor disposed");
    }
  }
}

export function warmUpGate() {
  getDetector().catch(() => {});
}
