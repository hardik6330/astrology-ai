// Wraps an async route handler so any thrown/rejected error flows to the
// global errorHandler middleware. Eliminates per-controller try/catch.
//
// Usage:
//   router.get('/x', asyncHandler(async (req, res) => { ... }));
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
