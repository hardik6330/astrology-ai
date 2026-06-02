import * as push from '../services/pushService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Each handler runs one campaign and reports the fan-out stats. Auth is the
// shared cron secret (see middleware/cronAuth.js), not a user JWT.
export const dailyMorning = asyncHandler(async (_req, res) => {
  res.json(await push.sendDailyMorning());
});

export const dailyEvening = asyncHandler(async (_req, res) => {
  res.json(await push.sendDailyEvening());
});

export const reEngagement = asyncHandler(async (_req, res) => {
  res.json(await push.sendReEngagement());
});
