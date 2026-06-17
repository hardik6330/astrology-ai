// M2 — `skipGate` is only honored with credible landmark evidence.
// landmarksCredible() is the trust check that gates the skip.

import { describe, it, expect } from 'vitest';
import { landmarksCredible } from '../src/services/palmService.js';

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
