import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// H2: key by ACCOUNT when the request is authenticated, so a single account
// can't multiply its quota by rotating IPs (datacenter/proxy), and a shared NAT
// (corporate/school) doesn't throttle unrelated users together. Pre-auth routes
// (login, location) have no req.auth and fall back to the client IP — wrapped in
// express-rate-limit's ipKeyGenerator so IPv6 is normalized (no /128 bypass).
function keyByAccountOrIp(req) {
  return req.auth?.accountId ? `acct:${req.auth.accountId}` : ipKeyGenerator(req.ip);
}

function make({ windowMs, max, label }) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: keyByAccountOrIp,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: `Too many ${label} requests — slow down and try again shortly.`, code: 'RATE_LIMITED' },
  });
}

// Write endpoints — POST /interpret, /daily, /chat, /palm.
export const writeLimiter = make({ windowMs: 60_000, max: 10, label: 'write' });

// Read endpoints — GETs the UI legitimately polls on mount.
export const readLimiter  = make({ windowMs: 60_000, max: 60, label: 'read' });
