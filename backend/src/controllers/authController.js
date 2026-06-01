import * as auth from '../services/authService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const verifyOtp = asyncHandler(async (req, res) => {
  const result = await auth.verifyOtp(req.body.idToken);
  res.json(result);
});

export const dummyLogin = asyncHandler(async (req, res) => {
  const result = await auth.dummyLogin(req.body.phone);
  res.json(result);
});

// req.auth is set by the requireAuth middleware after verifying our JWT.
export const me = (req, res) => {
  res.json({ account: req.auth });
};
