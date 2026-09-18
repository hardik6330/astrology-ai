// RevenueCat webhook → credit ledger. RC verifies the store receipt; we only
// turn its purchase events into grant() calls. The ledger stays the trust
// boundary: no entitlement flag, no bypass.
//
// Idempotency is the same as every other grant path: the Purchase row is
// INSERTed (providerTxnId = 'rc:<store txn id>') BEFORE grant(), so RC's
// redeliveries collide on the UNIQUE constraint before any ledger write.

import sequelize from '../config/dbConfig.js';
import { User, CreditPlan, Purchase } from '../models/index.js';
import { grant } from './creditService.js';
import { env } from '../config/envConfig.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'revenuecat' });

// One-off packs only — every other event type (renewals, cancellations…) is
// acknowledged and ignored; the product has no subscriptions.
const GRANT_EVENTS = new Set(['NON_RENEWING_PURCHASE', 'INITIAL_PURCHASE']);

export async function handleEvent(ev) {
  const ctx = { type: ev.type, eventId: ev.id, user: ev.app_user_id, product: ev.product_id };

  // A sandbox purchase must never mint production credits, whatever the
  // dashboard's environment filter says.
  if (env.NODE_ENV === 'production' && ev.environment === 'SANDBOX') {
    log.warn(ctx, 'sandbox event ignored in production');
    return { handled: false, reason: 'sandbox' };
  }
  if (!GRANT_EVENTS.has(ev.type)) return { handled: false, reason: 'ignored_type' };
  // app_user_id is our User.id (the client calls Purchases.logIn(userId)).
  // Anonymous RC ids mean the client never logged in — nothing to credit.
  if (ev.app_user_id.startsWith('$RCAnonymousID:')) {
    return { handled: false, reason: 'anonymous' };
  }
  if (!ev.transaction_id) return { handled: false, reason: 'no_transaction_id' };

  const user = await User.findByPk(ev.app_user_id, { attributes: ['id'] });
  if (!user) { log.warn(ctx, 'unknown user'); return { handled: false, reason: 'unknown_user' }; }
  const plan = await CreditPlan.findOne({ where: { productId: ev.product_id } });
  if (!plan) { log.warn(ctx, 'unknown product'); return { handled: false, reason: 'unknown_product' }; }
  // ponytail: refunds don't claw back credits — the ledger stays append-only
  // and we eat the loss. Add a negative ledger row on CANCELLATION if abused.

  try {
    const result = await sequelize.transaction(async (t) => {
      await Purchase.create({
        userId: user.id, planId: plan.id,
        credits: plan.credits, priceInr: plan.priceInr,
        status: 'paid', provider: 'revenuecat',
        providerTxnId: `rc:${ev.transaction_id}`,
        providerRef: { eventId: ev.id, type: ev.type, store: ev.store },
      }, { transaction: t });
      return grant({
        userId: user.id, amount: plan.credits, reason: 'purchase',
        meta: { planId: plan.id, rcEventId: ev.id, transactionId: ev.transaction_id },
        transaction: t,
      });
    });
    log.info({ ...ctx, granted: result.granted, balance: result.balance }, 'RC purchase settled');
    return { handled: true, ...result };
  } catch (err) {
    if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    // RC redelivered an event we already granted for — the normal retry path.
    return { handled: true, granted: 0, duplicate: true };
  }
}
