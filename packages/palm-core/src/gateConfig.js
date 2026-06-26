// Shared palm-gate quality thresholds + the "AI Confidence" score, used by BOTH
// client gates (web + mobile). These three thresholds and the scoring formula
// were previously duplicated in each gate with a "MUST mirror these" warning —
// they now live here once. Brightness/sharpness are measured on a 256px
// downsample in both clients (web computes it; the mobile native detector reports
// it), so the same numeric thresholds apply on both platforms.
//
// Platform-SPECIFIC gate knobs (orientation tolerance, resize width, the
// palm-region edge/lighting thresholds, capture mirror state) intentionally stay
// local to each gate — they depend on the per-platform image pipeline.

// Mean luma (0-255) below → too_dark.
export const MIN_LUMINANCE = 55;
// Laplacian variance (256px) below → blurry.
export const MIN_LAPLACIAN_VAR = 160;
// Palm bbox area ÷ frame below → too_far.
export const MIN_PALM_COVERAGE = 0.22;

// ── "AI Confidence" score (0-100) for a PASSING photo ────────────────────────
// A blend of brightness, sharpness and palm coverage. Each metric is normalized
// to [FLOOR..1] between its reject threshold (= just-passing) and a "comfortably
// good" target (threshold × the *_GOOD_MULT below), then weighted. The FLOOR
// keeps a photo that merely clears the gate feeling trustworthy (~70%).
const CONF_FLOOR = 0.7;             // score at the just-passing threshold
const CONF_RANGE = 1 - CONF_FLOOR;  // headroom above the floor up to a great photo
const BRIGHTNESS_GOOD_MULT = 2.6;   // 55  → 143 = "comfortably bright"
const SHARPNESS_GOOD_MULT = 4;      // 160 → 640 = "comfortably sharp"
const COVERAGE_GOOD_MULT = 2.5;     // 0.22 → 0.55 = "fills the frame well"
const CONF_WEIGHTS = { brightness: 0.3, sharpness: 0.4, coverage: 0.3 };

export function confidenceScore({ brightness, sharpness, coverage }) {
  const norm = (val, min, good) => {
    if (typeof val !== "number" || !isFinite(val)) return 0.85; // metric absent → assume fine
    return CONF_FLOOR + CONF_RANGE * Math.max(0, Math.min(1, (val - min) / (good - min)));
  };
  const b = norm(brightness, MIN_LUMINANCE, MIN_LUMINANCE * BRIGHTNESS_GOOD_MULT);
  const s = norm(sharpness, MIN_LAPLACIAN_VAR, MIN_LAPLACIAN_VAR * SHARPNESS_GOOD_MULT);
  const c = norm(coverage, MIN_PALM_COVERAGE, MIN_PALM_COVERAGE * COVERAGE_GOOD_MULT);
  const score = CONF_WEIGHTS.brightness * b + CONF_WEIGHTS.sharpness * s + CONF_WEIGHTS.coverage * c;
  return Math.round(100 * Math.max(0, Math.min(1, score)));
}
