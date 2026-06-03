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

  // Engagement notifications (randomised "vibe" pushes). All times are IST.
  { key: 'notif_enabled',       value: 'true', description: 'Master switch for randomised engagement notifications' },
  { key: 'notif_source',        value: 'pool', description: "Notification text source: 'pool' (curated) or 'ai' (Flash-generated)" },
  { key: 'notif_audience',      value: 'all',  description: "Who receives it: 'all' | 'random_one' | 'random_sample'" },
  { key: 'notif_sample_pct',    value: '25',   description: 'Percent of users to send to when audience = random_sample' },
  { key: 'notif_window_start',  value: '9',    description: 'Earliest send hour, IST (0-23)' },
  { key: 'notif_window_end',    value: '21',   description: 'Latest send hour, IST (0-23, exclusive)' },
  { key: 'notif_min_gap_hours', value: '5',    description: 'Minimum random gap between sends (hours)' },
  { key: 'notif_max_gap_hours', value: '12',   description: 'Maximum random gap between sends (hours)' },
  { key: 'notif_max_tokens',    value: '500',  description: 'Max devices per send (caps fan-out so Vercel never times out)' },
  // Runtime state — the next scheduled send instant (epoch ms). Managed by the
  // engage job's atomic claim; admins normally leave this alone.
  { key: 'notif_next_at',       value: '0',    description: 'Internal: next engagement send time (epoch ms) — auto-managed' },
];

export async function seedSettings() {
  for (const s of SETTING_DEFAULTS) {
    await Setting.findOrCreate({ where: { key: s.key }, defaults: s });
  }
  logger.info('System settings seeded (missing keys created)');
}
