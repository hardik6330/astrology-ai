// Rotation-invariant hand-side (Left/Right) classifier from the 21 MediaPipe
// hand landmarks. Replaces the old `thumbTip.x > pinkyMcp.x` test, which only
// worked for a perfectly upright hand: once the hand was rotated in frame or the
// thumb was folded, the raw-X comparison flipped or fell below threshold and
// returned "ambiguous" → the wrong hand silently PASSED. This builds the hand's
// OWN axis (wrist → middle-finger MCP) and measures which side of it the thumb
// sits on via a 2-D cross product, so the result is invariant to in-plane
// rotation. Coords may be pixel- or normalized-space — only relative geometry is
// used.
//
// ⚠️ KEEP IN SYNC with the clients' shared copy (same thresholds + math):
//   packages/palm-core/src/handClassifier.js  (imported by both client gates).
// The backend can't import that package — the prod deploy tarball ships only
// `src/` (see .github/workflows/deploy.yml) — so this is a byte-identical mirror.

// Below this normalized thumb-offset strength the hand side is genuinely
// ambiguous (thumb tucked / occluded) → no geometric vote.
export const HAND_GEO_MIN_STRENGTH = 0.04;
// Strength at which the geometric vote counts as fully confident.
export const HAND_GEO_FULL_STRENGTH = 0.20;
// A hand-side call at/above this confidence may BLOCK a mismatching claimed hand.
// Below it we don't enforce, to avoid false rejects on ambiguous photos.
export const HAND_CONF_MIN = 0.45;

// Rotation-invariant geometric vote → { hand: 'Left'|'Right'|null, strength }.
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
  // Same convention as the old test: for a palm-facing, non-mirrored photo the
  // thumb on the image-right of the hand axis (cross > 0) = RIGHT hand.
  return { hand: cross > 0 ? 'Right' : 'Left', strength };
}

// Combine the geometric vote with an OPTIONAL MediaPipe handedness label (already
// mirror-corrected by the caller; null on the backend, which only gets landmarks)
// into a single { hand, confidence (0..1), geo, mp }. Geometry is the primary
// signal because it's rotation-invariant; MediaPipe raises or lowers confidence.
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

// Mean per-point distance below which two 21-point hands count as near-identical
// after normalizing out position + scale. Tight on purpose: it must fire on the
// SAME hand photographed twice (or the same photo in both slots) but NEVER on a
// genuine left/right pair — which are mirror images and so stay far apart.
export const DUP_MAX_DISTANCE = 0.06;

// Translate to centroid + scale by mean radius, so the comparison ignores where
// the hand sits in frame and how big it is (not rotation — we only want to catch
// near-identical poses; a rotated same-side hand is caught by the handedness
// guard instead).
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
// is mirror-symmetric → large distance → false. Keep in sync with the clients.
export function handsLookIdentical(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 21 || b.length < 21) return false;
  const na = normalizeHand(a), nb = normalizeHand(b);
  let sum = 0;
  for (let i = 0; i < 21; i++) sum += Math.hypot(na[i].x - nb[i].x, na[i].y - nb[i].y);
  return sum / 21 < DUP_MAX_DISTANCE;
}
