import { describe, it, expect } from 'vitest';
import { estimateCostUsd } from '../src/ai/gemini.js';

// Cost telemetry is only useful if the arithmetic is right — and the easy bug
// here is billing thinking tokens at zero, which makes Pro look ~3x cheaper
// than it is and would send feature-level spend decisions the wrong way.
describe('estimateCostUsd', () => {
  it('bills thinking tokens (total - prompt) as output, not just candidates', () => {
    // 1M prompt + 1M billable output on Pro = $1.25 + $10.00
    const cost = estimateCostUsd('gemini-2.5-pro', {
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 400_000,   // visible output only
      totalTokenCount: 2_000_000,      // includes 600k thinking tokens
    });
    expect(cost).toBeCloseTo(11.25, 6);
  });

  it('falls back to candidates when the API omits a total', () => {
    const cost = estimateCostUsd('gemini-2.5-flash-lite', {
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.5, 6); // 0.10 in + 0.40 out
  });

  it('returns null for an unpriced model rather than pretending it is free', () => {
    expect(estimateCostUsd('gemini-9.9-unreleased', { totalTokenCount: 5000 })).toBeNull();
  });
});
