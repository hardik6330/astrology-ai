// Device push-token registration. Both endpoints require a logged-in account —
// a token is meaningless without knowing who to notify.

import { Router } from 'express';
import * as push from '../controllers/pushController.js';
import { requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { pushRegisterBody, pushUnregisterBody } from '../validators/schemas.js';

const router = Router();

router.post('/push/register',   requireAuth, writeLimiter, validate(pushRegisterBody, 'body'),   push.register);
router.post('/push/unregister', requireAuth, writeLimiter, validate(pushUnregisterBody, 'body'), push.unregister);

export default router;
