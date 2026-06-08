import { Op } from 'sequelize';
import { Kundali, User, Location } from '../models/index.js';
import { callGemini } from '../ai/gemini.js';
import { INTERP_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { charge, grant, getBalance } from './creditService.js';
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

    // Push "your insight is ready" to this user's registered devices. Fired only
    // when the insight is NEWLY produced for them (fresh generation or first
    // sibling-copy) — not on plain cache hits. Fire-and-forget; never blocks.
    const fireInsightPush = () =>
      notifyInsightReady(user.phone || form.phone)
        .catch((err) => log.warn({ err: err.message }, 'insight-ready push failed'));

    // 1. Already saved for THIS user? Return that — already unlocked, so it's a
    //    free re-view (no charge, no push).
    const existing = await Kundali.findOne({ where: { userId: user.id } });
    if (existing) {
      return { content: asContent(existing.interpretation), balance: await getBalance(user.id) };
    }

    // New insight for this profile → charge once. A saved insight above is free;
    // changing birth details makes a new profile, so it charges again. Throws
    // 402 INSUFFICIENT_CREDITS (surfaced to the client) if the balance is short.
    const { charged, balance } = await charge({
      userId: user.id, costKey: 'insights_cost', reason: 'insights',
    });

    // Resolve locationId from the form (placeId) or city name lookup.
    let locationId = null;
    if (form.placeId) {
      const loc = await Location.findOne({ where: { placeId: form.placeId } });
      locationId = loc?.id || null;
    }
    if (!locationId && form.city) {
      const loc = await Location.findOne({ where: { searchName: form.city } });
      locationId = loc?.id || null;
    }

    try {
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
              locationId: siblingKundali.locationId,
              chartData: siblingKundali.chartData,
              interpretation: siblingKundali.interpretation,
            });
            log.info({ userId: user.id, copiedFrom: sibling.id }, 'Kundali copied from sibling user');
          } catch (saveError) {
            log.error({ err: saveError }, 'Kundali sibling-copy save failed');
          }
          fireInsightPush();
          return { content: asContent(siblingKundali.interpretation), balance };
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
          locationId,
          chartData: { factSheet },
          interpretation: parsed,
        });
      } catch (saveError) {
        log.error({ err: saveError }, 'Kundali save failed');
      }

      fireInsightPush();
      return { content: cleaned, balance };
    } catch (e) {
      // Generation failed after we charged — refund so the user isn't billed
      // for an insight they didn't get.
      if (charged) {
        await grant({ userId: user.id, amount: charged, reason: 'refund', meta: { for: 'insights' } })
          .catch((err) => log.warn({ err: err.message }, 'insights refund failed'));
      }
      throw e;
    }
  });
}
