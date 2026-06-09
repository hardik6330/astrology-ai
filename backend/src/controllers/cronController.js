import * as push from '../services/pushService.js';
import { sendEngagement } from '../services/engageService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../errors/AppError.js';

// Single cron entrypoint. The external scheduler picks which campaign to run
// via the ?job= query param — one URL, one cron line per job.
const JOBS = {
  morning:  push.sendDailyMorning,   // ~08:00 — daily horoscope, all tokens
  evening:  push.sendDailyEvening,   // ~19:00 — evening reflection, all tokens
  reengage: push.sendReEngagement,   // once/day — users idle 3+ days
  // Randomised "vibe" push. Point an HOURLY cron at ?job=engage — the handler
  // decides (via notif_next_at) whether this tick actually sends, giving random
  // timing without a random scheduler. ?job=engage_now forces an immediate send
  // (testing / admin "send test now"), bypassing the window + schedule.
  engage:     () => sendEngagement({ force: false }),
  engage_now: () => sendEngagement({ force: true }),
};

export const run = asyncHandler(async (req, res) => {
  const { job } = req.query;
  const handler = JOBS[job];
  if (!handler) {
    throw AppError.http(400, `unknown job '${job ?? ''}' — use one of: ${Object.keys(JOBS).join(', ')}`, 'BAD_JOB');
  }
  const result = await handler();
  res.json({ job, ...result });
});
