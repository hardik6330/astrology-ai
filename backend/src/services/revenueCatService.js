// RevenueCat webhook → credit ledger. RC verifies the store receipt and
// listens for renewals; we only turn its events into grant() calls. The
// ledger stays the trust boundary: no entitlement flag, no bypass — a
// subscription is still just credits arriving once per cycle.
//
// Idempotency is unchanged from the Razorpay/IAP paths: the Purchase row is
// INSERTed (providerTxnId = 'rc:<store txn id>') BEFORE grant(), so RC's
// redeliveries collide on the UNIQUE constraint before any ledger write.

import sequelize from '../config/dbConfig.js';
import { User, CreditPlan, Purchase, Subscription } from '../models/index.js';
import { grant } from './creditService.js';
import { env } from '../config/envConfig.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'revenuecat' });

// Events that put money in → credits out. Everything else only touches the
// Subscription row (or is ignored).
const GRANT_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE']);

// Subscription.platform is ENUM('ios','android'); other stores (Test Store,
// Stripe) still grant credits but don't get a Subscription row.
const STORE_PLATFORM = { APP_STORE: 'ios', MAC_APP_STORE: 'ios', PLAY_STORE: 'android' };

export async function handleEvent(ev) {
  const ctx = { type: ev.type, eventId: ev.id, user: ev.app_user_id, product: ev.product_id };

  // A sandbox purchase must never mint production credits, whatever the
  // dashboard's environment filter says.
  if (env.NODE_ENV === 'production' && ev.environment === 'SANDBOX') {
    log.warn(ctx, 'sandbox event ignored in production');
    return { handled: false, reason: 'sandbox' };
  }
  // app_user_id is our User.id (the client calls Purchases.logIn(userId)).
  // Anonymous RC ids mean the client never logged in — nothing to credit.
  if (ev.app_user_id.startsWith('$RCAnonymousID:')) {
    return { handled: false, reason: 'anonymous' };
  }

  const isGrant = GRANT_EVENTS.has(ev.type);
  const isLifecycle = ['CANCELLATION', 'UNCANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'].includes(ev.type);
  if (!isGrant && !isLifecycle) return { handled: false, reason: 'ignored_type' };

  const user = await User.findByPk(ev.app_user_id, { attributes: ['id'] });
  if (!user) { log.warn(ctx, 'unknown user'); return { handled: false, reason: 'unknown_user' }; }
  const plan = await CreditPlan.findOne({ where: { productId: ev.product_id } });
  if (!plan) { log.warn(ctx, 'unknown product'); return { handled: false, reason: 'unknown_product' }; }

  // ── Subscription row (store relationship) ──────────────────────────────
  const platform = STORE_PLATFORM[ev.store];
  if (plan.isSubscription && platform && ev.original_transaction_id) {
    const [sub] = await Subscription.findOrCreate({
      where: { originalTxnId: ev.original_transaction_id },
      defaults: {
        userId: user.id, planId: plan.id, platform,
        originalTxnId: ev.original_transaction_id,
        currentPeriodEnd: new Date(ev.expiration_at_ms ?? Date.now() + plan.periodDays * 86_400_000),
      },
    });
    // Bound to the first account that verified it — never migrate silently.
    if (sub.userId !== user.id) {
      log.warn({ ...ctx, owner: sub.userId }, 'subscription owned by another account');
      return { handled: false, reason: 'owned_elsewhere' };
    }
    const patch = { planId: plan.id };
    if (ev.expiration_at_ms) patch.currentPeriodEnd = new Date(ev.expiration_at_ms);
    if (ev.type === 'CANCELLATION') patch.autoRenew = false;
    if (ev.type === 'UNCANCELLATION' || ev.type === 'RENEWAL') patch.autoRenew = true;
    await sub.update(patch);
  }
  if (!isGrant) return { handled: true, granted: 0 };
  // ponytail: refunds (CANCELLATION w/ cancel_reason CUSTOMER_SUPPORT) don't
  // claw back credits — the ledger stays append-only and we eat the loss.
  // Add a negative ledger row here if refund abuse ever shows up.

  // ── Grant: insert Purchase first, then credits (see header) ─────────────
  if (!ev.transaction_id) return { handled: false, reason: 'no_transaction_id' };
  const providerTxnId = `rc:${ev.transaction_id}`;
  try {
    const result = await sequelize.transaction(async (t) => {
      await Purchase.create({
        userId: user.id, planId: plan.id,
        credits: plan.credits, priceInr: plan.priceInr,
        status: 'paid', provider: 'revenuecat', providerTxnId,
        providerRef: { eventId: ev.id, type: ev.type, store: ev.store, originalTxnId: ev.original_transaction_id },
      }, { transaction: t });
      return grant({
        userId: user.id, amount: plan.credits,
        reason: plan.isSubscription ? 'subscription' : 'purchase',
        meta: { planId: plan.id, rcEventId: ev.id, transactionId: ev.transaction_id },
        transaction: t,
      });
    });
    if (plan.isSubscription && ev.original_transaction_id) {
      await Subscription.update({ latestTxnId: providerTxnId }, { where: { originalTxnId: ev.original_transaction_id } });
    }
    log.info({ ...ctx, granted: result.granted, balance: result.balance }, 'RC purchase settled');
    return { handled: true, ...result };
  } catch (err) {
    if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    // RC redelivered an event we already granted for — the normal retry path.
    return { handled: true, granted: 0, duplicate: true };
  }
}
