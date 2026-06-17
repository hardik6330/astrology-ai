// Regression test for the H2 fix: an Apple receipt must be bound to the plan's
// product. The old code took in_app[0].transaction_id blindly, so a user could
// pay for the cheapest SKU and send that receipt with an expensive plan's id to
// get the big plan's credits. appleTxnForProduct is the matching logic that
// closes it — pure, so it's unit-tested directly (the surrounding network +
// env-gated verifyAppleReceipt is not exercised here).

import { describe, it, expect } from 'vitest';
import { appleTxnForProduct } from '../src/services/purchaseService.js';

const CHEAP = 'com.astro.credits.small';
const BIG = 'com.astro.credits.large';

describe('appleTxnForProduct — receipt ↔ plan product binding (H2)', () => {
  it('returns null when no in_app entry matches the requested product (the attack)', () => {
    // Receipt is for the cheap SKU; the client claims the big plan.
    const inApp = [{ product_id: CHEAP, transaction_id: 't_cheap', purchase_date_ms: '1000' }];
    expect(appleTxnForProduct(inApp, BIG)).toBeNull();
  });

  it('returns the transaction id of the matching product, not in_app[0]', () => {
    const inApp = [
      { product_id: CHEAP, transaction_id: 't_cheap', purchase_date_ms: '1000' }, // [0] — must be ignored
      { product_id: BIG,   transaction_id: 't_big',   purchase_date_ms: '2000' },
    ];
    expect(appleTxnForProduct(inApp, BIG)).toBe('t_big');
  });

  it('picks the most recent matching transaction by purchase date', () => {
    const inApp = [
      { product_id: BIG, transaction_id: 't_old', purchase_date_ms: '1000' },
      { product_id: BIG, transaction_id: 't_new', purchase_date_ms: '5000' },
      { product_id: BIG, transaction_id: 't_mid', purchase_date_ms: '3000' },
    ];
    expect(appleTxnForProduct(inApp, BIG)).toBe('t_new');
  });

  it('returns null for an empty/missing in_app array or missing productId', () => {
    expect(appleTxnForProduct([], BIG)).toBeNull();
    expect(appleTxnForProduct(undefined, BIG)).toBeNull();
    expect(appleTxnForProduct([{ product_id: BIG, transaction_id: 't' }], null)).toBeNull();
  });
});
