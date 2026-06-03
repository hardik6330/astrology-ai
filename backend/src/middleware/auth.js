// Verifies our own JWT on every protected request. The token is minted in
// /api/auth/verify-otp once we've confirmed the Firebase ID token.
//
// On success: req.auth = { accountId, firebaseUid, phone, userId }
//   (userId is the User-row id when one existed at login, else null)
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

export function signAppToken({ accountId, firebaseUid, phone, userId = null }) {
  return jwt.sign(
    { accountId, firebaseUid, phone, userId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

// Admin session token. `role: 'admin'` distinguishes it from a user token so
// requireAdmin can reject ordinary user JWTs even though both are signed with
// the same secret.
export function signAdminToken({ adminId, username }) {
  return jwt.sign(
    { adminId, username, role: 'admin' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

// Guards back-office routes: valid JWT AND role === 'admin'.
// On success: req.admin = { adminId, username, role }.
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}
