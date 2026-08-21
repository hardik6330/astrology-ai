import { env } from './envConfig.js';

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

// Retry tuning for Gemini calls.
export const MAX_RETRIES   = 3;
export const RETRY_BASE_MS = 1000;       // exponential backoff: 1s, 2s, 4s

// Timeout budgets (ms) — see envConfig. DEADLINE bounds total wall-clock across
// all attempts + backoff (keeps us under the host's function timeout); ATTEMPT
// bounds a single generateContent call.
export const GEMINI_DEADLINE_MS        = env.GEMINI_DEADLINE_MS;
export const GEMINI_ATTEMPT_TIMEOUT_MS = env.GEMINI_ATTEMPT_TIMEOUT_MS;

// Hard ceiling on response length per Gemini call (M1) — bounds cost/latency so
// a crafted prompt can't drive an unbounded generation. NOTE: on 2.5 "thinking"
// models this budget covers thinking + visible output, so it must sit well above
// the THINK_BUDGET values below. 8192 leaves ample room for our largest reading
// (the kundli JSON) after thinking; callers can override per task if needed.
export const MAX_OUTPUT_TOKENS = 8192;

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

// Published Gemini list prices in USD per 1M tokens, for COST TELEMETRY ONLY —
// never for billing. Kept here so `[gemini] usage` log lines carry a rupee-ish
// figure you can group by feature; the absolute number drifts whenever Google
// reprices (and ignores context-length tiers and cached-token discounts), but
// the RELATIVE cost between features is what the log is for.
// ponytail: flat rates, no tiering. Refresh from ai.google.dev/pricing.
export const MODEL_PRICE_USD_PER_MTOK = {
  'gemini-2.5-pro':        { in: 1.25, out: 10.00 },
  'gemini-2.5-flash':      { in: 0.30, out:  2.50 },
  'gemini-2.5-flash-lite': { in: 0.10, out:  0.40 },
};
