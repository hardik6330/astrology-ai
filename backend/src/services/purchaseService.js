// Credit-purchase flow. Admins define CreditPlans; users buy one, which grants
// the plan's credits via creditService.grant() and records a Purchase order.
//
// MOCK CHECKOUT: there is no real payment yet. createOrder() opens an order and
// confirmOrder() settles it on a client-supplied success flag. The two-step
// shape (create → confirm/verify) deliberately mirrors a real gateway so that
// dropping in Razorpay later means: create a Razorpay order in createOrder(),
// and verify the payment signature in confirmOrder() — the grant + idempotency
// logic below is unchanged.

import sequelize from '../config/dbConfig.js';
import { CreditPlan, Purchase } from '../models/index.js';
import { grant } from './creditService.js';
import { httpError } from '../middleware/errorHandler.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'purchase' });

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
// to the plan never rewrite this order. Returns the Purchase + the plan.
export async function createOrder({ userId, planId }) {
  const plan = await CreditPlan.findByPk(planId);
  if (!plan || !plan.active) throw httpError(404, 'Plan not found', 'PLAN_NOT_FOUND');

  const purchase = await Purchase.create({
    userId,
    planId: plan.id,
    credits: plan.credits,
    priceInr: plan.priceInr,
    status: 'created',
    provider: 'mock',
  });
  return { purchase, plan };
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
