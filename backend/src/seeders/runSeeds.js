import { seedAdmin } from './adminSeed.js';
import { seedSettings } from './settingsSeed.js';
import { seedNotificationTemplates } from './notificationSeed.js';
import { seedCreditPlans } from './creditPlanSeed.js';
import { logger } from '../config/logger.js';

// Idempotent default-data seeds (admin, settings, credit plans, notification
// templates). Safe to re-run. On an always-on host this runs once at boot; on
// serverless it runs in the deploy step via `npm run seed` — running it on every
// cold start would waste DB round-trips on the request hot path. Each seed is
// independent, so one failing only warns and never blocks the others.
export async function seedDefaults() {
  await Promise.all([
    seedAdmin().catch((err) => logger.warn({ err }, 'Admin seed skipped')),
    seedSettings().catch((err) => logger.warn({ err }, 'Settings seed skipped')),
    seedNotificationTemplates().catch((err) => logger.warn({ err }, 'Notification seed skipped')),
    seedCreditPlans().catch((err) => logger.warn({ err }, 'Credit plan seed skipped')),
  ]);
  logger.info('Default-data seeds applied');
}
