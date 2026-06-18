import { genAI } from '../config/aiConfig.js';
import {
  CHAT_MODELS, MAX_RETRIES, RETRY_BASE_MS, MAX_OUTPUT_TOKENS,
  GEMINI_DEADLINE_MS, GEMINI_ATTEMPT_TIMEOUT_MS,
} from '../config/constants.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'gemini' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 503 / 429 are transient — retry the SAME model with backoff. Everything else
// (incl. a timeout — see below) breaks out to the next model in the chain, then
// gives up gracefully. A timeout is NOT treated as same-model-retryable: a slow
// model would just time out again and burn the deadline.
const isTransient = (err) => /\b(503|429)\b/.test(err.message || '');

function overloadedError(cause) {
  const err = new Error('AI is busy right now. Please try again in a moment.');
  err.code = 'AI_OVERLOADED';
  err.cause = cause;
  return err;
}

// Reject if `promise` doesn't settle within `ms`. Promise.race can't truly abort
// the underlying request, but we ALSO pass the same budget to the SDK
// (requestOptions.timeout) so the fetch itself is cancelled — this race is the
// hard backstop guaranteeing a request never blocks past the budget regardless.
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`Gemini call exceeded ${ms}ms`);
      e.code = 'GEMINI_TIMEOUT';
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Strip 'rule' strings from planets/aspects + trim long dasha lists so the
 * chart JSON sent to the LLM is token-light.
 */
export function minimizeChart(chart) {
  if (!chart) return chart;
  const c = JSON.parse(JSON.stringify(chart));
  if (c.planets) c.planets = c.planets.map(({ rule, ...rest }) => rest);
  if (c.aspects) c.aspects = c.aspects.map(({ rule, ...rest }) => rest);
  if (c.dasha) {
    const now = new Date();
    const curIdx = c.dasha.findIndex(m => new Date(m.end) >= now);
    if (curIdx !== -1) {
      c.dasha = c.dasha.slice(Math.max(0, curIdx - 1), curIdx + 4);
    } else {
      c.dasha = c.dasha.slice(0, 5);
    }
  }
  return c;
}

/**
 * Shared retry + model-fallback + timeout core for every Gemini call shape.
 *   parts  — the content array (text / inlineData) to send.
 *   label  — (modelName) => string tagging the usage log line.
 * Bounds total time with an overall DEADLINE across all attempts + backoff so a
 * slow/hung generation can't run past the host's function timeout; on timeout or
 * exhaustion it throws AI_OVERLOADED (the graceful retry-UI path), never a 500.
 */
async function generateWithRetry({ models, parts, jsonMode, thinkingBudget, maxOutputTokens, label }) {
  let lastError;
  const deadline = Date.now() + GEMINI_DEADLINE_MS;

  for (const modelName of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) { lastError ??= new Error('Gemini deadline exceeded'); break; }
      const attemptMs = Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remaining);
      try {
        const startTime = Date.now();
        const generationConfig = {
          temperature: 1.0,
          maxOutputTokens,
          ...(jsonMode && { responseMimeType: 'application/json' }),
          ...(thinkingBudget !== null && { thinkingConfig: { thinkingBudget } }),
        };
        const model = genAI.getGenerativeModel(
          { model: modelName, generationConfig },
          { timeout: attemptMs },
        );
        const result = await withTimeout(model.generateContent(parts), attemptMs);
        const response = await result.response;
        const text = response.text();
        const duration = Date.now() - startTime;
        const u = response.usageMetadata || {};
        log.info(`${label(modelName)} thinking=${thinkingBudget ?? '-'} prompt=${u.promptTokenCount ?? '?'} out=${u.candidatesTokenCount ?? '?'} total=${u.totalTokenCount ?? '?'} (${duration}ms)`);
        return text;
      } catch (error) {
        lastError = error;
        // Non-transient (real error or timeout) → stop retrying this model, try
        // the next in the chain. Only 503/429 retry the same model.
        if (!isTransient(error)) break;
        const backoff = RETRY_BASE_MS * 2 ** (attempt - 1);
        // Only back off if there's budget left for it AND another attempt.
        if (attempt < MAX_RETRIES && (deadline - Date.now()) > backoff) await sleep(backoff);
      }
    }
  }
  throw overloadedError(lastError);
}

/**
 * Text-only Gemini call with retry + model fallback.
 *   thinkingBudget — caps Pro's internal reasoning tokens (cheaper = lower).
 *   Pass null to use Google's default dynamic behavior.
 */
export async function callGemini(systemPrompt, userPrompt, jsonMode = false, models = CHAT_MODELS, thinkingBudget = null, maxOutputTokens = MAX_OUTPUT_TOKENS) {
  return generateWithRetry({
    models, jsonMode, thinkingBudget, maxOutputTokens,
    parts: [{ text: `SYSTEM: ${systemPrompt}` }, { text: `USER: ${userPrompt}` }],
    label: (m) => `[Gemini] ${m}`,
  });
}

/**
 * Multi-image Gemini Vision call. `images` is an array of
 * { base64, mimeType } — each one passed in order to the model. Useful for
 * the Both-Hands palm comparison where Pro sees BOTH photos in one call.
 */
export async function callGeminiVisionMulti(systemPrompt, userPrompt, images, jsonMode = true, models = CHAT_MODELS, thinkingBudget = null, maxOutputTokens = MAX_OUTPUT_TOKENS) {
  const parts = [{ text: `SYSTEM: ${systemPrompt}` }];
  for (const img of images) {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType || 'image/jpeg' } });
  }
  parts.push({ text: `USER: ${userPrompt}` });
  return generateWithRetry({
    models, jsonMode, thinkingBudget, maxOutputTokens, parts,
    label: (m) => `[Gemini Vision Multi] ${m} images=${images.length}`,
  });
}

/**
 * Multimodal Gemini call — image + text. Same retry/fallback as callGemini.
 * imageBase64 must be raw base64 (no `data:` prefix).
 */
export async function callGeminiVision(systemPrompt, userPrompt, imageBase64, mimeType = 'image/jpeg', jsonMode = true, models = CHAT_MODELS, thinkingBudget = null, maxOutputTokens = MAX_OUTPUT_TOKENS) {
  return generateWithRetry({
    models, jsonMode, thinkingBudget, maxOutputTokens,
    parts: [
      { text: `SYSTEM: ${systemPrompt}` },
      { inlineData: { data: imageBase64, mimeType } },
      { text: `USER: ${userPrompt}` },
    ],
    label: (m) => `[Gemini Vision] ${m}`,
  });
}
