// In-process push scheduler (node-cron). Drives the fixed daily campaigns at IST
// times AND polls the randomised "vibe" engagement job — no HTTP, no cron secret.
// This is the ONLY thing that fires pushes on the VPS; the `/api/cron/run` route
// remains only for manual/admin triggers (e.g. engage_now), not for scheduling.
//
// ⚠️ Requires the always-on host (the VPS) where the process stays alive so the
// timers keep firing.

import cron from 'node-cron';
import { sendDailyMorning, sendDailyEvening, sendReEngagement } from '../services/pushService.js';
import { sendEngagement } from '../services/engageService.js';
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
  cron.schedule('0 16 * * *', () => run('evening',  sendDailyEvening),  TZ);  // 16:00 IST
  cron.schedule('0 10 * * *', () => run('reengage', sendReEngagement),  TZ);  // 10:00 IST
  // Randomised "vibe" push: poll every 15 min. sendEngagement() self-gates on the
  // notif_next_at CAS, so most ticks no-op until a randomly-chosen time is due —
  // the frequent poll just bounds how close to that time it actually fires.
  cron.schedule('*/15 * * * *', () => run('engage', () => sendEngagement({ force: false })), TZ);
  log.info('Push scheduler started (Asia/Kolkata) — morning 08:00, evening 16:00, reengage 10:00, engage every 15m');
}
