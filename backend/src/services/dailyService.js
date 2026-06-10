import { Op } from 'sequelize';
import { DailyData, User } from '../models/index.js';
import { callGemini } from '../ai/gemini.js';
import { DAILY_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { charge, grant, getBalance } from './creditService.js';
import { asContent } from '../utils/asContent.js';
import { cleanJson } from '../utils/cleanJson.js';
import { userKey } from '../utils/userKey.js';
import { KUNDLI_MODELS, THINK_BUDGET } from '../config/constants.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'daily' });

const today = () => new Date().toISOString().split('T')[0];

// GET saved daily guidance for a specific date (defaults to today).
export async function getSavedDaily(form, targetDate) {
  const user = await findUserByForm(form);
  if (!user) return null;
  const date = targetDate || today();
  const daily = await DailyData.findOne({ where: { userId: user.id, date } });
  return daily ? asContent(daily.guidance) : null;
}

// GET the list of dates that already have saved daily guidance for a user.
export async function getDailyDates(form) {
  const user = await findUserByForm(form);
  if (!user) return [];
  const rows = await DailyData.findAll({
    where: { userId: user.id },
    attributes: ['date'],
  });
  return rows.map((r) => r.date);
}

// POST — generate (with cache + dedupe), persist, return.
export async function generateDailyGuidance({ form, ctx, targetDate }) {
  const date = targetDate || today();

  return dedupe(`daily|${userKey(form)}|${date}`, async () => {
    const user = await findOrCreateUser(form);

    const existing = await DailyData.findOne({ where: { userId: user.id, date } });
    if (existing) return { content: asContent(existing.guidance), balance: await getBalance(user.id) };

    // New day → charge once. Saved days above are free re-views. Throws 402
    // INSUFFICIENT_CREDITS if the balance can't cover it.
    const { charged, balance } = await charge({
      userId: user.id, costKey: 'daily_cost', reason: 'daily', meta: { date },
    });

    // Same birth data + same date already generated for ANOTHER user (different
    // phone)? Daily guidance is deterministic from birth data + date, so the
    // answer is identical — reuse it instead of burning Gemini tokens. We still
    // write a row owned by THIS user so per-user lifecycle stays clean. Mirrors
    // the kundali sibling-copy: charged like a fresh day, just no AI call.
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
      const siblingDaily = await DailyData.findOne({ where: { userId: sibling.id, date } });
      if (siblingDaily) {
        try {
          await DailyData.create({ userId: user.id, date, guidance: siblingDaily.guidance });
          log.info({ userId: user.id, copiedFrom: sibling.id, date }, 'Daily copied from sibling user');
        } catch (saveError) {
          log.error({ err: saveError }, 'Daily sibling-copy save failed');
        }
        return { content: asContent(siblingDaily.guidance), balance };
      }
    }

    let generated;
    try {
      generated = await callGemini(DAILY_SYSTEM, ctx + "\n\nGive today's guidance.", true, KUNDLI_MODELS, THINK_BUDGET.DAILY);
      if (!generated) throw new Error('AI returned empty guidance');
    } catch (e) {
      if (charged) {
        await grant({ userId: user.id, amount: charged, reason: 'refund', meta: { for: 'daily', date } })
          .catch((err) => log.warn({ err: err.message }, 'daily refund failed'));
      }
      throw e;
    }

    const cleaned = cleanJson(generated);
    try {
      const parsed = typeof generated === 'string' ? JSON.parse(cleaned) : generated;
      await DailyData.create({ userId: user.id, date, guidance: parsed });
    } catch (saveError) {
      log.error({ err: saveError }, 'Daily save failed');
    }

    return { content: cleaned, balance };
  });
}
