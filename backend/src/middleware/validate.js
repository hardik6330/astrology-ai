// Generic zod-schema runner. Use as `validate(schema, 'body')` in route defs.
// Express 5 made req.query a read-only getter — we mutate the existing object
// in place instead of reassigning the property, which works for both body
// and query the same way.
import { env } from '../config/envConfig.js';

export function validate(schema, where = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[where]);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join('.') || where;
      return res.status(400).json({
        error: `Invalid ${field}: ${issue.message}`,
        code: 'INVALID_REQUEST',
        // L6: the single human-readable `error` is enough for clients. The full
        // issues[] (schema shape) is dev-only to avoid disclosing internals.
        ...(env.NODE_ENV !== 'production' && { details: result.error.issues }),
      });
    }
    // Mutate in place: clear existing keys, then copy parsed values.
    const target = req[where];
    for (const k of Object.keys(target)) delete target[k];
    Object.assign(target, result.data);
    next();
  };
}
