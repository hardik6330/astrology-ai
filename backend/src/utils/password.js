import crypto from 'node:crypto';

// Password hashing via Node's built-in scrypt — no native bcrypt dependency, so
// it bundles cleanly on serverless. Output is `salt:hash` in hex; the salt is
// stored alongside the digest so verify() is self-contained.

const KEYLEN = 64;
const SALT_BYTES = 16;

export function hashPassword(plain) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const hash = crypto.scryptSync(String(plain), salt, KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

// Constant-time compare so a mismatch doesn't leak length/prefix via timing.
export function verifyPassword(plain, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(plain), salt, KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected);
}
