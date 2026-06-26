// M2 — `skipGate` is only honored with credible landmark evidence.
// landmarksCredible() is the trust check that gates the skip.

import { describe, it, expect } from 'vitest';
import { landmarksCredible } from '../src/services/palmService.js';
import { classifyHand, geometricHandVote, handsLookIdentical, HAND_CONF_MIN } from '../src/utils/palmHand.js';

// Mirror across the vertical axis (x → 1-x): turns a left hand into a right hand.
const mirror = (pts) => pts.map((p) => ({ x: 1 - p.x, y: p.y }));
// Rotate all points by `deg` about the hand centroid. A proper rotation
// preserves orientation, so the classified hand-side must NOT change — this is
// the rotation-invariance the old raw-X test failed.
function rotate(pts, deg) {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  return pts.map(({ x, y }) => ({
    x: cx + (x - cx) * c - (y - cy) * s,
    y: cy + (x - cx) * s + (y - cy) * c,
  }));
}

// A plausible, well-spread 21-point MediaPipe hand (palm open, fingers up).
// Distinct points across the frame so buildPalmGeometry accepts it.
function validHand() {
  return [
    { x: 0.50, y: 0.92 }, // 0 wrist
    { x: 0.36, y: 0.80 }, // 1 thumb cmc
    { x: 0.30, y: 0.72 }, // 2
    { x: 0.26, y: 0.66 }, // 3
    { x: 0.22, y: 0.60 }, // 4 thumb tip
    { x: 0.40, y: 0.55 }, // 5 index mcp
    { x: 0.40, y: 0.42 }, // 6
    { x: 0.40, y: 0.30 }, // 7
    { x: 0.40, y: 0.20 }, // 8 index tip
    { x: 0.50, y: 0.52 }, // 9 middle mcp
    { x: 0.50, y: 0.38 }, // 10
    { x: 0.50, y: 0.25 }, // 11
    { x: 0.50, y: 0.14 }, // 12 middle tip
    { x: 0.60, y: 0.54 }, // 13 ring mcp
    { x: 0.60, y: 0.40 }, // 14
    { x: 0.61, y: 0.28 }, // 15 ring dip
    { x: 0.61, y: 0.18 }, // 16 ring tip
    { x: 0.69, y: 0.57 }, // 17 pinky mcp
    { x: 0.70, y: 0.46 }, // 18
    { x: 0.71, y: 0.36 }, // 19
    { x: 0.72, y: 0.28 }, // 20 pinky tip
  ];
}

describe('landmarksCredible (M2 skip-gate trust check)', () => {
  it('accepts a real, well-spread 21-point hand', () => {
    expect(landmarksCredible(validHand())).toBe(true);
  });

  it('rejects null / non-array', () => {
    expect(landmarksCredible(null)).toBe(false);
    expect(landmarksCredible(undefined)).toBe(false);
    expect(landmarksCredible('nope')).toBe(false);
  });

  it('rejects fewer than 21 points', () => {
    expect(landmarksCredible(validHand().slice(0, 20))).toBe(false);
  });

  it('rejects a degenerate cluster of near-identical points (cheap forgery)', () => {
    const cluster = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
    expect(landmarksCredible(cluster)).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    const bad = validHand();
    bad[8] = { x: 9, y: 0.2 };
    expect(landmarksCredible(bad)).toBe(false);
  });

  it('rejects non-finite coordinates', () => {
    const bad = validHand();
    bad[3] = { x: NaN, y: 0.6 };
    expect(landmarksCredible(bad)).toBe(false);
  });
});

describe('classifyHand (rotation-invariant hand-side verification)', () => {
  it('classifies the canonical thumb-left hand as Left, confidently', () => {
    const cls = classifyHand(validHand());
    expect(cls.hand).toBe('Left');
    expect(cls.confidence).toBeGreaterThanOrEqual(HAND_CONF_MIN);
  });

  it('classifies the mirrored hand as Right', () => {
    const cls = classifyHand(mirror(validHand()));
    expect(cls.hand).toBe('Right');
    expect(cls.confidence).toBeGreaterThanOrEqual(HAND_CONF_MIN);
  });

  it('stays Left when the hand is rotated in frame (the old test would flip)', () => {
    for (const deg of [-60, -30, 30, 60, 90]) {
      expect(geometricHandVote(rotate(validHand(), deg)).hand).toBe('Left');
    }
  });

  it('returns no hand (no false vote) for null / too few points', () => {
    expect(classifyHand(null).hand).toBeNull();
    expect(classifyHand(validHand().slice(0, 10)).hand).toBeNull();
    expect(classifyHand(null).confidence).toBe(0);
  });

  it('a MediaPipe label that AGREES raises confidence; one that DISAGREES lowers it', () => {
    const agree = classifyHand(validHand(), 'Left');
    const disagree = classifyHand(validHand(), 'Right');
    expect(agree.hand).toBe('Left');
    expect(agree.confidence).toBeGreaterThan(disagree.confidence);
    // A disagreeing MP vote should pull confidence below the enforce threshold,
    // so an ambiguous/mirrored upload isn't hard-rejected.
    expect(disagree.confidence).toBeLessThan(HAND_CONF_MIN);
  });
});

describe('handsLookIdentical (duplicate-hand detection)', () => {
  it('flags the same hand as a duplicate', () => {
    expect(handsLookIdentical(validHand(), validHand())).toBe(true);
  });

  it('ignores position + scale (a shifted, scaled copy is still the same hand)', () => {
    const moved = validHand().map((p) => ({ x: p.x * 0.5 + 0.2, y: p.y * 0.5 + 0.1 }));
    expect(handsLookIdentical(validHand(), moved)).toBe(true);
  });

  it('does NOT flag a genuine left/right pair (mirror images)', () => {
    expect(handsLookIdentical(validHand(), mirror(validHand()))).toBe(false);
  });

  it('returns false for null / too few points', () => {
    expect(handsLookIdentical(null, validHand())).toBe(false);
    expect(handsLookIdentical(validHand(), validHand().slice(0, 12))).toBe(false);
  });
});
