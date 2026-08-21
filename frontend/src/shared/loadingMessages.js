// Rotating status lines shown while the chart reading generates. Purely
// cosmetic — they are NOT tied to real progress.
//
// This file used to be `prompts.js` and also carried copies of CHAT_SYSTEM /
// DAILY_SYSTEM / GUARD_SYSTEM / INTERP_SYSTEM. Nothing imported them, and they
// had drifted away from the live, injection-hardened originals in
// backend/src/ai/prompts.js — which is the ONLY place a prompt should be
// edited. They were removed so there's nothing here to edit by mistake.
export const MSGS = [
  "Calculating Swiss-grade planetary positions…",
  "Casting your ascendant and house cusps…",
  "Scanning aspects and chart patterns…",
  "Generating your AI interpretation…",
  "Finalising your reading…",
];
