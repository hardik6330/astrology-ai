// Rotation-invariant hand-side (Left/Right) classifier + duplicate-hand check
// from the 21 MediaPipe hand landmarks. SINGLE SOURCE for the web + mobile palm
// gates — consumed via thin relative imports from each app's palmGate. Pure
// geometry (only `Math`, no platform or bare-package deps), so it bundles cleanly
// in both Vite (web) and Metro (mobile).
//
// ⚠️ The backend keeps a byte-identical copy at backend/src/utils/palmHand.js —
// it CAN'T import this, because the prod deploy tarball ships only backend/src/
// (see .github/workflows/deploy.yml). Keep the two in sync.
//
// Note on the MediaPipe label: this scorer takes an already-resolved `mpHand`
// ('Left'|'Right'|null). The mirror-convention correction (selfie vs not) is a
// capture concern and stays in each client's palmGate (mediapipeHand()).

// Below this normalized thumb-offset strength the hand side is genuinely
// ambiguous (thumb tucked / occluded) → no geometric vote.
export const HAND_GEO_MIN_STRENGTH = 0.04;
// Strength at which the geometric vote counts as fully confident.
export const HAND_GEO_FULL_STRENGTH = 0.20;
// A hand-side call at/above this confidence may BLOCK a mismatching claimed hand.
// Below it we don't enforce, to avoid false rejects on ambiguous photos.
export const HAND_CONF_MIN = 0.45;
// Mean per-point distance below which two normalized hands count as the SAME
// hand (duplicate upload). Tight on purpose so a real L/R pair (mirror images,
// far apart) is never flagged.
export const DUP_MAX_DISTANCE = 0.06;

// Rotation-invariant geometric vote → { hand: 'Left'|'Right'|null, strength }.
// Builds the hand's OWN axis (wrist → middle-finger MCP) and measures which side
// of it the thumb tip sits on via a 2-D cross product, so it stays correct when
// the hand is rotated in frame (the old thumb.x-vs-pinky.x test flipped or
// returned null on any rotation, which let wrong hands pass).
export function geometricHandVote(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return { hand: null, strength: 0 };
  const wrist = landmarks[0], midMcp = landmarks[9], thumbTip = landmarks[4];
  const indexMcp = landmarks[5], pinkyMcp = landmarks[17];
  if (!wrist || !midMcp || !thumbTip || !indexMcp || !pinkyMcp) return { hand: null, strength: 0 };
  const ux = midMcp.x - wrist.x, uy = midMcp.y - wrist.y;      // hand "up" axis
  const tx = thumbTip.x - wrist.x, ty = thumbTip.y - wrist.y;  // thumb vs wrist
  const cross = ux * ty - uy * tx;                             // signed side of the axis
  const palmW = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y) || 1;
  const handLen = Math.hypot(ux, uy) || 1;
  const strength = Math.abs(cross) / (palmW * handLen);
  if (!Number.isFinite(strength) || strength < HAND_GEO_MIN_STRENGTH) {
    return { hand: null, strength: Number.isFinite(strength) ? strength : 0 };
  }
  // For a palm-facing, non-mirrored photo the thumb on the image-right of the
  // hand axis (cross > 0) = RIGHT hand. Same convention as the old test.
  return { hand: cross > 0 ? "Right" : "Left", strength };
}

// Combine the geometric vote with an OPTIONAL, already mirror-corrected MediaPipe
// label (null when absent) into { hand, confidence (0..1), geo, mp }. Geometry is
// primary (rotation-invariant); MediaPipe raises confidence when it agrees and
// lowers it when it disagrees (ambiguous/mirrored → below HAND_CONF_MIN → not
// enforced).
export function classifyHand(landmarks, mpHand = null) {
  const { hand: geo, strength } = geometricHandVote(landmarks);
  const geoConf = Math.max(0, Math.min(1, strength / HAND_GEO_FULL_STRENGTH));
  let hand = null, confidence = 0;
  if (geo && mpHand) {
    hand = geo;
    confidence = geo === mpHand ? Math.min(1, 0.7 + 0.3 * geoConf) : 0.35 * geoConf;
  } else if (geo) {
    hand = geo;
    confidence = 0.5 + 0.5 * geoConf;
  } else if (mpHand) {
    hand = mpHand;
    confidence = 0.45;
  }
  return { hand, confidence, geo, mp: mpHand };
}

// Translate to centroid + scale by mean radius, so the comparison ignores where
// the hand sits in frame and how big it is (not rotation — a rotated same-side
// hand is caught by the handedness guard instead).
function normalizeHand(landmarks) {
  let cx = 0, cy = 0;
  for (const p of landmarks) { cx += p.x; cy += p.y; }
  cx /= landmarks.length; cy /= landmarks.length;
  let scale = 0;
  for (const p of landmarks) scale += Math.hypot(p.x - cx, p.y - cy);
  scale = (scale / landmarks.length) || 1;
  return landmarks.map((p) => ({ x: (p.x - cx) / scale, y: (p.y - cy) / scale }));
}

// True when two hands look like the SAME hand (duplicate upload). A real L/R pair
// is mirror-symmetric → large distance → false.
export function handsLookIdentical(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 21 || b.length < 21) return false;
  const na = normalizeHand(a), nb = normalizeHand(b);
  let sum = 0;
  for (let i = 0; i < 21; i++) sum += Math.hypot(na[i].x - nb[i].x, na[i].y - nb[i].y);
  return sum / 21 < DUP_MAX_DISTANCE;
}
