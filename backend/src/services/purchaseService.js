// Credit plans + the caller's subscription state. Admins define CreditPlans;
// users buy them through Apple IAP, RevenueCat verifies the receipt and posts
// the event to /credits/rc-webhook, and revenueCatService turns that into a
// Purchase row + creditService.grant(). Nothing here takes money any more —
// the Razorpay/mock checkout and the hand-rolled Apple/Google verifiers were
// deleted when RevenueCat became the only settlement path.
//
// The Purchase table IS the orders table: one row per settled buy, with the
// price + credits snapshotted at settlement time.

import { CreditPlan, Subscription } from '../models/index.js';
import { AppError } from '../errors/AppError.js';

// Public-facing plan shape (no internal flags beyond what the client renders).
export function publicPlan(p) {
  return {
    id: p.id,
    name: p.name,
    productId: p.productId || null,
    credits: p.credits,
    priceInr: p.priceInr,        // paise
    bonusLabel: p.bonusLabel || null,
    // Subscription plans grant `credits` every cycle, not once — the client
    // needs this to pick the store subscription flow over the one-off flow.
    isSubscription: !!p.isSubscription,
    periodDays: p.periodDays ?? 30,
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

// The caller's current subscription, or null. Never a stored flag — active is
// always derived from the period end, so it can't rot.
export async function getSubscription(userId) {
  const sub = await Subscription.findOne({
    where: { userId },
    order: [['currentPeriodEnd', 'DESC']],
    include: [{ model: CreditPlan, attributes: ['id', 'name', 'credits', 'priceInr', 'periodDays'] }],
  });
  if (!sub) return null;
  return {
    planId: sub.planId,
    plan: sub.CreditPlan ? publicPlan(sub.CreditPlan) : null,
    platform: sub.platform,
    active: sub.isActive(),
    currentPeriodEnd: sub.currentPeriodEnd,
    autoRenew: sub.autoRenew,
  };
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────

// All plans (incl. disabled) for the admin table.
export async function listAllPlans() {
  return CreditPlan.findAll({ order: [['sortOrder', 'ASC'], ['priceInr', 'ASC']] });
}

export async function createPlan(data) {
  return CreditPlan.create({
    name: data.name,
    // The App Store product id. Without it RevenueCat can't map a purchase to
    // this plan and the webhook drops the event (unknown_product).
    productId: data.productId || null,
    credits: data.credits,
    priceInr: data.priceInr,
    bonusLabel: data.bonusLabel || null,
    isSubscription: data.isSubscription ?? false,
    periodDays: data.periodDays ?? 30,
    active: data.active ?? true,
    sortOrder: data.sortOrder ?? 0,
  });
}

// Patch an existing plan; only provided fields are touched.
export async function updatePlan(id, data) {
  const plan = await CreditPlan.findByPk(id);
  if (!plan) throw AppError.http(404, 'Plan not found', 'PLAN_NOT_FOUND');
  const patch = {};
  for (const k of ['name', 'productId', 'credits', 'priceInr', 'bonusLabel', 'isSubscription', 'periodDays', 'active', 'sortOrder']) {
    if (data[k] !== undefined) patch[k] = data[k];
  }
  await plan.update(patch);
  return plan;
}
