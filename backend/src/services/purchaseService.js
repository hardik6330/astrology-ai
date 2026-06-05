// Credit-purchase flow. Admins define CreditPlans; users buy one, which grants
// the plan's credits via creditService.grant() and records a Purchase order.
//
// The Purchase table IS the orders table: one row per buy attempt, lifecycle
// created → paid | failed, with the price + credits snapshotted at order time.
//
// WEB uses Razorpay: createOrder() opens our order AND a Razorpay order, the
// browser pays via Checkout, then verifyRazorpayPayment() checks the HMAC
// signature and grants. When Razorpay keys are absent (dev / dummy), the flow
// falls back to the mock checkout (confirmOrder, settled on a client flag).
// Google Play (mobile IAP) verification is added in a later phase.

import crypto from 'node:crypto';
import sequelize from '../config/dbConfig.js';
import { CreditPlan, Purchase } from '../models/index.js';
import { grant, getBalance } from './creditService.js';
import { env } from '../config/envConfig.js';
import { isRazorpayEnabled, razorpay, RAZORPAY_KEY_ID } from '../config/razorpay.js';
import { httpError } from '../middleware/errorHandler.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'purchase' });

// providerRef is a JSON column, but on MariaDB (JSON aliased to LONGTEXT)
// Sequelize hands it back as a raw string instead of a parsed object. Normalize
// both shapes so reads of nested fields (razorpayOrderId) and re-writes (spread)
// behave the same everywhere.
function parseRef(ref) {
  if (!ref) return {};
  if (typeof ref === 'string') {
    try { return JSON.parse(ref); } catch { return {}; }
  }
  return ref;
}

// Public-facing plan shape (no internal flags beyond what the client renders).
function publicPlan(p) {
  return {
    id: p.id,
    name: p.name,
    credits: p.credits,
    priceInr: p.priceInr,        // paise
    bonusLabel: p.bonusLabel || null,
  };
}

// ── User-facing ──────────────────────────────────────────────────────────────

// Active plans for the buy screen, cheapest-first within the admin sort order.
export async function listActivePlans() {
  const rows = await CreditPlan.findAll({
    where: { active: true },
    order: [['sortOrder', 'ASC'], ['priceInr', 'ASC']],
  });
  return rows.map(publicPlan);
}

// Open an order against an active plan. Snapshots credits + price so later edits
// to the plan never rewrite this order. When Razorpay is configured, also opens
// a matching Razorpay order and returns the bits the browser needs to launch
// Checkout (keyId, razorpay orderId, amount). Otherwise provider is 'mock'.
//
// Returns { purchase, plan, razorpay }. `razorpay` is null in mock mode.
export async function createOrder({ userId, planId }) {
  const plan = await CreditPlan.findByPk(planId);
  if (!plan || !plan.active) throw httpError(404, 'Plan not found', 'PLAN_NOT_FOUND');

  const useRazorpay = isRazorpayEnabled();
  const purchase = await Purchase.create({
    userId,
    planId: plan.id,
    credits: plan.credits,
    priceInr: plan.priceInr,
    status: 'created',
    provider: useRazorpay ? 'razorpay' : 'mock',
  });

  if (!useRazorpay) return { purchase, plan, razorpay: null };

  // Razorpay order amount is in paise — matches our priceInr unit exactly.
  const rzpOrder = await razorpay().orders.create({
    amount: plan.priceInr,
    currency: 'INR',
    receipt: purchase.id, // our order id, echoed back for reconciliation
    notes: { userId, planId: plan.id, purchaseId: purchase.id },
  });
  await purchase.update({ providerRef: { razorpayOrderId: rzpOrder.id } });

  return {
    purchase,
    plan,
    razorpay: {
      keyId: RAZORPAY_KEY_ID,
      orderId: rzpOrder.id,
      amount: plan.priceInr,
      currency: 'INR',
    },
  };
}

// Verify a completed Razorpay payment and settle the order. The browser sends
// back the three Checkout fields; we recompute the HMAC signature server-side
// (hmac_sha256("<razorpay_order_id>|<razorpay_payment_id>", key_secret)) and
// constant-time compare it. Only on a match do we grant credits.
//
// Idempotent: a 'paid' order returns the current balance without re-granting,
// and providerTxnId (= razorpay_payment_id) is UNIQUE, so a replayed verify
// can never double-credit. The grant + status flip happen under a row lock.
//
// Returns { granted, balance, credits, status }.
export async function verifyRazorpayPayment({
  userId, orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature,
}) {
  const purchase = await Purchase.findOne({ where: { id: orderId, userId } });
  if (!purchase) throw httpError(404, 'Order not found', 'ORDER_NOT_FOUND');

  if (purchase.status === 'paid') {
    return { granted: 0, balance: await getBalance(userId), credits: purchase.credits, status: 'paid' };
  }

  // The order id must match the one we created for this purchase.
  if (parseRef(purchase.providerRef).razorpayOrderId !== razorpayOrderId) {
    throw httpError(400, 'Order mismatch', 'ORDER_MISMATCH');
  }

  // Recompute + constant-time compare the signature.
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  const sigBuf = Buffer.from(razorpaySignature || '', 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  if (!valid) {
    await purchase.update({ status: 'failed' });
    throw httpError(400, 'Payment verification failed', 'SIGNATURE_INVALID');
  }

  return sequelize.transaction(async (t) => {
    const locked = await Purchase.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (locked.status === 'paid') {
      return { granted: 0, balance: await getBalance(userId), credits: locked.credits, status: 'paid' };
    }

    const { granted, balance } = await grant({
      userId,
      amount: locked.credits,
      reason: 'purchase',
      meta: { orderId: locked.id, planId: locked.planId, priceInr: locked.priceInr, razorpayPaymentId },
    });
    await locked.update(
      {
        status: 'paid',
        providerTxnId: razorpayPaymentId,
        providerRef: { ...parseRef(locked.providerRef), razorpayPaymentId },
      },
      { transaction: t },
    );
    log.info({ userId, orderId, granted, balance, razorpayPaymentId }, 'purchase settled (razorpay)');
    return { granted, balance, credits: locked.credits, status: 'paid' };
  });
}

// Settle an order. `mockSuccess` stands in for a real payment result; when the
// gateway is wired, replace it with signature verification.
//
// Idempotent: a 'paid' order is a no-op (returns the current balance), so a
// double-submit / retry can never grant twice. The grant + status flip happen
// in one transaction.
//
// Returns { granted, balance, credits, status }.
export async function confirmOrder({ userId, orderId, mockSuccess = true }) {
  const purchase = await Purchase.findOne({ where: { id: orderId, userId } });
  if (!purchase) throw httpError(404, 'Order not found', 'ORDER_NOT_FOUND');

  if (purchase.status === 'paid') {
    // Already settled — return without crediting again.
    return { granted: 0, balance: null, credits: purchase.credits, status: 'paid' };
  }

  if (!mockSuccess) {
    await purchase.update({ status: 'failed' });
    throw httpError(402, 'Payment failed', 'PAYMENT_FAILED');
  }

  return sequelize.transaction(async (t) => {
    // Re-read inside the txn and lock the row so two concurrent confirms can't
    // both pass the 'created' check and double-grant.
    const locked = await Purchase.findByPk(orderId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (locked.status === 'paid') {
      return { granted: 0, balance: null, credits: locked.credits, status: 'paid' };
    }

    const { granted, balance } = await grant({
      userId,
      amount: locked.credits,
      reason: 'purchase',
      meta: { orderId: locked.id, planId: locked.planId, priceInr: locked.priceInr },
    });
    await locked.update({ status: 'paid' }, { transaction: t });
    log.info({ userId, orderId, granted, balance }, 'purchase settled (mock)');
    return { granted, balance, credits: locked.credits, status: 'paid' };
  });
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────

// All plans (incl. disabled) for the admin table.
export async function listAllPlans() {
  return CreditPlan.findAll({ order: [['sortOrder', 'ASC'], ['priceInr', 'ASC']] });
}

export async function createPlan(data) {
  return CreditPlan.create({
    name: data.name,
    credits: data.credits,
    priceInr: data.priceInr,
    bonusLabel: data.bonusLabel || null,
    active: data.active ?? true,
    sortOrder: data.sortOrder ?? 0,
  });
}

// Patch an existing plan; only provided fields are touched.
export async function updatePlan(id, data) {
  const plan = await CreditPlan.findByPk(id);
  if (!plan) throw httpError(404, 'Plan not found', 'PLAN_NOT_FOUND');
  const patch = {};
  for (const k of ['name', 'credits', 'priceInr', 'bonusLabel', 'active', 'sortOrder']) {
    if (data[k] !== undefined) patch[k] = data[k];
  }
  await plan.update(patch);
  return plan;
}
