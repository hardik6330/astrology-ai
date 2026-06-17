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

// M2: admin tokens are signed with a DEDICATED secret (falls back to JWT_SECRET
// only in dev — prod requires a distinct ADMIN_JWT_SECRET, enforced in
// envConfig). A user JWT therefore can't be verified as an admin token even if
// the `role` claim were forged, and a leak of one secret can't mint the other.
const ADMIN_SECRET = env.ADMIN_JWT_SECRET || env.JWT_SECRET;
const ADMIN_AUD = 'astro-admin';

// Admin session token. Signed with the admin secret + an `aud` claim so it's
// only ever accepted by requireAdmin, never by requireAuth (different secret).
export function signAdminToken({ adminId, username }) {
  return jwt.sign(
    { adminId, username, role: 'admin' },
    ADMIN_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, audience: ADMIN_AUD },
  );
}

// Guards back-office routes: token must verify against the admin secret+audience
// AND carry role === 'admin'. On success: req.admin = { adminId, username, role }.
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, ADMIN_SECRET, { audience: ADMIN_AUD });
    if (payload.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}
