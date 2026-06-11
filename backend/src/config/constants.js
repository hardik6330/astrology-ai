// Model chains
// - PRO: deep synthesis for kundli/daily/palm. No flash fallback — when Pro
//   fails 3×, frontend gets AI_OVERLOADED + retry UI (no quality downgrade).
// - FLASH: cheap descriptive tasks (chat, guard, palm vision if cost matters).
export const KUNDLI_MODELS       = ['gemini-2.5-pro'];
export const FLASH_MODELS        = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
export const CHAT_MODELS         = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
// Chat answer model — Pro for deep, emotionally-aware Vedic responses.
// Guard/classifier still uses CHAT_MODELS (Flash) to stay cheap.
export const CHAT_ANSWER_MODELS  = ['gemini-2.5-pro'];

// Cheap vision pre-filter for palm photos. Flash answers yes/no on image
// quality before we spend Pro tokens on the full reading. Flash-lite is the
// fallback if Flash is rate-limited.
export const PALM_GATE_MODELS    = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

// Palm READING model chain. Use Pro for high-quality interpretation.
export const PALM_MODELS         = ['gemini-2.5-pro'];

// Biometric palm matching is ALWAYS on. Cosine-similarity threshold a NEW
// landmark embedding must clear to reuse a saved reading. Hardcoded (no DB
// Setting) so it works everywhere without seeding. Tune here if needed.
// Set to 0.90 (90%) as per recommended Level 2/3 fraud prevention.
export const PALM_MATCH_THRESHOLD_AUTO = 0.90; // Auto-show existing
export const PALM_MATCH_THRESHOLD_ASK  = 0.75; // Ask user

// Retry tuning for Gemini calls.
export const MAX_RETRIES   = 3;
export const RETRY_BASE_MS = 1000;       // exponential backoff: 1s, 2s, 4s

// Thinking-budget caps per task. Lower = cheaper, less internal reasoning.
// Kundli synthesizes the most factors → highest budget. Daily is pre-computed
// → lowest. Palm is descriptive vision → middle.
export const THINK_BUDGET = {
  KUNDLI:    768,
  PALM:      512,
  PALM_GATE: 0,    // yes/no decision — no internal reasoning needed
  PALM_COMPARE: 512, // text-only synthesis over two structured readings
  DAILY:     256,
  CHAT:      256,  // conversational answers — short, emotional, low-budget
};
