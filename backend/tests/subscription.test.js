import { describe, it, expect, beforeAll } from 'vitest';
import sequelize from '../src/config/dbConfig.js';
import { User, CreditPlan, Purchase, Subscription, CreditTransaction } from '../src/models/index.js';
import { appleLatestSubscription, verifyIapSubscription, getSubscription } from '../src/services/purchaseService.js';
import { getBalance } from '../src/services/creditService.js';

// User requires the full birth form — mirrors tests/money.test.js.
const USER_FORM = { name: 'Sub Tester', birthDate: '2000-01-01', birthTime: '12:00', birthCity: 'Mumbai' };

const SUB_SKU = 'com.astro.plus.monthly';
const OTHER_SKU = 'com.astro.other.monthly';

describe('appleLatestSubscription — receipt ↔ plan product binding', () => {
  it('ignores entries for a different product (the cheap-SKU attack)', () => {
    const info = [{ product_id: OTHER_SKU, transaction_id: 't1', expires_date_ms: '9999999999999' }];
    expect(appleLatestSubscription(info, SUB_SKU)).toBeNull();
  });

  it('picks the newest expiry, not the first entry', () => {
    const info = [
      { product_id: SUB_SKU, transaction_id: 'old', original_transaction_id: 'orig', expires_date_ms: '1000' },
      { product_id: SUB_SKU, transaction_id: 'new', original_transaction_id: 'orig', expires_date_ms: '5000' },
    ];
    expect(appleLatestSubscription(info, SUB_SKU)).toEqual({
      originalTxnId: 'orig', latestTxnId: 'new', expiresAt: new Date(5000),
    });
  });

  it('returns null without an expiry — a subscription with no period is not a subscription', () => {
    const info = [{ product_id: SUB_SKU, transaction_id: 't1' }];
    expect(appleLatestSubscription(info, SUB_SKU)).toBeNull();
  });
});

// The renewal path is where a double-grant would live: the client re-verifies on
// every launch, so "same cycle → no credits, new cycle → credits" is the whole
// contract. Runs against the dev mock verifier (no store secrets in tests).
describe('verifyIapSubscription', () => {
  let plan, user;

  beforeAll(async () => {
    // WAL so the services' transactions coexist on sqlite — see money.test.js.
    await sequelize.query('PRAGMA journal_mode=WAL;');
    await sequelize.sync();
    plan = await CreditPlan.create({
      name: 'Plus', productId: SUB_SKU, credits: 500, priceInr: 14900,
      isSubscription: true, periodDays: 30,
    });
    user = await User.create({ ...USER_FORM, phone: '+919000000001', credits: 0 });
  });

  const verify = (purchaseToken) => verifyIapSubscription({
    userId: user.id, planId: plan.id, platform: 'android', purchaseToken,
  });

  it('grants the cycle allowance on first verify', async () => {
    const res = await verify('tok-1');
    expect(res.granted).toBe(500);
    expect(res.subscription.active).toBe(true);
    expect(await getBalance(user.id)).toBe(500);
  });

  it('grants nothing when the same cycle is re-verified (every app launch)', async () => {
    const before = await getBalance(user.id);
    const res = await verify('tok-1');
    expect(res.granted).toBe(0);
    expect(await getBalance(user.id)).toBe(before);

    // One Purchase row for the cycle, one ledger entry — not two.
    const sub = await Subscription.findOne({ where: { userId: user.id } });
    const purchases = await Purchase.findAll({ where: { userId: user.id } });
    expect(purchases).toHaveLength(1);
    expect(sub.latestTxnId).toBe(purchases[0].providerTxnId);

    const grants = await CreditTransaction.findAll({ where: { userId: user.id, reason: 'subscription' } });
    expect(grants).toHaveLength(1);
  });

  it('refuses a plan that is not a subscription', async () => {
    const pack = await CreditPlan.create({ name: 'Pack', productId: 'com.astro.pack', credits: 100, priceInr: 4900 });
    await expect(verifyIapSubscription({
      userId: user.id, planId: pack.id, platform: 'android', purchaseToken: 'tok-x',
    })).rejects.toMatchObject({ code: 'NOT_A_SUBSCRIPTION' });
  });

  it('refuses to move a store subscription onto a second app account', async () => {
    const other = await User.create({ ...USER_FORM, name: 'Other', phone: '+919000000002', credits: 0 });
    const sub = await Subscription.findOne({ where: { userId: user.id } });

    await expect(verifyIapSubscription({
      userId: other.id, planId: plan.id, platform: 'android', purchaseToken: sub.originalTxnId,
    })).rejects.toMatchObject({ code: 'SUBSCRIPTION_OWNED_ELSEWHERE' });
    expect(await getBalance(other.id)).toBe(0);
  });

  it('grants nothing once the period has lapsed', async () => {
    const sub = await Subscription.findOne({ where: { userId: user.id } });
    await sub.update({ currentPeriodEnd: new Date(Date.now() - 86_400_000), autoRenew: false });

    const state = await getSubscription(user.id);
    expect(state.active).toBe(false);
  });
});
