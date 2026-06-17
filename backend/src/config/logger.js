import pino from 'pino';
import { env } from './envConfig.js';

// In dev: pretty-printed colorized output.
// In prod: JSON to stdout — pipe into Better Stack / Axiom / Loki / Datadog.
const isDev = env.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
  // Strip secrets AND PII (M6: phone numbers were logged in the clear). pino
  // redact matches by path, so cover both the top-level `{ phone }` / `{ digits }`
  // shapes used across services and the one-level-nested `*.phone` form.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'env.GEMINI_API_KEY',
      'env.DB_PASS',
      'phone',
      'digits',
      '*.phone',
      '*.digits',
      'req.body.phone',
    ],
    censor: '[REDACTED]',
  },
});
