// Verifies our own JWT on every protected request. The token is minted in
// /api/auth/verify-otp once we've confirmed the Firebase ID token.
//
// On success: req.auth = { accountId, firebaseUid, phone }
// On failure: 401 with { error: 'unauthorized' }.

import jwt from 'jsonwebtoken';
import { env } from '../config/envConfig.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export function signAppToken({ accountId, firebaseUid, phone }) {
  return jwt.sign(
    { accountId, firebaseUid, phone },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}
