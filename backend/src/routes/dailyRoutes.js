import { Router } from 'express';
import * as daily from '../controllers/dailyController.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { dailyBody, userQuery } from '../validators/schemas.js';

const router = Router();

router.get ('/daily',       readLimiter,  validate(userQuery, 'query'), daily.getSavedDaily);
router.get ('/daily-dates', readLimiter,  validate(userQuery, 'query'), daily.getDailyDates);
router.post('/daily',       writeLimiter, validate(dailyBody, 'body'),  daily.getDailyGuidance);

export default router;
