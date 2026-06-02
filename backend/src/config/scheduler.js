// In-process push scheduler (node-cron). Calls the campaign functions directly
// at fixed IST times — no HTTP, no cron secret needed.
//
// ⚠️ Only ticks on a PERSISTENT host (Railway / Render / Fly) where the process
// stays alive. On Vercel serverless the function dies after each request, so the
// timers never fire — use the external GitHub Actions / cron-job.org path there.

import cron from 'node-cron';
import { sendDailyMorning, sendDailyEvening, sendReEngagement } from '../services/pushService.js';
import { logger } from './logger.js';

const log = logger.child({ mod: 'scheduler' });

// node-cron honours an IANA timezone, so we write IST times directly.
const TZ = { timezone: 'Asia/Kolkata' };

async function run(name, fn) {
  try {
    const res = await fn();
    log.info({ job: name, ...res }, 'scheduled push sent');
  } catch (err) {
    log.error({ job: name, err: err.message }, 'scheduled push failed');
  }
}

export function startScheduler() {
  cron.schedule('0 8 * * *',  () => run('morning',  sendDailyMorning),  TZ);  // 08:00 IST
  cron.schedule('0 19 * * *', () => run('evening',  sendDailyEvening),  TZ);  // 19:00 IST
  cron.schedule('0 10 * * *', () => run('reengage', sendReEngagement),  TZ);  // 10:00 IST
  log.info('Push scheduler started (Asia/Kolkata) — morning 08:00, evening 19:00, reengage 10:00');
}
