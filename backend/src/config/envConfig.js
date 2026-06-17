import 'dotenv/config';
import { z } from 'zod';

// Validate env at boot — server crashes hard with a clear message if anything
// required is missing or malformed, instead of failing silently on first request.
const schema = z.object({
  NODE_ENV:        z.enum(['development', 'production', 'test']).default('development'),
  PORT:            z.coerce.number().default(5000),
  GEMINI_API_KEY:  z.string().min(1, 'GEMINI_API_KEY is required'),
  // Comma-separated list of allowed frontend origins in production.
  // In dev we use a permissive localhost/LAN allowlist regardless of this var.
  CORS_ORIGINS:    z.string().optional(),
  // M1: opt-in only. When 'true', any *.vercel.app origin is allowed (handy for
  // preview deploys). Defaults OFF so production trusts ONLY CORS_ORIGINS — a
  // blanket *.vercel.app rule with credentials:true lets any Vercel-hosted site
  // make authenticated cross-origin calls.
  CORS_ALLOW_VERCEL_PREVIEWS: z.enum(['true', 'false']).default('false'),
  DB_HOST:         z.string().default('localhost'),
  DB_PORT:         z.coerce.number().default(3306),
  DB_USER:         z.string().default('root'),
  DB_PASS:         z.string().default(''),
  DB_NAME:         z.string().default('astrology_db'),
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
  // Shared secret that external cron callers (cron-job.org / GitHub Actions)
  // must present in the `x-cron-secret` header to trigger scheduled pushes.
  // Optional so dev boots without it, but the cron routes 503 until it's set.
  CRON_SECRET:     z.string().min(16).optional(),
  // Default back-office admin, seeded once on boot if no admin exists yet.
  // Change the password after first login; never reuse this value elsewhere.
  ADMIN_NAME:      z.string().default('Administrator'),
  ADMIN_USERNAME:  z.string().default('admin'),
  ADMIN_PASSWORD:  z.string().min(8, 'ADMIN_PASSWORD must be at least 8 chars').default('changeme123'),
  // Razorpay (WEB payments) — OPTIONAL so dev/dummy boots without it. When both
  // are set, the buy flow creates real Razorpay orders and verifies the payment
  // signature; when unset, purchaseService falls back to the mock checkout.
  // KEY_ID is also returned to the web client to open Checkout (safe to expose).
  RAZORPAY_KEY_ID:     z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  // Apple App Store / Google Play Store IAP — OPTIONAL.
  APPLE_IAP_SECRET:    z.string().optional(),
  GOOGLE_IAP_SERVICE_ACCOUNT_JSON: z.string().optional(), // Path to JSON file
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
