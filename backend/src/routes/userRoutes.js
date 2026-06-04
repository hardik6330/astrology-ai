import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { profileBody } from '../validators/schemas.js';
import * as user from '../controllers/userController.js';

// Authenticated user-profile writes. Mounted under /api in routes/index.js.
const router = Router();

router.post('/profile', requireAuth, writeLimiter, validate(profileBody, 'body'), user.saveProfile);

export default router;
