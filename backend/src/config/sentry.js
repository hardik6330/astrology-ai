// Error tracking. No-ops entirely when SENTRY_DSN is unset, so dev and tests
// stay offline and the dependency is inert until someone opts in.
//
// Imported FIRST in server.js on purpose: Sentry's auto-instrumentation patches
// http/express at import time, so anything loaded before init() is unpatched.
import * as Sentry from '@sentry/node';
import { env } from './envConfig.js';
import { logger } from './logger.js';

export const sentryEnabled = Boolean(env.SENTRY_DSN);

if (sentryEnabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: process.env.RELEASE_SHA,   // set by the deploy workflow; groups errors per release
    // Tracing off by default: this is about "did it break", not "was it slow".
    // pino already carries latency. Raise via SENTRY_TRACES_SAMPLE_RATE if wanted.
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // The logger already redacts auth headers/tokens/PII; don't let Sentry
    // re-collect what we deliberately keep out of logs.
    sendDefaultPii: false,
  });
  logger.info({ environment: env.NODE_ENV }, 'Sentry initialised');
}

// Report a 5xx. Safe to call when disabled — Sentry's no-op client swallows it.
export function captureError(err, context) {
  if (!sentryEnabled) return;
  Sentry.captureException(err, { extra: context });
}
