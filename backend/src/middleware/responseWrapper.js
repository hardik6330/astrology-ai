// Wraps every successful JSON response in a common envelope:
//   { success: true, message, data }
// so all endpoints answer in one consistent shape. Mount BEFORE the routes.
//
// Controllers keep calling `res.json(payload)` exactly as before — `payload`
// becomes `data`. To set a custom message, a controller assigns
// `res.locals.message = '...'` before responding; otherwise a sensible default
// is used. Error responses (status >= 400) and already-enveloped bodies are
// passed through untouched, so the errorHandler stays the source of truth for
// failures.
export function responseWrapper(req, res, next) {
  const orig = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400) return orig(body); // errors handled elsewhere
    if (body && typeof body === 'object' && body.success !== undefined) {
      return orig(body); // already wrapped — don't double-envelope
    }
    return orig({
      success: true,
      message: res.locals.message || 'Success',
      data: body,
    });
  };
  next();
}
