import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

// An auto-renewing store subscription. Entitlement is deliberately NOT a flag
// the feature services check: each renewal simply grants that cycle's credit
// allowance through the normal ledger, so charge() / 402 / refunds all keep
// working untouched. A subscriber just never runs the balance down.
//
// This row is the *store* relationship — what the user bought, whether it's
// still paid for, and which transaction we last granted for. The credits
// themselves live in CreditTransaction like every other grant.
const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  userId: { type: DataTypes.STRING(24), allowNull: false },
  planId: { type: DataTypes.STRING(24), allowNull: false },
  platform: { type: DataTypes.ENUM('ios', 'android'), allowNull: false },
  // Apple's original_transaction_id / Google's purchase token. Stable across
  // renewals, so it identifies the SUBSCRIPTION rather than one payment.
  // UNIQUE: one row per store subscription, so a replayed verify updates
  // instead of creating a parallel entitlement.
  originalTxnId: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  // The most recent renewal we've already granted credits for. Compared against
  // the store's latest transaction to decide whether a new cycle is owed.
  latestTxnId:   { type: DataTypes.STRING(255), allowNull: true },
  // When the current paid period ends. `active` is derived from this, never
  // stored — a stored flag needs a cron to stay honest and silently rots when
  // that cron doesn't run.
  currentPeriodEnd: { type: DataTypes.DATE, allowNull: false },
  autoRenew: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  timestamps: true,
  indexes: [{ name: 'subscriptions_user_id', fields: ['userId'] }],
});

// True while the paid period hasn't elapsed. Cancelled-but-not-yet-expired
// still counts — the user paid through the end of the period.
Subscription.prototype.isActive = function isActive(now = new Date()) {
  return this.currentPeriodEnd > now;
};

export default Subscription;
