import rateLimit from 'express-rate-limit';

function make({ windowMs, max, label }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: `Too many ${label} requests — slow down and try again shortly.`, code: 'RATE_LIMITED' },
  });
}

// Write endpoints — POST /interpret, /daily, /chat, /palm.
export const writeLimiter = make({ windowMs: 60_000, max: 10, label: 'write' });

// Read endpoints — GETs the UI legitimately polls on mount.
export const readLimiter  = make({ windowMs: 60_000, max: 60, label: 'read' });
