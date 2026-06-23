// Manual scheduled-push trigger. Selects the campaign via the ?job= query param,
// gated by requireCronSecret. The VPS no longer needs this for scheduling — the
// in-process node-cron scheduler (config/scheduler.js) drives every campaign,
// including the randomised engage poll. This route stays for manual/admin use
// (e.g. ?job=engage_now to force a test send) and any optional external cron.
// Both verbs hit the same handler: GET (Authorization: Bearer) and POST
// (x-cron-secret) are accepted.

import { Router } from 'express';
import * as cron from '../controllers/cronController.js';
import { requireCronSecret } from '../middleware/cronAuth.js';

const router = Router();

router.get('/cron/run', requireCronSecret, cron.run);
router.post('/cron/run', requireCronSecret, cron.run);

export default router;
