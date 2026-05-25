import { DailyData } from '../models/index.js';
import { callGemini } from '../ai/gemini.js';
import { DAILY_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
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
    if (existing) return asContent(existing.guidance);

    const generated = await callGemini(DAILY_SYSTEM, ctx + "\n\nGive today's guidance.", true, KUNDLI_MODELS, THINK_BUDGET.DAILY);
    const cleaned = cleanJson(generated);

    if (generated) {
      try {
        const parsed = typeof generated === 'string' ? JSON.parse(cleaned) : generated;
        await DailyData.create({ userId: user.id, date, guidance: parsed });
      } catch (saveError) {
        log.error({ err: saveError }, 'Daily save failed');
      }
    }

    return cleaned;
  });
}
