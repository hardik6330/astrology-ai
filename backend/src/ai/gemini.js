import { genAI } from '../config/aiConfig.js';
import { CHAT_MODELS, MAX_RETRIES, RETRY_BASE_MS, MAX_OUTPUT_TOKENS } from '../config/constants.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'gemini' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 503 / 429 are transient — retry. Everything else is a real bug, give up.
const isTransient = (err) => /\b(503|429)\b/.test(err.message || '');

function overloadedError(cause) {
  const err = new Error('AI is busy right now. Please try again in a moment.');
  err.code = 'AI_OVERLOADED';
  err.cause = cause;
  return err;
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
 * Text-only Gemini call with retry + model fallback.
 *   thinkingBudget — caps Pro's internal reasoning tokens (cheaper = lower).
 *   Pass null to use Google's default dynamic behavior.
 */
export async function callGemini(systemPrompt, userPrompt, jsonMode = false, models = CHAT_MODELS, thinkingBudget = null, maxOutputTokens = MAX_OUTPUT_TOKENS) {
  let lastError;

  for (const modelName of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const startTime = Date.now();
        const generationConfig = {
          temperature: 1.0,
          maxOutputTokens,
          ...(jsonMode && { responseMimeType: 'application/json' }),
          ...(thinkingBudget !== null && { thinkingConfig: { thinkingBudget } }),
        };
        const model = genAI.getGenerativeModel({
          model: modelName,
          ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
        });
        const result = await model.generateContent([
          { text: `SYSTEM: ${systemPrompt}` },
          { text: `USER: ${userPrompt}` },
        ]);
        const response = await result.response;
        const text = response.text();
        const duration = Date.now() - startTime;
        const u = response.usageMetadata || {};
        log.info(`[Gemini] ${modelName} thinking=${thinkingBudget ?? '-'} prompt=${u.promptTokenCount ?? '?'} out=${u.candidatesTokenCount ?? '?'} total=${u.totalTokenCount ?? '?'} (${duration}ms)`);
        return text;
      } catch (error) {
        lastError = error;
        if (!isTransient(error)) break;
        if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
      }
    }
  }
  throw overloadedError(lastError);
}

/**
 * Multi-image Gemini Vision call. `images` is an array of
 * { base64, mimeType } — each one passed in order to the model. Useful for
 * the Both-Hands palm comparison where Pro sees BOTH photos in one call.
 * Same retry/fallback semantics as callGeminiVision.
 */
export async function callGeminiVisionMulti(systemPrompt, userPrompt, images, jsonMode = true, models = CHAT_MODELS, thinkingBudget = null, maxOutputTokens = MAX_OUTPUT_TOKENS) {
  let lastError;
  for (const modelName of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const startTime = Date.now();
        const generationConfig = {
          temperature: 1.0,
          maxOutputTokens,
          ...(jsonMode && { responseMimeType: 'application/json' }),
          ...(thinkingBudget !== null && { thinkingConfig: { thinkingBudget } }),
        };
        const model = genAI.getGenerativeModel({
          model: modelName,
          ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
        });
        const parts = [{ text: `SYSTEM: ${systemPrompt}` }];
        for (const img of images) {
          parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType || 'image/jpeg' } });
        }
        parts.push({ text: `USER: ${userPrompt}` });
        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();
        const duration = Date.now() - startTime;
        const u = response.usageMetadata || {};
        log.info(`[Gemini Vision Multi] ${modelName} images=${images.length} thinking=${thinkingBudget ?? '-'} prompt=${u.promptTokenCount ?? '?'} out=${u.candidatesTokenCount ?? '?'} total=${u.totalTokenCount ?? '?'} (${duration}ms)`);
        return text;
      } catch (error) {
        lastError = error;
        if (!isTransient(error)) break;
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
        }
      }
    }
  }
  throw overloadedError(lastError);
}

/**
 * Multimodal Gemini call — image + text. Same retry/fallback as callGemini.
 * imageBase64 must be raw base64 (no `data:` prefix).
 */
export async function callGeminiVision(systemPrompt, userPrompt, imageBase64, mimeType = 'image/jpeg', jsonMode = true, models = CHAT_MODELS, thinkingBudget = null, maxOutputTokens = MAX_OUTPUT_TOKENS) {
  let lastError;

  for (const modelName of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const startTime = Date.now();
        const generationConfig = {
          temperature: 1.0,
          maxOutputTokens,
          ...(jsonMode && { responseMimeType: 'application/json' }),
          ...(thinkingBudget !== null && { thinkingConfig: { thinkingBudget } }),
        };
        const model = genAI.getGenerativeModel({
          model: modelName,
          ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
        });
        const result = await model.generateContent([
          { text: `SYSTEM: ${systemPrompt}` },
          { inlineData: { data: imageBase64, mimeType } },
          { text: `USER: ${userPrompt}` },
        ]);
        const response = await result.response;
        const text = response.text();
        const duration = Date.now() - startTime;
        const u = response.usageMetadata || {};
        log.info(`[Gemini Vision] ${modelName} thinking=${thinkingBudget ?? '-'} prompt=${u.promptTokenCount ?? '?'} out=${u.candidatesTokenCount ?? '?'} total=${u.totalTokenCount ?? '?'} (${duration}ms)`);
        return text;
      } catch (error) {
        lastError = error;
        if (!isTransient(error)) break;
        if (attempt < MAX_RETRIES) {
          const wait = RETRY_BASE_MS * 2 ** (attempt - 1);
          await sleep(wait);
        }
      }
    }
  }
  throw overloadedError(lastError);
}

