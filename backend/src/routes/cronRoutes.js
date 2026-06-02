// Single scheduled-push trigger, fired by an external scheduler (cron-job.org /
// GitHub Actions) hitting it with the shared `x-cron-secret` header and a ?job=
// query param. Suggested schedule:
//   POST /api/cron/run?job=morning    @ 08:00
//   POST /api/cron/run?job=evening    @ 19:00
//   POST /api/cron/run?job=reengage   once daily

import { Router } from 'express';
import * as cron from '../controllers/cronController.js';
import { requireCronSecret } from '../middleware/cronAuth.js';

const router = Router();

router.post('/cron/run', requireCronSecret, cron.run);

export default router;
