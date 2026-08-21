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
import { google } from 'googleapis';
import sequelize from '../config/dbConfig.js';
import { CreditPlan, Purchase, Subscription } from '../models/index.js';
import { grant, getBalance } from './creditService.js';
import { env } from '../config/envConfig.js';
import { isRazorpayEnabled, razorpay, RAZORPAY_KEY_ID } from '../config/razorpay.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'purchase' });

// Play Console package name. Must match mobile/app.json's android.package —
// a mismatch makes every Google verify 404 with a confusing auth-looking error.
const GOOGLE_PACKAGE_NAME = 'com.astrologyai.app';

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
    productId: p.productId || null,
    credits: p.credits,
    priceInr: p.priceInr,        // paise
    bonusLabel: p.bonusLabel || null,
    // Subscription plans grant `credits` every cycle, not once — the clients
    // need this to pick the store subscription flow over the one-off flow.
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

// Open an order against an active plan. Snapshots credits + price so later edits
// to the plan never rewrite this order. When Razorpay is configured, also opens
// a matching Razorpay order and returns the bits the browser needs to launch
// Checkout (keyId, razorpay orderId, amount). Otherwise provider is 'mock'.
//
// Returns { purchase, plan, razorpay }. `razorpay` is null in mock mode.
export async function createOrder({ userId, planId }) {
  const plan = await CreditPlan.findByPk(planId);
  if (!plan || !plan.active) throw AppError.http(404, 'Plan not found', 'PLAN_NOT_FOUND');

  const useRazorpay = isRazorpayEnabled();

  // Fail CLOSED in production: the mock checkout settles on a client-supplied
  // flag (confirmOrder) with no real payment, so opening a mock order in prod
  // would let any authed client farm free credits. Mock is dev-only; in prod
  // Razorpay MUST be configured. (The mobile client guards this with __DEV__,
  // but that's client-side — this is the server-side gate.)
  if (!useRazorpay && env.NODE_ENV === 'production') {
    log.error('Razorpay not configured in production — refusing mock checkout');
    throw AppError.http(503, 'Payments are not configured', 'PAYMENTS_NOT_CONFIGURED');
  }

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
  if (!purchase) throw AppError.http(404, 'Order not found', 'ORDER_NOT_FOUND');

  if (purchase.status === 'paid') {
    return { granted: 0, balance: await getBalance(userId), credits: purchase.credits, status: 'paid' };
  }

  // The order id must match the one we created for this purchase.
  if (parseRef(purchase.providerRef).razorpayOrderId !== razorpayOrderId) {
    throw AppError.http(400, 'Order mismatch', 'ORDER_MISMATCH');
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
    throw AppError.http(400, 'Payment verification failed', 'SIGNATURE_INVALID');
  }

  return sequelize.transaction(async (t) => {
    const locked = await Purchase.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (locked.status === 'paid') {
      return { granted: 0, balance: await getBalance(userId), credits: locked.credits, status: 'paid' };
    }

    // Grant INSIDE the settlement txn: the credits and the paid/providerTxnId
    // flip commit (or roll back) together, so a crash mid-settle can never
    // leave granted credits on an unsettled order for a replay to re-grant.
    const { granted, balance } = await grant({
      userId,
      amount: locked.credits,
      reason: 'purchase',
      meta: { orderId: locked.id, planId: locked.planId, priceInr: locked.priceInr, razorpayPaymentId },
      transaction: t,
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

// Verify a Mobile In-App Purchase (Google Play or Apple App Store).
// The client sends the receipt/token; we verify it with the store and grant.
export async function verifyIapPayment({
  userId, planId, platform, receipt, purchaseToken,
}) {
  const plan = await CreditPlan.findByPk(planId);
  if (!plan) throw AppError.http(404, 'Plan not found', 'PLAN_NOT_FOUND');

  // 1. Verify with the store (Apple or Google). BOTH paths bind the receipt to
  // this plan's product (plan.productId), so a user can't pay for the cheapest
  // SKU and claim an expensive plan's credits.
  let transactionId = null;
  if (platform === 'ios') {
    transactionId = await verifyAppleReceipt(plan.productId, receipt);
  } else if (platform === 'android') {
    transactionId = await verifyGooglePurchase(plan.productId, purchaseToken);
  } else {
    throw AppError.http(400, 'Invalid platform', 'INVALID_PLATFORM');
  }

  if (!transactionId) {
    throw AppError.http(400, 'Payment verification failed', 'IAP_VERIFICATION_FAILED');
  }

  // 2. Settle the order. IAP verification is often called without a pre-existing
  // Purchase row (the store-side buy happens first), so we create and settle
  // the row in one transaction using transactionId as providerTxnId for idempotency.
  return sequelize.transaction(async (t) => {
    // Check if this transaction was already processed.
    const existing = await Purchase.findOne({
      where: { providerTxnId: transactionId, provider: platform },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (existing) {
      if (existing.status === 'paid') {
        return { granted: 0, balance: await getBalance(userId), credits: existing.credits, status: 'paid' };
      }
      throw AppError.http(400, 'Transaction failed previously', 'TRANSACTION_FAILED');
    }

    // Create the Purchase row FIRST so the UNIQUE(providerTxnId) constraint is
    // the idempotency gate: two concurrent verifies with the same receipt both
    // pass the existing-check (the not-yet-committed row is invisible under
    // REPEATABLE READ), but only one INSERT wins — the loser aborts HERE, before
    // any ledger write, instead of after grant() like before. We convert the
    // unique violation into a clean idempotent response, not a raw 500.
    let purchaseRow;
    try {
      purchaseRow = await Purchase.create(
        {
          userId,
          planId: plan.id,
          credits: plan.credits,
          priceInr: plan.priceInr,
          status: 'paid',
          provider: platform,
          providerTxnId: transactionId,
          providerRef: { receipt, purchaseToken },
        },
        { transaction: t }
      );
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        // A concurrent verify of the same transaction won the race and already
        // granted. Treat as idempotent success (no second grant).
        throw AppError.http(409, 'Transaction already processed', 'IAP_ALREADY_PROCESSED');
      }
      throw err;
    }

    const { granted, balance } = await grant({
      userId,
      amount: plan.credits,
      reason: 'purchase',
      meta: { orderId: purchaseRow.id, planId: plan.id, platform, transactionId },
      transaction: t, // atomic with the Purchase row above — see verifyRazorpayPayment
    });

    log.info({ userId, platform, transactionId, granted, balance }, 'IAP purchase settled');
    return { granted, balance, credits: plan.credits, status: 'paid' };
  });
}

// Newest transaction_id in an Apple receipt's in_app array that matches
// productId, or null if none. Apple lists EVERY non-consumed purchase in the
// receipt, so we must (a) match the requested product — never trust in_app[0],
// which lets a cheap-SKU receipt settle an expensive plan — and (b) take the
// most recent matching transaction by purchase date.
export function appleTxnForProduct(inApp, productId) {
  if (!Array.isArray(inApp) || !productId) return null;
  const matches = inApp.filter((e) => e.product_id === productId);
  if (!matches.length) return null;
  matches.sort((a, b) => Number(b.purchase_date_ms || 0) - Number(a.purchase_date_ms || 0));
  return matches[0].transaction_id || null;
}

// Verify an Apple receipt for THIS plan's product. Returns the matching
// transaction id (idempotency key), or null on any failure / product mismatch.
async function verifyAppleReceipt(productId, receipt) {
  if (!env.APPLE_IAP_SECRET) {
    // Fail CLOSED in production: a mock txn here would let any authed client
    // farm free credits (the mock id is unique each call, so the providerTxnId
    // guard doesn't stop it). Mock is dev-only.
    if (env.NODE_ENV === 'production') {
      log.error('APPLE_IAP_SECRET missing in production — refusing IAP grant');
      return null;
    }
    log.warn('APPLE_IAP_SECRET missing — using mock verification (dev only)');
    return `mock_apple_${Date.now()}`;
  }

  const isProd = env.NODE_ENV === 'production';
  const verify = (url) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: env.APPLE_IAP_SECRET, 'receipt-data': receipt }),
    }).then((res) => res.json());

  try {
    let data = await verify(
      isProd
        ? 'https://buy.itunes.apple.com/verifyReceipt'
        : 'https://sandbox.itunes.apple.com/verifyReceipt',
    );

    // A sandbox receipt sent to the production endpoint returns 21007 — retry
    // against sandbox (Apple's prescribed flow).
    if (isProd && data.status === 21007) {
      data = await verify('https://sandbox.itunes.apple.com/verifyReceipt');
    }

    if (data.status !== 0) {
      log.error({ status: data.status }, 'Apple IAP verification failed');
      return null;
    }

    // Bind the verified receipt to the requested plan's product.
    const transactionId = appleTxnForProduct(data.receipt?.in_app, productId);
    if (!transactionId) {
      log.error({ productId }, 'Apple receipt has no transaction for the requested product');
      return null;
    }
    return transactionId;
  } catch (err) {
    log.error({ err }, 'Apple IAP fetch failed');
    return null;
  }
}

// ── Subscriptions ───────────────────────────────────────────────────────────
// A renewal is just another store transaction, so the cycle grant reuses the
// SAME Purchase(providerTxnId UNIQUE) idempotency as a one-off pack. That means
// no entitlement checks anywhere: a subscriber's allowance lands in the normal
// ledger and charge() / 402 / refunds keep working untouched.

// Apple: pick the newest entry for this product out of latest_receipt_info.
// Exported for testing — the selection logic is where a wrong subscription
// state comes from, not the HTTP call.
export function appleLatestSubscription(latestReceiptInfo, productId) {
  if (!Array.isArray(latestReceiptInfo) || !productId) return null;
  const mine = latestReceiptInfo.filter((e) => e.product_id === productId);
  if (!mine.length) return null;
  const newest = mine.reduce((a, b) =>
    Number(b.expires_date_ms || 0) > Number(a.expires_date_ms || 0) ? b : a);
  const expiresMs = Number(newest.expires_date_ms || 0);
  if (!expiresMs) return null;
  return {
    originalTxnId: newest.original_transaction_id || newest.transaction_id,
    latestTxnId:   newest.transaction_id,
    expiresAt:     new Date(expiresMs),
  };
}

async function verifyAppleSubscription(productId, receipt) {
  if (!env.APPLE_IAP_SECRET) {
    if (env.NODE_ENV === 'production') {
      log.error('APPLE_IAP_SECRET missing in production — refusing subscription grant');
      return null;
    }
    log.warn('APPLE_IAP_SECRET missing — mock subscription (dev only)');
    // Derived from the receipt, NOT Date.now(): the real store returns a stable
    // original_transaction_id across renewals, and a timestamped mock would mint
    // a new "subscription" on every launch and grant the allowance every time.
    const id = `mock_apple_sub_${crypto.createHash('sha256').update(String(receipt)).digest('hex').slice(0, 16)}`;
    return { originalTxnId: id, latestTxnId: `${id}_cycle`, expiresAt: null, autoRenew: true };
  }

  const isProd = env.NODE_ENV === 'production';
  const verify = (url) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // exclude-old-transactions keeps latest_receipt_info to the current
      // renewal per product instead of the whole history.
      body: JSON.stringify({
        password: env.APPLE_IAP_SECRET,
        'receipt-data': receipt,
        'exclude-old-transactions': true,
      }),
    }).then((res) => res.json());

  try {
    let data = await verify(
      isProd
        ? 'https://buy.itunes.apple.com/verifyReceipt'
        : 'https://sandbox.itunes.apple.com/verifyReceipt',
    );
    if (isProd && data.status === 21007) {
      data = await verify('https://sandbox.itunes.apple.com/verifyReceipt');
    }
    if (data.status !== 0) {
      log.error({ status: data.status }, 'Apple subscription verification failed');
      return null;
    }

    const sub = appleLatestSubscription(data.latest_receipt_info, productId);
    if (!sub) {
      log.error({ productId }, 'Apple receipt has no subscription for the requested product');
      return null;
    }
    // pending_renewal_info carries the cancel/renew intent for the product.
    const renewal = (data.pending_renewal_info || [])
      .find((r) => r.product_id === productId);
    return { ...sub, autoRenew: renewal ? renewal.auto_renew_status === '1' : true };
  } catch (err) {
    log.error({ err }, 'Apple subscription fetch failed');
    return null;
  }
}

async function verifyGoogleSubscription(productId, token) {
  if (!env.GOOGLE_IAP_SERVICE_ACCOUNT_JSON) {
    if (env.NODE_ENV === 'production') {
      log.error('GOOGLE_IAP_SERVICE_ACCOUNT_JSON missing in production — refusing subscription grant');
      return null;
    }
    log.warn('GOOGLE_IAP_SERVICE_ACCOUNT_JSON missing — mock subscription (dev only)');
    // The purchase token is the stable subscription id on Google, so the mock
    // uses it directly — same shape as the real path, and idempotent across
    // relaunches the way a timestamped id would not be.
    return { originalTxnId: token, latestTxnId: `mock_cycle_${token}`, expiresAt: null, autoRenew: true };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: env.GOOGLE_IAP_SERVICE_ACCOUNT_JSON,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const publisher = google.androidpublisher({ version: 'v3', auth });
    const res = await publisher.purchases.subscriptions.get({
      packageName: GOOGLE_PACKAGE_NAME,
      subscriptionId: productId,
      token,
    });

    const expiryMs = Number(res.data.expiryTimeMillis || 0);
    if (!expiryMs) {
      log.error({ productId }, 'Google subscription has no expiry');
      return null;
    }
    return {
      // The purchase token IS the stable subscription id on Google; orderId
      // changes per renewal, which is exactly what we want for latestTxnId.
      originalTxnId: token,
      latestTxnId:   res.data.orderId || token,
      expiresAt:     new Date(expiryMs),
      autoRenew:     res.data.autoRenewing !== false,
    };
  } catch (err) {
    log.error({ err }, 'Google subscription verification failed');
    return null;
  }
}

async function verifyGooglePurchase(productId, token) {
  if (!env.GOOGLE_IAP_SERVICE_ACCOUNT_JSON) {
    // Fail CLOSED in production (see verifyAppleReceipt) — mock is dev-only.
    if (env.NODE_ENV === 'production') {
      log.error('GOOGLE_IAP_SERVICE_ACCOUNT_JSON missing in production — refusing IAP grant');
      return null;
    }
    log.warn('GOOGLE_IAP_SERVICE_ACCOUNT_JSON missing — using mock verification (dev only)');
    return `mock_google_${Date.now()}`;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: env.GOOGLE_IAP_SERVICE_ACCOUNT_JSON,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const publisher = google.androidpublisher({ version: 'v3', auth });
    const res = await publisher.purchases.products.get({
      packageName: GOOGLE_PACKAGE_NAME,
      productId,
      token,
    });

    if (res.data.purchaseState === 0) return res.data.orderId;
    log.error({ state: res.data.purchaseState }, 'Google IAP verification failed');
    return null;
  } catch (err) {
    log.error({ err }, 'Google IAP verification failed');
    return null;
  }
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
  // Defense-in-depth: even if a mock order somehow exists in production (it
  // shouldn't — createOrder refuses to open one), never settle it for free.
  if (env.NODE_ENV === 'production') {
    log.error({ orderId }, 'Mock settlement attempted in production — refused');
    throw AppError.http(503, 'Payments are not configured', 'PAYMENTS_NOT_CONFIGURED');
  }

  const purchase = await Purchase.findOne({ where: { id: orderId, userId } });
  if (!purchase) throw AppError.http(404, 'Order not found', 'ORDER_NOT_FOUND');

  if (purchase.status === 'paid') {
    // Already settled — return without crediting again.
    return { granted: 0, balance: null, credits: purchase.credits, status: 'paid' };
  }

  if (!mockSuccess) {
    await purchase.update({ status: 'failed' });
    throw AppError.http(402, 'Payment failed', 'PAYMENT_FAILED');
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
      transaction: t, // atomic with the status flip — see verifyRazorpayPayment
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
    // The store SKU. Without it a plan can't use IAP at all and silently falls
    // back to the mock path — which fails closed in production.
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

// Verify an auto-renewing store subscription and grant this cycle's allowance.
//
// Called on purchase AND on every app launch with an active subscription — the
// store, not us, drives renewals, so re-verifying is how a new cycle is noticed.
// Safe to call repeatedly: the grant is gated by Purchase(providerTxnId UNIQUE),
// so only a transaction id we haven't already granted for produces credits.
//
// Returns { granted, balance, credits, subscription: { active, currentPeriodEnd, autoRenew } }.
export async function verifyIapSubscription({
  userId, planId, platform, receipt, purchaseToken,
}) {
  const plan = await CreditPlan.findByPk(planId);
  if (!plan) throw AppError.http(404, 'Plan not found', 'PLAN_NOT_FOUND');
  if (!plan.isSubscription) {
    throw AppError.http(400, 'Plan is not a subscription', 'NOT_A_SUBSCRIPTION');
  }

  // Both paths bind the receipt to THIS plan's product, so a user can't buy the
  // cheapest SKU and claim an expensive plan's allowance.
  let info = null;
  if (platform === 'ios') {
    info = await verifyAppleSubscription(plan.productId, receipt);
  } else if (platform === 'android') {
    info = await verifyGoogleSubscription(plan.productId, purchaseToken);
  } else {
    throw AppError.http(400, 'Invalid platform', 'INVALID_PLATFORM');
  }

  if (!info) throw AppError.http(400, 'Subscription verification failed', 'IAP_VERIFICATION_FAILED');

  // Only the dev mock leaves expiresAt null; fall back to the plan's period so
  // a local subscription still behaves like one.
  const expiresAt = info.expiresAt
    ?? new Date(Date.now() + plan.periodDays * 86_400_000);

  const [sub] = await Subscription.findOrCreate({
    where: { originalTxnId: info.originalTxnId },
    defaults: {
      userId, planId: plan.id, platform,
      originalTxnId: info.originalTxnId,
      latestTxnId: null,          // set below, only once the cycle is actually granted
      currentPeriodEnd: expiresAt,
      autoRenew: info.autoRenew !== false,
    },
  });

  // A store subscription belongs to a store account, which can sign in to a
  // different app account. Refuse rather than silently move the entitlement.
  if (sub.userId !== userId) {
    throw AppError.http(409, 'This subscription is already linked to another account', 'SUBSCRIPTION_OWNED_ELSEWHERE');
  }

  await sub.update({
    planId: plan.id,
    currentPeriodEnd: expiresAt,
    autoRenew: info.autoRenew !== false,
  });

  const subState = {
    active: sub.isActive(),
    currentPeriodEnd: sub.currentPeriodEnd,
    autoRenew: sub.autoRenew,
  };

  // Expired (cancelled and lapsed) — keep the row for history, grant nothing.
  if (!subState.active) {
    return { granted: 0, balance: await getBalance(userId), credits: plan.credits, subscription: subState };
  }

  // Grant this cycle. The Purchase INSERT is the idempotency gate: the same
  // transaction id can only ever insert once, so relaunching the app ten times
  // in one cycle grants once. Insert BEFORE grant() so a concurrent duplicate
  // aborts on the constraint rather than after a ledger write.
  let granted = 0;
  try {
    await sequelize.transaction(async (t) => {
      await Purchase.create({
        userId,
        planId: plan.id,
        credits: plan.credits,
        priceInr: plan.priceInr,
        status: 'paid',
        provider: platform,
        providerTxnId: info.latestTxnId,
        providerRef: { subscription: true, originalTxnId: info.originalTxnId },
      }, { transaction: t });

      await grant({
        userId, amount: plan.credits, reason: 'subscription',
        meta: { planId: plan.id, originalTxnId: info.originalTxnId, periodEnd: expiresAt },
        transaction: t,
      });
      granted = plan.credits;
    });
    await sub.update({ latestTxnId: info.latestTxnId });
  } catch (err) {
    if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    // Already granted for this cycle — the normal path on every relaunch.
    granted = 0;
  }

  return { granted, balance: await getBalance(userId), credits: plan.credits, subscription: subState };
}

// The caller's current subscription state, for the UI. Never a stored flag —
// active is always derived from the period end, so it can't rot.
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
