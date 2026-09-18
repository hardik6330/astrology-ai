import { findUserByPhone, ensureUserForPhone } from '../services/userService.js';
import { getBalance } from '../services/creditService.js';
import * as purchase from '../services/purchaseService.js';
import * as settings from '../services/settingsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../errors/AppError.js';

// GET /credits → { credits, costs }. The user is resolved from the auth token
// (req.auth.phone) — no form/query params needed. `credits` is that user's
// balance (or a preview of the welcome bonus if they have no profile yet).
// `costs` lets the clients label "Unlock for N credits" buttons / cost
// reminders without hardcoding prices.
let cachedCosts = null;
let lastCacheTime = 0;

export const getCredits = asyncHandler(async (req, res) => {
  if (!cachedCosts || Date.now() - lastCacheTime > 60_000) {
    const [insights, chat, daily, palm] = await Promise.all([
      settings.getNumber('insights_cost', 20),
      settings.getNumber('chat_cost', 5),
      settings.getNumber('daily_cost', 0),
      settings.getNumber('palm_cost', 30),
    ]);
    
    cachedCosts = { insights, chat, daily, palm };
    lastCacheTime = Date.now();
  }
  const costs = cachedCosts;

  res.locals.message = 'Credits fetched';

  // Prefer the userId baked into the JWT — a direct, stable balance lookup.
  // Fall back to a phone lookup for tokens issued before userId existed, or
  // for users who logged in before creating their first profile.
  let credits = null;
  if (req.auth?.userId) credits = await getBalance(req.auth.userId);
  if (credits == null && req.auth?.phone) {
    // If the token predates userId, or the user hasn't filled their birth
    // details (so findUserByPhone would miss them), ensure their placeholder
    // row exists and fetch its real balance (which includes any purchases).
    const user = await ensureUserForPhone(req.auth.phone);
    if (user) credits = await getBalance(user.id);
  }
  if (credits != null) return res.json({ credits, costs });

  const initial = await settings.getNumber('initial_credits', 200);
  res.json({ credits: initial, costs });
});

// Resolve the live User-row id for the caller — preferring the id baked into the
// JWT, falling back to a phone lookup (tokens issued before userId existed, or
// users who haven't created a profile). Throws 409 if the phone has no profile
// yet, since a purchase must credit a real row.
async function resolveUserId(req) {
  if (req.auth?.userId) return req.auth.userId;

  const user = await findUserByPhone(req.auth?.phone);
  if (user) return user.id;

  if (req.auth?.phone) {
    const placeholder = await ensureUserForPhone(req.auth.phone);
    if (placeholder) return placeholder.id;
  }

  throw AppError.http(409, 'Create a profile before buying credits', 'NO_PROFILE');
}

// GET /credits/plans → { plans: [{ id, name, credits, priceInr, bonusLabel }] }.
// Active plans only; priceInr is in paise.
export const getPlans = asyncHandler(async (_req, res) => {
  res.locals.message = 'Plans fetched';
  res.json({ plans: await purchase.listActivePlans() });
});

// GET /credits/subscription — the caller's current subscription, or null.
export const getSubscription = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  res.locals.message = 'Subscription fetched';
  res.json({ subscription: await purchase.getSubscription(userId) });
});
