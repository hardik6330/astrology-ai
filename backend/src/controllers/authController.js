import * as auth from '../services/authService.js';
import * as settings from '../services/settingsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Public bootstrap config the clients fetch on startup. Carries the force-update
// knobs (latest version + whether to block older clients). Read live from
// settings so the admin panel can flip them without a redeploy. The auth mode
// (OTP vs dummy) is now decided client-side via each client's env, not here.
// No store URL: the client redirects straight to its own store listing (built
// from its package id), so there's no link to configure.
export const config = asyncHandler(async (_req, res) => {
  res.json({
    latestVersion: (await settings.get('app_latest_version')) || null,
    forceUpdate: (await settings.get('app_force_update')) === 'true',
  });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const result = await auth.verifyOtp(req.body.idToken);
  res.json(result);
});

export const dummyLogin = asyncHandler(async (req, res) => {
  // Auth mode is enforced client-side (each client only hits this when its
  // OTP_SERVICE env flag is off), so the backend no longer gates this path.
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
