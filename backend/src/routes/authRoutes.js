// Phone-OTP auth endpoints. The OTP delivery + verification is done by
// Firebase on the client; we only see the resulting Firebase ID token,
// verify it server-side, then mint our own JWT. See services/authService.js.

import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { verifyBody, dummyBody } from '../validators/schemas.js';

const router = Router();

router.get ('/auth/config',      auth.config);   // public: which auth mode is active
router.post('/auth/verify-otp',  writeLimiter, validate(verifyBody, 'body'), auth.verifyOtp);
router.post('/auth/dummy-login', writeLimiter, validate(dummyBody, 'body'), auth.dummyLogin);
router.get ('/auth/me',          requireAuth,  auth.me);

export default router;
