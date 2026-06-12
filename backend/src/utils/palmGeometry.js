// Structured palm geometry derived from the 21 MediaPipe hand landmarks the
// client sends. Computed ONCE here (backend) so web + mobile stay thin and the
// rules never drift between clients.
//
// Output is CATEGORICAL BUCKETS ("square" / "long" / "Jupiter"), not raw floats.
// Buckets are the key to cross-scan CONSISTENCY: two photos of the same hand
// differ slightly in zoom/angle, so the raw numbers wobble — but the bucket they
// fall into stays the same. The prompt grounds the hand element / finger / shape
// / thumb traits STRICTLY in these buckets (deterministic), and reads the lines
// and mounts from the photo (inherently visual — geometry can't see them).
//
// All lengths are normalized by palm height before bucketing, so the result is
// scale-invariant (independent of how close the hand was to the camera).
//
// MediaPipe landmark map: 0 wrist · 1-4 thumb (4 tip) · 5-8 index (8 tip) ·
// 9-12 middle · 13-16 ring · 17-20 pinky.

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function buildPalmGeometry(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return null;
  const L = landmarks;

  const palmWidth = dist(L[5], L[17]);  // index base ↔ pinky base
  const palmHeight = dist(L[0], L[9]);  // wrist ↔ middle base
  if (!palmWidth || !palmHeight) return null;
  const ratio = palmWidth / palmHeight;

  // Finger lengths as a fraction of palm height (scale-invariant).
  const f = {
    thumb: dist(L[1], L[4]) / palmHeight,
    index: dist(L[5], L[8]) / palmHeight,
    middle: dist(L[9], L[12]) / palmHeight,
    ring: dist(L[13], L[16]) / palmHeight,
    pinky: dist(L[17], L[20]) / palmHeight,
  };

  // Palm shape (square = wide relative to height; long = narrow/rectangular).
  const longPalm = ratio < 0.85;
  const palmShape = longPalm ? 'rectangular' : 'square';

  // Overall finger length, judged from the middle finger vs palm height.
  const longFingers = f.middle >= 0.7;
  const fingerLength = longFingers ? 'long' : 'short';

  // Rule 5 — hand element (classic palmistry): palm shape × finger length.
  const element = longPalm
    ? (longFingers ? 'Water' : 'Fire')
    : (longFingers ? 'Air' : 'Earth');

  // Rule 7 — dominant finger: index (Jupiter/leadership) vs ring (Apollo/
  // creativity). Within ~3% counts as balanced so a near-tie doesn't flip-flop.
  const dominantFinger =
    f.index > f.ring * 1.03 ? 'Jupiter (leadership)' :
    f.ring > f.index * 1.03 ? 'Apollo (creativity)' : 'balanced';

  // Rule 8 — thumb openness: angle between thumb axis (CMC→tip) and palm axis
  // (wrist→middle base). NOTE: partly pose-dependent (how the user held the
  // thumb), so less stable across photos than the anatomy-driven buckets above.
  const v1 = { x: L[4].x - L[1].x, y: L[4].y - L[1].y };
  const v2 = { x: L[9].x - L[0].x, y: L[9].y - L[0].y };
  const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
  const thumbAngle = (m1 && m2)
    ? Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (m1 * m2)))) * 180 / Math.PI
    : 0;
  const thumb = thumbAngle >= 40 ? 'flexible' : thumbAngle >= 25 ? 'balanced' : 'reserved';

  // Rule 9 — Mercury (pinky) length: does the pinky tip reach the top joint (DIP)
  // of the ring finger? Fingers point up (gated by orientation), so smaller y is
  // higher in the frame.
  const mercury = L[20].y <= L[15].y ? 'long' : 'short';

  return { palmShape, element, fingerLength, dominantFinger, thumb, mercury };
}
