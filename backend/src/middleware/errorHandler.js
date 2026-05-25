// Centralized async error handler — every controller throws a plain Error
// (or one with a known .code) and this middleware translates it into the
// right HTTP status + JSON body. Mount LAST in the middleware chain.

const STATUS_BY_CODE = {
  AI_OVERLOADED:   503,
  INVALID_IMAGE:   400,
  INVALID_REQUEST: 400,
  RATE_LIMITED:    429,
  NOT_FOUND:       404,
  BAD_REQUEST:     400,
};

export function errorHandler(err, req, res, _next) {
  const status = err.status || STATUS_BY_CODE[err.code] || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: err.message || 'Internal error',
    ...(err.code && { code: err.code }),
  });
}

// Tiny helper so controllers can throw a tagged HTTP error in one line.
export function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}
