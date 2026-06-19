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

// Admin login — there is exactly ONE admin account, so legitimate traffic is a
// handful of attempts. Keep this MUCH tighter than the generic write limiter to
// blunt online password guessing: 5 tries per 15 min, always keyed by IP (the
// request is pre-auth so there's no account to key on), and don't reset the
// counter on a successful login (skipSuccessfulRequests stays false) so a
// guesser can't clear their budget by interleaving a known-good probe.
// NOTE: in-memory store → per-process. On the single-pm2-process VPS that's the
// whole app, so it holds; behind multiple instances move to a shared store.
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again in 15 minutes.', code: 'RATE_LIMITED' },
});
