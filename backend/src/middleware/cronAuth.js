// Gate for the scheduled-push endpoints. Callers prove they're the scheduler
// with a shared secret, sent either as `x-cron-secret` (external schedulers) or
// `Authorization: Bearer <secret>` (Vercel Cron's native scheme). Uses a
// constant-time compare so the secret can't be guessed by timing the response.

import { timingSafeEqual, createHash } from 'node:crypto';
import { env } from '../config/envConfig.js';
import { AppError } from '../errors/AppError.js';

// L2: compare SHA-256 digests (always 32 bytes) so the comparison never
// short-circuits on a length mismatch — that early return would otherwise leak
// the secret's length through response timing.
export function safeEqual(a, b) {
  const ah = createHash('sha256').update(String(a)).digest();
  const bh = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ah, bh);
}

export function requireCronSecret(req, res, next) {
  if (!env.CRON_SECRET) {
    return next(AppError.http(503, 'Cron not configured', 'CRON_NOT_CONFIGURED'));
  }
  // Accept either scheme:
  //  • `x-cron-secret: <secret>`         — external schedulers (cron-job.org / GH Actions)
  //  • `Authorization: Bearer <secret>`  — Vercel Cron (auto-sends this when CRON_SECRET env is set)
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const provided = req.get('x-cron-secret') || bearer || '';
  if (!provided || !safeEqual(provided, env.CRON_SECRET)) {
    return next(AppError.unauthorized());
  }
  next();
}
