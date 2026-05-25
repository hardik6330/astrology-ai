// Model chains
// - PRO: deep synthesis for kundli/daily/palm. No flash fallback — when Pro
//   fails 3×, frontend gets AI_OVERLOADED + retry UI (no quality downgrade).
// - FLASH: cheap descriptive tasks (chat, guard, palm vision if cost matters).
export const KUNDLI_MODELS = ['gemini-2.5-pro'];
export const FLASH_MODELS  = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
export const CHAT_MODELS   = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

// Retry tuning for Gemini calls.
export const MAX_RETRIES   = 3;
export const RETRY_BASE_MS = 1000;       // exponential backoff: 1s, 2s, 4s

// Thinking-budget caps per task. Lower = cheaper, less internal reasoning.
// Kundli synthesizes the most factors → highest budget. Daily is pre-computed
// → lowest. Palm is descriptive vision → middle.
export const THINK_BUDGET = {
  KUNDLI: 768,
  PALM:   512,
  DAILY:  256,
};
