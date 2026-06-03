// One-time seed of the default system settings. Idempotent: existing keys are
// never overwritten (findOrCreate), so admin edits always win and re-running on
// boot is safe. Mirrors the adminSeed / location-seed pattern.

import { Setting } from '../models/index.js';
import { logger } from '../config/logger.js';

// Default configurable values. Values are strings (the column type); callers
// coerce with Number(). Keys match what settingsService / the admin UI expect.
export const SETTING_DEFAULTS = [
  { key: 'initial_credits', value: '200', description: 'Credits granted to a new user on first sign-up' },
  { key: 'chat_cost',       value: '5',   description: 'Credits deducted per AI astrologer chat message' },
  { key: 'insights_cost',   value: '20',  description: 'Credits deducted to unlock the AI insights for a profile' },
  { key: 'daily_cost',      value: '15',  description: 'Credits deducted per day to reveal daily guidance' },
  { key: 'palm_cost',       value: '30',  description: 'Credits deducted per palm reading' },
];

export async function seedSettings() {
  for (const s of SETTING_DEFAULTS) {
    await Setting.findOrCreate({ where: { key: s.key }, defaults: s });
  }
  logger.info('System settings seeded (missing keys created)');
}
