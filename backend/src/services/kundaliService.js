import { Kundali } from '../models/index.js';
import { callGemini } from '../ai/gemini.js';
import { INTERP_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { asContent } from '../utils/asContent.js';
import { cleanJson } from '../utils/cleanJson.js';
import { userKey } from '../utils/userKey.js';
import { KUNDLI_MODELS, THINK_BUDGET } from '../config/constants.js';
import { logger } from '../config/logger.js';
import { httpError } from '../middleware/errorHandler.js';

const log = logger.child({ mod: 'kundali' });

// GET — retrieve only, never generates.
export async function getSavedInterpretation(form) {
  const user = await findUserByForm(form);
  if (!user) return null;
  const kundali = await Kundali.findOne({ where: { userId: user.id } });
  return kundali ? asContent(kundali.interpretation) : null;
}

// POST — generate (with cache + in-flight dedupe), persist, return.
export async function generateInterpretation({ form, factSheet }) {
  if (!factSheet) throw httpError(400, 'factSheet is required', 'BAD_REQUEST');

  return dedupe(`interpret|${userKey(form)}`, async () => {
    const user = await findOrCreateUser(form);

    // 1. Already saved? Return that.
    const existing = await Kundali.findOne({ where: { userId: user.id } });
    if (existing) return asContent(existing.interpretation);

    // 2. Call Gemini with the compact fact sheet (token-light).
    const userPrompt = `${factSheet}\n\nInterpret this birth chart.`;
    const generated = await callGemini(INTERP_SYSTEM, userPrompt, true, KUNDLI_MODELS, THINK_BUDGET.KUNDLI);

    // 3. Sanitize + parse + persist (best-effort — log but don't block the response).
    const cleaned = cleanJson(generated);
    try {
      const parsed = typeof generated === 'string' ? JSON.parse(cleaned) : generated;
      await Kundali.create({
        userId: user.id,
        chartData: { factSheet },
        interpretation: parsed,
      });
    } catch (saveError) {
      log.error({ err: saveError }, 'Kundali save failed');
    }

    return cleaned;
  });
}
