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
  DB_HOST:         z.string().default('localhost'),
  DB_USER:         z.string().default('root'),
  DB_PASS:         z.string().default(''),
  DB_NAME:         z.string().default('astrology_db'),
  JWT_SECRET:      z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN:  z.string().default('30d'),
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
