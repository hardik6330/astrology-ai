// One row per credit-purchase attempt. Kept separate from the CreditTransaction
// ledger so we have an order record independent of the balance movement, with
// room for a real payment gateway later (provider + providerRef).
//
// `credits` and `priceInr` are SNAPSHOTTED from the plan at purchase time, so
// editing or disabling a plan afterwards never rewrites past orders.
//
// Lifecycle: created → paid (credits granted) | failed.

import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

const Purchase = sequelize.define('Purchase', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  userId:   { type: DataTypes.STRING(24), allowNull: false },
  planId:   { type: DataTypes.STRING(24), allowNull: false },
  credits:  { type: DataTypes.INTEGER, allowNull: false },         // snapshot
  priceInr: { type: DataTypes.INTEGER, allowNull: false },         // snapshot (paise)
  // created → paid → failed. Guards against double-crediting (see purchaseService).
  status:   { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'created' },
  // 'mock' now; 'razorpay' / 'stripe' when real payment lands.
  provider: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'mock' },
  // Gateway ids/signature blob (razorpay_order_id, payment_id, signature…).
  providerRef: { type: DataTypes.JSON, allowNull: true },
  // Single stable, gateway-side transaction id used for idempotency: the
  // razorpay_payment_id for web, or a hash of the Play purchaseToken for IAP.
  // UNIQUE so a replayed verify (double-submit, retry) can never grant twice —
  // the second settle collides instead of creating a duplicate paid order.
  providerTxnId: { type: DataTypes.STRING(255), allowNull: true, unique: true },
}, { timestamps: true });

export default Purchase;
