// @astrology-ai/palm-core — shared palm hand-side classifier + duplicate-hand
// check, consumed by the web (frontend) and mobile palm gates via thin relative
// imports. Keep in sync with the backend's byte-identical copy
// backend/src/utils/palmHand.js (the backend can't import this package).
export {
  HAND_GEO_MIN_STRENGTH,
  HAND_GEO_FULL_STRENGTH,
  HAND_CONF_MIN,
  DUP_MAX_DISTANCE,
  geometricHandVote,
  classifyHand,
  handsLookIdentical,
} from "./handClassifier.js";

// Shared gate quality thresholds + the "AI Confidence" score.
export {
  MIN_LUMINANCE,
  MIN_LAPLACIAN_VAR,
  MIN_PALM_COVERAGE,
  confidenceScore,
} from "./gateConfig.js";
