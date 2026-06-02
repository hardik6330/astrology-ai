import { Op } from 'sequelize';
import { Kundali, User } from '../models/index.js';
import { callGemini } from '../ai/gemini.js';
import { INTERP_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { notifyInsightReady } from './pushService.js';
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

    // Notify this user's devices their insight is ready. Fire-and-forget on
    // EVERY return path (cached / sibling-copy / fresh) so the push lands
    // whenever an interpretation is delivered, not only on first generation.
    const fireInsightPush = () =>
      notifyInsightReady(user.phone || form.phone)
        .catch((err) => log.warn({ err: err.message }, 'insight-ready push failed'));

    // 1. Already saved for THIS user? Return that.
    const existing = await Kundali.findOne({ where: { userId: user.id } });
    if (existing) {
      fireInsightPush();
      return asContent(existing.interpretation);
    }

    // 2. Same birth data already interpreted for ANOTHER user (different
    //    phone)? Reuse the existing chart + interpretation — chart math is
    //    deterministic from birth data, so the answer is identical and a
    //    fresh Gemini call would just burn tokens. We still create a new
    //    Kundali row owned by THIS user so per-user lifecycle (delete,
    //    re-interpret) stays clean.
    const sibling = await User.findOne({
      where: {
        name: form.name,
        birthDate: form.date,
        birthTime: form.time,
        birthCity: form.city,
        gender: form.gender || null,
        id: { [Op.ne]: user.id },
      },
    });
    if (sibling) {
      const siblingKundali = await Kundali.findOne({ where: { userId: sibling.id } });
      if (siblingKundali) {
        try {
          await Kundali.create({
            userId: user.id,
            chartData: siblingKundali.chartData,
            interpretation: siblingKundali.interpretation,
          });
          log.info({ userId: user.id, copiedFrom: sibling.id }, 'Kundali copied from sibling user');
        } catch (saveError) {
          log.error({ err: saveError }, 'Kundali sibling-copy save failed');
        }
        fireInsightPush();
        return asContent(siblingKundali.interpretation);
      }
    }

    // 3. Call Gemini with the compact fact sheet (token-light).
    const userPrompt = `${factSheet}\n\nInterpret this birth chart.`;
    const generated = await callGemini(INTERP_SYSTEM, userPrompt, true, KUNDLI_MODELS, THINK_BUDGET.KUNDLI);

    // 4. Sanitize + parse + persist (best-effort — log but don't block the response).
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

    fireInsightPush();
    return cleaned;
  });
}
