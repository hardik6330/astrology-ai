import { env } from './envConfig.js';

// In production: only the explicit comma-separated CORS_ORIGINS pass.
// In development: localhost (any port) and any 192.168.x.x:5173 LAN host —
// so testing from your phone works without env edits.
const DEV_ALLOW = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/144\.24\.117\.60(:\d+)?$/,
];

const PROD_ALLOW = (env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const corsOptions = {
  origin(origin, cb) {
    // Non-browser callers (server-to-server, curl, mobile webview) have no Origin.
    if (!origin) return cb(null, true);
    if (env.NODE_ENV === 'production') {
      // Only the explicit CORS_ORIGINS allowlist. The *.vercel.app wildcard is
      // opt-in (CORS_ALLOW_VERCEL_PREVIEWS) — with credentials:true it would
      // otherwise let ANY Vercel-hosted site call the API with the user's token.
      const vercelPreview =
        env.CORS_ALLOW_VERCEL_PREVIEWS === 'true' && /^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(origin);
      if (PROD_ALLOW.includes(origin) || vercelPreview) {
        return cb(null, true);
      }
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    }
    return DEV_ALLOW.some((re) => re.test(origin))
      ? cb(null, true)
      : cb(new Error(`CORS: origin ${origin} not allowed (dev allowlist)`));
  },
  credentials: true,
};
