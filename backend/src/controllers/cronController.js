import * as push from '../services/pushService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { httpError } from '../middleware/errorHandler.js';

// Single cron entrypoint. The external scheduler picks which campaign to run
// via the ?job= query param — one URL, one cron line per job.
const JOBS = {
  morning:  push.sendDailyMorning,   // ~08:00 — daily horoscope, all tokens
  evening:  push.sendDailyEvening,   // ~19:00 — evening reflection, all tokens
  reengage: push.sendReEngagement,   // once/day — users idle 3+ days
};

export const run = asyncHandler(async (req, res) => {
  const { job } = req.query;
  const handler = JOBS[job];
  if (!handler) {
    throw httpError(400, `unknown job '${job ?? ''}' — use one of: ${Object.keys(JOBS).join(', ')}`, 'BAD_JOB');
  }
  const result = await handler();
  res.json({ job, ...result });
});
