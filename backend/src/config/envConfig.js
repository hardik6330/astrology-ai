import 'dotenv/config';
import { z } from 'zod';

// Validate env at boot — server crashes hard with a clear message if anything
// required is missing or malformed, instead of failing silently on first request.
const schema = z.object({
  NODE_ENV:        z.enum(['development', 'production', 'test']).default('development'),
  PORT:            z.coerce.number().default(5000),
  GEMINI_API_KEY:  z.string().min(1, 'GEMINI_API_KEY is required'),
  // Gemini call budgets (ms). DEADLINE caps total wall-clock across ALL retries +
  // backoff so a slow generation can't run past the host's request/function
  // timeout (Vercel: 60s Pro default → a hang there returns a raw 500 instead of
  // a graceful AI_OVERLOADED). ATTEMPT caps a single try. Raise both on an
  // always-on host with a higher request timeout.
  GEMINI_DEADLINE_MS:        z.coerce.number().default(55_000),
  GEMINI_ATTEMPT_TIMEOUT_MS: z.coerce.number().default(45_000),
  // Comma-separated list of allowed frontend origins in production.
  // In dev we use a permissive localhost/LAN allowlist regardless of this var.
  CORS_ORIGINS:    z.string().optional(),
  DB_HOST:         z.string().default('localhost'),
  DB_PORT:         z.coerce.number().default(3306),
  DB_USER:         z.string().default('root'),
  DB_PASS:         z.string().default(''),
  DB_NAME:         z.string().default('astrology_db'),
  // Optional TLS to the database. Railway's public host is reachable over the
  // internet, so turn this on for anything real. DB_SSL_CA points at the
  // provider's CA .pem for actual verification; without it TLS still encrypts
  // but the cert isn't verified. Provider-agnostic on purpose.
  DB_SSL:          z.string().optional(),
  DB_SSL_CA:       z.string().optional(),
  // Connection-pool sizing. Serverless (Vercel) runs MANY concurrent λ, each its
  // own process holding its own pool — keep it SMALL or concurrent λ exhaust
  // MySQL's max_connections. An always-on host runs ONE process and wants a
  // LARGER pool. Left unset, dbConfig.js auto-picks by environment (2 on Vercel,
  // 10 otherwise); set these to tune against your DB's max_connections.
  DB_POOL_MAX:     z.coerce.number().optional(),
  DB_POOL_MIN:     z.coerce.number().optional(),
  // OTP bypass toggle. Local dev (NODE_ENV!=='production') always allows the
  // bare-`phone` bypass regardless of this value. In production it stays OFF
  // unless you explicitly set OTP_ENABLED='false' to allow the bypass on a LIVE
  // deployment for testing (⚠️ insecure — flip back to 'true' before launch).
  // Default 'true' = real Firebase OTP. See authService.js bypassOtp().
  OTP_ENABLED:     z.enum(['true', 'false']).default('true'),
  // Error tracking. Unset = Sentry never initialises (dev/test default).
  SENTRY_DSN:                 z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE:  z.coerce.number().min(0).max(1).default(0),
  JWT_SECRET:      z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  // M2: dedicated secret for back-office admin tokens, kept separate from the
  // user JWT secret so a leak of one can't forge the other (currently the only
  // thing separating an admin token from a user token is the `role` claim).
  // Optional in dev (falls back to JWT_SECRET); REQUIRED + distinct in prod
  // (enforced in superRefine below).
  ADMIN_JWT_SECRET: z.string().min(16).optional(),
  JWT_EXPIRES_IN:  z.string().default('30d'),
  // Server-side Google Maps key — OPTIONAL. Location lookup primarily uses
  // OpenStreetMap Nominatim (free, no key). Set this only if you want to
  // re-enable the Google Places fallback path that's currently commented out
  // in locationService.js.
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  // Default back-office admin, seeded once on boot if no admin exists yet.
  // Change the password after first login; never reuse this value elsewhere.
  ADMIN_NAME:      z.string().default('Administrator'),
  ADMIN_USERNAME:  z.string().default('admin'),
  ADMIN_PASSWORD:  z.string().min(8, 'ADMIN_PASSWORD must be at least 8 chars').default('changeme123'),
  // RevenueCat webhook — the ONLY purchase path. The Authorization header value
  // configured on the RC dashboard webhook; unset → /credits/rc-webhook 503s and
  // no credits can be bought.
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
}).superRefine((cfg, ctx) => {
  if (cfg.NODE_ENV !== 'production') return;
  // M3: never accept the seed default admin password in production.
  if (cfg.ADMIN_PASSWORD === 'changeme123') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ADMIN_PASSWORD'],
      message: 'ADMIN_PASSWORD must be changed from the default in production',
    });
  }
  // M2: admin token secret must exist and differ from the user JWT secret in prod.
  if (!cfg.ADMIN_JWT_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ADMIN_JWT_SECRET'],
      message: 'ADMIN_JWT_SECRET is required in production',
    });
  } else if (cfg.ADMIN_JWT_SECRET === cfg.JWT_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ADMIN_JWT_SECRET'],
      message: 'ADMIN_JWT_SECRET must differ from JWT_SECRET',
    });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('\n[env] Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
