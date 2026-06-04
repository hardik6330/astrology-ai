import { findUserByPhone } from '../services/userService.js';
import { getBalance } from '../services/creditService.js';
import * as purchase from '../services/purchaseService.js';
import * as settings from '../services/settingsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { httpError } from '../middleware/errorHandler.js';

// GET /credits → { credits, costs }. The user is resolved from the auth token
// (req.auth.phone) — no form/query params needed. `credits` is that user's
// balance (or a preview of the welcome bonus if they have no profile yet).
// `costs` lets the clients label "Unlock for N credits" buttons / cost
// reminders without hardcoding prices.
export const getCredits = asyncHandler(async (req, res) => {
  const [insights, chat, daily, palm] = await Promise.all([
    settings.getNumber('insights_cost', 20),
    settings.getNumber('chat_cost', 5),
    settings.getNumber('daily_cost', 15),
    settings.getNumber('palm_cost', 30),
  ]);
  const costs = { insights, chat, daily, palm };

  res.locals.message = 'Credits fetched';

  // Prefer the userId baked into the JWT — a direct, stable balance lookup.
  // Fall back to a phone lookup for tokens issued before userId existed, or
  // for users who logged in before creating their first profile.
  let credits = null;
  if (req.auth?.userId) credits = await getBalance(req.auth.userId);
  if (credits == null) {
    const user = await findUserByPhone(req.auth?.phone);
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
  throw httpError(409, 'Create a profile before buying credits', 'NO_PROFILE');
}

// GET /credits/plans → { plans: [{ id, name, credits, priceInr, bonusLabel }] }.
// Active plans only; priceInr is in paise.
export const getPlans = asyncHandler(async (_req, res) => {
  res.locals.message = 'Plans fetched';
  res.json({ plans: await purchase.listActivePlans() });
});

// POST /credits/purchase { planId } → buys a plan via the mock checkout: opens
// an order and immediately settles it (no real payment yet), granting credits.
// → { granted, balance, credits, orderId }.
//
// When Razorpay lands this splits into create-order (returns the gateway order)
// and a separate verify endpoint; purchaseService already models both halves.
export const buyPlan = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const { purchase: order } = await purchase.createOrder({ userId, planId: req.body.planId });
  const result = await purchase.confirmOrder({ userId, orderId: order.id, mockSuccess: true });
  res.locals.message = 'Purchase complete';
  res.json({ ...result, balance: result.balance, orderId: order.id });
});
