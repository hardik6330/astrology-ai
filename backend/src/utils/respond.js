// Standard response shape helpers. Adopt across endpoints in a coordinated
// PR with the web + mobile clients so they parse a single envelope:
//
//   { success: true,  data: <payload> }
//   { success: false, error: { message, code? } }
//
// Until clients are migrated, prefer ok()/fail() only in NEW endpoints.

export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function fail(res, status, message, code) {
  return res.status(status).json({
    success: false,
    error: { message, ...(code && { code }) },
  });
}
