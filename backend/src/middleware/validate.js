// Generic zod-schema runner. Use as `validate(schema, 'body')` in route defs.
// Express 5 made req.query a read-only getter — we mutate the existing object
// in place instead of reassigning the property, which works for both body
// and query the same way.
import { AppError } from '../errors/AppError.js';

export function validate(schema, where = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[where]);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join('.') || where;
      // Hand off to the central errorHandler for the uniform { success, error,
      // code } shape. The full issues[] (schema shape) rides on err.details,
      // which errorHandler exposes ONLY in dev to avoid disclosing internals.
      const err = AppError.badRequest(`Invalid ${field}: ${issue.message}`, 'INVALID_REQUEST');
      err.details = result.error.issues;
      return next(err);
    }
    // Mutate in place: clear existing keys, then copy parsed values.
    const target = req[where];
    for (const k of Object.keys(target)) delete target[k];
    Object.assign(target, result.data);
    next();
  };
}
