// Single scheduled-push trigger. Selects the campaign via the ?job= query param.
// Two callers are supported (both gated by requireCronSecret):
//   • Vercel Cron      → GET  (Vercel only issues GET; auth via Authorization: Bearer)
//   • External cron    → POST (cron-job.org / GitHub Actions; auth via x-cron-secret)
// Schedules live in vercel.json (engage hourly, morning/evening/reengage daily).

import { Router } from 'express';
import * as cron from '../controllers/cronController.js';
import { requireCronSecret } from '../middleware/cronAuth.js';

const router = Router();

// GET for Vercel Cron, POST for external schedulers — same handler.
router.get('/cron/run', requireCronSecret, cron.run);
router.post('/cron/run', requireCronSecret, cron.run);

export default router;
