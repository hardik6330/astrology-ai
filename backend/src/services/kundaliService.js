import { Op } from 'sequelize';
import { Kundali, User, Location, PalmReading } from '../models/index.js';
import { callGemini } from '../ai/gemini.js';
import { INTERP_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { charge, grant, getBalance } from './creditService.js';
import { notifyInsightReady } from './pushService.js';
import { asContent } from '../utils/asContent.js';
import { cleanJson } from '../utils/cleanJson.js';
import { fenceUntrusted, UNTRUSTED_DATA_GUARD } from '../utils/promptSafety.js';
import { userKey } from '../utils/userKey.js';
import { chartHashFor } from '../utils/chartHash.js';
import { KUNDLI_MODELS, THINK_BUDGET } from '../config/constants.js';
import { logger } from '../config/logger.js';
import { AppError } from '../errors/AppError.js';

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
  if (!factSheet) throw AppError.http(400, 'factSheet is required', 'BAD_REQUEST');

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
      // 2. This user's own latest clear palm reading (if any). Fetched up-front
      //    because it also gates whether a sibling's saved interpretation is
      //    safe to reuse below.
      const latestPalm = await PalmReading.findOne({
        where: { userId: user.id, imageQuality: 'clear' },
        order: [['createdAt', 'DESC']],
      });

      // 3. Same birth data already interpreted for ANOTHER user (different
      //    phone)? Reuse their chart + interpretation — chart math is
      //    deterministic from birth data, so a fresh Gemini call would just burn
      //    tokens. BUT a saved interpretation bakes in ITS OWN user's palm
      //    lines, so copying it to someone with a different (or no) palm would
      //    leak the wrong hand. Reuse only when the reading is palm-neutral on
      //    BOTH sides (neither user has a palm); otherwise fall through and
      //    generate fresh from THIS user's chart + their own palm (or none).
      if (!latestPalm) {
        // Match a sibling by the normalized birth-identity hash (one indexed
        // lookup, whitespace-tolerant — see utils/chartHash.js).
        const hash = chartHashFor({
          name: form.name, date: form.date, time: form.time, city: form.city, gender: form.gender,
        });
        const sibling = hash && await User.findOne({
          where: { chartHash: hash, id: { [Op.ne]: user.id } },
        });
        if (sibling) {
          const siblingKundali = await Kundali.findOne({ where: { userId: sibling.id } });
          const siblingPalm = await PalmReading.findOne({
            where: { userId: sibling.id, imageQuality: 'clear' },
          });
          // Only copy when the sibling's reading is chart-only too — else its
          // palm sentences would surface for a user who never uploaded a palm.
          if (siblingKundali && !siblingPalm) {
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
      }

      // 4. Build the palm block from THIS user's own reading (empty if none).
      let palmSnippet = '';
      if (latestPalm) {
        const p = latestPalm.reading;
        if (latestPalm.handType === 'Both') {
          palmSnippet =
            '\n\n=== AUTHORITATIVE PALM READING (Lived Reality) ===\n' +
            `EVOLUTION STORY: ${p.comparison?.evolution}\n` +
            `LEFT (Inborn): ${p.left?.overallVibe} | Life: ${p.left?.lifeLine} | Head: ${p.left?.headLine}\n` +
            `RIGHT (Current): ${p.right?.overallVibe} | Life: ${p.right?.lifeLine} | Head: ${p.right?.headLine}\n` +
            `ADVICE: ${p.comparison?.lifeAdvice}`;
        } else {
          palmSnippet =
            '\n\n=== AUTHORITATIVE PALM READING (Current Imprint) ===\n' +
            `HAND: ${latestPalm.handType}\n` +
            `VIBE: ${p.overallVibe}\n` +
            `LINES: Life: ${p.lifeLine} | Head: ${p.headLine} | Heart: ${p.heartLine} | Fate: ${p.fateLine}`;
        }
      }

      // 5. Call Gemini with the compact fact sheet (+ palm data when present).
      //    With no palm, instruct chart-only explicitly so the model never
      //    invents hand/line features despite the palm-aware system prompt.
      // The fact sheet is client-supplied free text — fence it so an embedded
      // "ignore previous instructions" can't hijack the reading (see promptSafety).
      const fencedFacts = fenceUntrusted(factSheet);
      const userPrompt = palmSnippet
        ? `${fencedFacts}${palmSnippet}\n\nInterpret this birth chart and palm data into a single master reading.`
        : `${fencedFacts}\n\nNo palm reading is available for this user. Interpret the birth chart ALONE into a master reading — base every statement on the chart only, and do NOT mention, reference, or invent any palm, hand, line, or mount features.`;
      const generated = await callGemini(INTERP_SYSTEM + UNTRUSTED_DATA_GUARD, userPrompt, true, KUNDLI_MODELS, THINK_BUDGET.KUNDLI);

      // 6. Sanitize + parse + persist (best-effort — log but don't block the response).
      const cleaned = cleanJson(generated);
      let parsed = cleaned; // fallback to the cleaned string if JSON.parse fails
      try {
        parsed = typeof generated === 'string' ? JSON.parse(cleaned) : generated;
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
      return { content: parsed, balance };
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
