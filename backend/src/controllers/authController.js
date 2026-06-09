import * as auth from '../services/authService.js';
import * as settings from '../services/settingsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../errors/AppError.js';
import { env } from '../config/envConfig.js';

// Public bootstrap config the clients fetch on startup. Carries the active auth
// mode (so login screens render OTP vs dummy without hard-coding a flag) and the
// force-update knobs (latest version + whether to block older clients). Read
// live from settings so the admin panel can flip them without a redeploy.
export const config = asyncHandler(async (_req, res) => {
  res.json({
    otpService: env.FIREBASE_OTP_SERVICE,
    latestVersion: (await settings.get('app_latest_version')) || null,
    forceUpdate: (await settings.get('app_force_update')) === 'true',
    updateUrl: (await settings.get('app_update_url')) || '',
  });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const result = await auth.verifyOtp(req.body.idToken);
  res.json(result);
});

export const dummyLogin = asyncHandler(async (req, res) => {
  // When real OTP is enabled, the bypass login must be off — otherwise anyone
  // could log in as any phone with no SMS verification.
  if (env.FIREBASE_OTP_SERVICE) {
    throw AppError.http(403, 'Dummy login disabled — OTP verification required', 'OTP_REQUIRED');
  }
  const result = await auth.dummyLogin(req.body.phone);
  res.json(result);
});

// req.auth is set by the requireAuth middleware after verifying our JWT.
// Returns the saved birth form too so a returning user who reopened the app
// (token persisted, but the client-side form was wiped) re-hydrates their
// chart and lands back on their reading instead of the empty form.
export const me = asyncHandler(async (req, res) => {
  const savedForm = await auth.findSavedFormByPhone(req.auth.phone);
  res.json({ account: req.auth, savedForm });
});
