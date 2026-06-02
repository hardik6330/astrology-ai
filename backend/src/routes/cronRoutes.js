// Scheduled-push triggers, fired by an external scheduler (cron-job.org /
// GitHub Actions) hitting these with the shared `x-cron-secret`. Suggested
// schedule: morning 08:00, evening 19:00, re-engagement once daily.

import { Router } from 'express';
import * as cron from '../controllers/cronController.js';
import { requireCronSecret } from '../middleware/cronAuth.js';

const router = Router();

router.use('/cron', requireCronSecret);
router.post('/cron/daily-morning', cron.dailyMorning);
router.post('/cron/daily-evening', cron.dailyEvening);
router.post('/cron/re-engagement', cron.reEngagement);

export default router;
