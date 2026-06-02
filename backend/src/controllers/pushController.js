import * as push from '../services/pushService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// req.auth is set by requireAuth — tokens are always tied to a logged-in account.
export const register = asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  await push.registerToken(req.auth.accountId, token, platform);
  res.json({ ok: true });
});

export const unregister = asyncHandler(async (req, res) => {
  await push.unregisterToken(req.auth.accountId, req.body.token);
  res.json({ ok: true });
});
