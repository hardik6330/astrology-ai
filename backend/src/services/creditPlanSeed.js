// One-time seed of default credit plans. Only inserted when the table is empty,
// so admin curation (edits / new plans / disabled plans) is always preserved.
// Mirrors settingsSeed. Prices are in paise (₹1 = 100).

import { CreditPlan } from '../models/index.js';
import { logger } from '../config/logger.js';

export const PLAN_DEFAULTS = [
  { name: 'Starter',   credits: 100,  priceInr: 4900,  bonusLabel: null,           sortOrder: 1 },
  { name: 'Popular',   credits: 500,  priceInr: 19900, bonusLabel: 'Most Popular', sortOrder: 2 },
  { name: 'Pro',       credits: 1200, priceInr: 39900, bonusLabel: 'Best Value',   sortOrder: 3 },
];

export async function seedCreditPlans() {
  const count = await CreditPlan.count();
  if (count > 0) return; // admin has curated plans — leave them alone
  await CreditPlan.bulkCreate(PLAN_DEFAULTS.map((p) => ({ ...p, active: true })));
  logger.info('Credit plans seeded (table was empty)');
}
