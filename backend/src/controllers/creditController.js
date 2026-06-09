import { findUserByPhone } from '../services/userService.js';
import { getBalance } from '../services/creditService.js';
import * as purchase from '../services/purchaseService.js';
import * as settings from '../services/settingsService.js';
import { isRazorpayEnabled } from '../config/razorpay.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../errors/AppError.js';

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
  throw AppError.http(409, 'Create a profile before buying credits', 'NO_PROFILE');
}

// GET /credits/plans → { plans: [{ id, name, credits, priceInr, bonusLabel }] }.
// Active plans only; priceInr is in paise.
export const getPlans = asyncHandler(async (_req, res) => {
  res.locals.message = 'Plans fetched';
  res.json({ plans: await purchase.listActivePlans() });
});

// POST /credits/order { planId } → opens an order.
//   • Razorpay on  → { provider:'razorpay', orderId, razorpay:{ keyId, orderId,
//                      amount, currency }, credits, name }. The browser opens
//                      Checkout, then calls /credits/verify.
//   • Razorpay off → settles the mock checkout immediately and returns
//                      { provider:'mock', paid:true, granted, balance, credits, orderId }.
export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const { purchase: order, plan, razorpay } = await purchase.createOrder({
    userId,
    planId: req.body.planId,
  });

  if (!razorpay) {
    // Mock mode (dev / no keys) — settle right away, just like the old flow.
    const result = await purchase.confirmOrder({ userId, orderId: order.id, mockSuccess: true });
    res.locals.message = 'Purchase complete';
    return res.json({ provider: 'mock', paid: true, ...result, orderId: order.id });
  }

  res.locals.message = 'Order created';
  res.json({
    provider: 'razorpay',
    orderId: order.id,
    credits: plan.credits,
    name: plan.name,
    razorpay,
  });
});

// POST /credits/verify { orderId, razorpayOrderId, razorpayPaymentId,
// razorpaySignature } → verifies the Razorpay signature and grants credits.
// → { granted, balance, credits, status }.
export const verifyPurchase = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const result = await purchase.verifyRazorpayPayment({
    userId,
    orderId: req.body.orderId,
    razorpayOrderId: req.body.razorpayOrderId,
    razorpayPaymentId: req.body.razorpayPaymentId,
    razorpaySignature: req.body.razorpaySignature,
  });
  res.locals.message = 'Payment verified';
  res.json(result);
});

// POST /credits/verify-iap { planId, platform, receipt, purchaseToken }
// Verifies a Mobile IAP (Apple/Google) and grants credits.
export const verifyIap = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const result = await purchase.verifyIapPayment({
    userId,
    planId: req.body.planId,
    platform: req.body.platform,
    receipt: req.body.receipt,
    purchaseToken: req.body.purchaseToken,
  });
  res.locals.message = 'IAP verified';
  res.json(result);
});

// POST /credits/purchase { planId } — legacy mock checkout. Kept for backward
// compatibility with clients not yet on the order/verify flow. Disabled when
// Razorpay is live so it can't be used to grant free credits in production.
export const buyPlan = asyncHandler(async (req, res) => {
  if (isRazorpayEnabled()) {
    throw AppError.http(400, 'Use /credits/order then /credits/verify', 'USE_ORDER_FLOW');
  }
  const userId = await resolveUserId(req);
  const { purchase: order } = await purchase.createOrder({ userId, planId: req.body.planId });
  const result = await purchase.confirmOrder({ userId, orderId: order.id, mockSuccess: true });
  res.locals.message = 'Purchase complete';
  res.json({ ...result, balance: result.balance, orderId: order.id });
});
