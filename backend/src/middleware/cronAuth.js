// Gate for the scheduled-push endpoints. External callers (cron-job.org /
// GitHub Actions) must send the shared secret in `x-cron-secret`. Uses a
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
  const provided = req.get('x-cron-secret') || '';
  if (!provided || !safeEqual(provided, env.CRON_SECRET)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
