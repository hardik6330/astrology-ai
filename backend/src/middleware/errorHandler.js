// Centralized error handler. Mount LAST in the middleware chain.
//
// Controllers/services throw AppError (or any Error with .status / .code) — and
// so do the auth/validate/cron middlewares (via next(err)) — so EVERY failure
// response has one shape: { success:false, error, code? }. An optional dev-only
// `details` (e.g. validate's full Zod issues[]) rides along on err.details.

import { env } from '../config/envConfig.js';
import { logger } from '../config/logger.js';

const STATUS_BY_CODE = {
  AI_OVERLOADED:   503,
  INVALID_IMAGE:   400,
  INVALID_REQUEST: 400,
  RATE_LIMITED:    429,
  NOT_FOUND:       404,
  BAD_REQUEST:     400,
  UNAUTHORIZED:    401,
  FORBIDDEN:       403,
  CONFLICT:        409,
};

export function errorHandler(err, req, res, _next) {
  const status = err.status || STATUS_BY_CODE[err.code] || 500;
  // Route 5xx through pino so the configured redaction (auth headers, tokens,
  // PII) is applied — console.error would dump the raw err/req to stdout
  // unredacted. Attach method+path for triage; pino serializes err.stack.
  if (status >= 500) logger.error({ err, method: req.method, path: req.originalUrl }, 'request failed');
  res.status(status).json({
    success: false,
    error: err.message || 'Internal error',
    ...(err.code && { code: err.code }),
    ...(env.NODE_ENV !== 'production' && err.details && { details: err.details }),
  });
}
