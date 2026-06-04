import * as auth from '../services/authService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { httpError } from '../middleware/errorHandler.js';
import { env } from '../config/envConfig.js';

// Public — lets clients discover the active auth mode (single source of truth),
// so the web/mobile login screens render the OTP flow vs the dummy flow without
// each hard-coding their own flag.
export const config = (_req, res) => {
  res.json({ otpService: env.FIREBASE_OTP_SERVICE });
};

export const verifyOtp = asyncHandler(async (req, res) => {
  const result = await auth.verifyOtp(req.body.idToken);
  res.json(result);
});

export const dummyLogin = asyncHandler(async (req, res) => {
  // When real OTP is enabled, the bypass login must be off — otherwise anyone
  // could log in as any phone with no SMS verification.
  if (env.FIREBASE_OTP_SERVICE) {
    throw httpError(403, 'Dummy login disabled — OTP verification required', 'OTP_REQUIRED');
  }
  const result = await auth.dummyLogin(req.body.phone);
  res.json(result);
});

// req.auth is set by the requireAuth middleware after verifying our JWT.
export const me = (req, res) => {
  res.json({ account: req.auth });
};
