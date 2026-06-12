// Structured palm geometry derived from the 21 MediaPipe hand landmarks the
// client sends. Computed ONCE here (backend) so web + mobile stay thin and the
// rules never drift between clients. These are HINTS for the Gemini prompt — the
// reading is still grounded in the visible lines; geometry just sharpens the
// shape/finger observations the model can't measure precisely from pixels.
//
// All lengths are normalized by palm height, so the numbers are scale-invariant
// (independent of how close the hand was to the camera) — raw pixel distances
// would change with zoom and mislead the model.
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
  const raw = {
    thumb: dist(L[1], L[4]),
    index: dist(L[5], L[8]),
    middle: dist(L[9], L[12]),
    ring: dist(L[13], L[16]),
    pinky: dist(L[17], L[20]),
  };
  const fingers = {};
  for (const k of Object.keys(raw)) fingers[k] = +(raw[k] / palmHeight).toFixed(2);

  // Rule 5 — hand element (classic palmistry, approximated from palm shape +
  // finger length): square palm = wide relative to height; long fingers ≈ middle
  // finger ≥ 0.7 of palm height.
  const longPalm = ratio < 0.85;
  const longFingers = fingers.middle >= 0.7;
  const element = longPalm
    ? (longFingers ? 'Water' : 'Fire')
    : (longFingers ? 'Air' : 'Earth');

  // Rule 7 — Jupiter (index) vs Apollo (ring): which is the longer finger.
  const jupiterVsApollo =
    raw.index > raw.ring ? 'index_longer' :
    raw.index < raw.ring ? 'ring_longer' : 'equal';

  // Rule 8 — thumb openness: angle between the thumb axis (CMC→tip) and the palm
  // axis (wrist→middle base). Wider angle ≈ a more flexible/extroverted thumb.
  const v1 = { x: L[4].x - L[1].x, y: L[4].y - L[1].y };
  const v2 = { x: L[9].x - L[0].x, y: L[9].y - L[0].y };
  const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
  const thumbAngle = (m1 && m2)
    ? +(Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (m1 * m2)))) * 180 / Math.PI).toFixed(0)
    : null;

  // Rule 9 — Mercury (pinky) length: does the pinky tip reach the top joint (DIP)
  // of the ring finger? Fingers point up (gated by orientation), so a smaller y
  // is higher up the frame.
  const mercuryReachesRing = L[20].y <= L[15].y;

  return {
    ratio: +ratio.toFixed(2),
    element,
    fingers,
    jupiterVsApollo,
    thumbAngle,
    mercuryReachesRing,
  };
}
