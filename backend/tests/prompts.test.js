// Prompt/client contract tests.
//
// The clients render AI output by reading fixed keys off the parsed JSON
// (interp.evidence, guide.dayTitle, …). Nothing else enforces that the prompt
// still ASKS for those keys — rewording a prompt can silently drop one, and the
// only symptom is a blank card in the app, in production, for every user.
//
// These tests are structural, not semantic: no network, no API key, no model
// call. They assert the prompt text still names every key the clients consume.
// They will NOT catch quality regressions — that needs a real eval harness with
// golden charts and live calls. This is the cheap guard that catches the
// breakage that actually happens.
//
// When you intentionally add/remove a rendered field, update BOTH the client
// and the list below in the same change.

import { describe, it, expect } from 'vitest';
import { INTERP_SYSTEM, DAILY_SYSTEM, PALM_SYSTEM, PALM_GATE_SYSTEM } from '../src/ai/prompts.js';

// Read off `interp.*` by frontend/src/features/reading/InsightsTab.jsx and
// mobile/src/features/reading/sections/ReadingTab.js — both consume the same set.
const INTERP_KEYS = [
  'bigThree', 'career', 'challenges', 'evidence', 'keyPlacements', 'lifeTheme',
  'pastCheck', 'personality', 'relationships', 'remedies', 'strengths',
];

// Read off `guide.*` by the daily-guidance cards. NOTE: guide.dos / guide.donts
// on the Timeline tab come from the STATIC DASHA_GUIDANCE table in
// planetInfo.js, not from this prompt — deliberately not listed here.
const DAILY_KEYS = [
  'action', 'avoid', 'dayTitle', 'family', 'health', 'intro',
  'job', 'love', 'relationship', 'self', 'spiritual', 'wealth',
];

// palmService reads these off the gate response to build the reject card.
const PALM_GATE_KEYS = ['rejectReason', 'retakeReason'];

// palmService branches on these before charging/refunding.
const PALM_KEYS = ['imageQuality', 'handType'];

describe('prompt → client key contract', () => {
  it.each(INTERP_KEYS)('INTERP_SYSTEM asks for "%s"', (key) => {
    expect(INTERP_SYSTEM).toContain(`"${key}"`);
  });

  it.each(DAILY_KEYS)('DAILY_SYSTEM asks for "%s"', (key) => {
    expect(DAILY_SYSTEM).toContain(`"${key}"`);
  });

  it.each(PALM_GATE_KEYS)('PALM_GATE_SYSTEM asks for "%s"', (key) => {
    expect(PALM_GATE_SYSTEM).toContain(`"${key}"`);
  });

  it.each(PALM_KEYS)('PALM_SYSTEM asks for "%s"', (key) => {
    expect(PALM_SYSTEM).toContain(`"${key}"`);
  });
});

describe('prompt sanity', () => {
  // A prompt emptied by a bad merge/refactor still "works" — the model just
  // free-associates. Cheap tripwire.
  it.each([
    ['INTERP_SYSTEM', INTERP_SYSTEM],
    ['DAILY_SYSTEM', DAILY_SYSTEM],
    ['PALM_SYSTEM', PALM_SYSTEM],
    ['PALM_GATE_SYSTEM', PALM_GATE_SYSTEM],
  ])('%s is a substantial string', (_name, prompt) => {
    expect(typeof prompt).toBe('string');
    expect(prompt.trim().length).toBeGreaterThan(200);
  });

  // Every one of these prompts is parsed with JSON.parse() by its service, so
  // each must actually instruct JSON output.
  it.each([
    ['INTERP_SYSTEM', INTERP_SYSTEM],
    ['DAILY_SYSTEM', DAILY_SYSTEM],
    ['PALM_SYSTEM', PALM_SYSTEM],
    ['PALM_GATE_SYSTEM', PALM_GATE_SYSTEM],
  ])('%s instructs JSON-only output', (_name, prompt) => {
    expect(prompt).toMatch(/JSON/i);
  });
});
