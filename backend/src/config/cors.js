import { env } from './envConfig.js';

// In production: only the explicit comma-separated CORS_ORIGINS pass.
// In development: localhost (any port) and any 192.168.x.x:5173 LAN host —
// so testing from your phone works without env edits.
const DEV_ALLOW = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
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
      // Allow specific prod origins AND any vercel.app subdomain for easier previewing
      if (PROD_ALLOW.includes(origin) || origin.endsWith('.vercel.app')) {
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
