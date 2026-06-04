// Gate for the scheduled-push endpoints. Callers prove they're the scheduler
// with a shared secret, sent either as `x-cron-secret` (external schedulers) or
// `Authorization: Bearer <secret>` (Vercel Cron's native scheme). Uses a
// constant-time compare so the secret can't be guessed by timing the response.

import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/envConfig.js';

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function requireCronSecret(req, res, next) {
  if (!env.CRON_SECRET) {
    return res.status(503).json({ error: 'cron_not_configured', code: 'CRON_NOT_CONFIGURED' });
  }
  // Accept either scheme:
  //  • `x-cron-secret: <secret>`         — external schedulers (cron-job.org / GH Actions)
  //  • `Authorization: Bearer <secret>`  — Vercel Cron (auto-sends this when CRON_SECRET env is set)
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const provided = req.get('x-cron-secret') || bearer || '';
  if (!provided || !safeEqual(provided, env.CRON_SECRET)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
