// Subscriptions: monthly credit allowance bought through the app stores.
//
// Deliberately NOT an entitlement flag the feature services check — each
// renewal just grants that cycle's credits through the normal ledger, so
// charge() / 402 / refunds keep working untouched and a subscriber simply never
// runs their balance down. That's why there's no code change outside billing.
//
// Guarded like every forward createTable: the baseline (0000) is a live sync()
// of the CURRENT models, so on a fresh DB it has already built this. See
// MIGRATIONS.md.

import { DataTypes } from 'sequelize';

export async function up({ context: q }) {
  // CreditPlan gains the subscription flags. addColumn is what sync() CANNOT do
  // on an existing table, so these are the real work of this migration.
  const planCols = await q.describeTable('CreditPlans');
  if (!planCols.isSubscription) {
    await q.addColumn('CreditPlans', 'isSubscription', {
      type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
    });
  }
  if (!planCols.periodDays) {
    await q.addColumn('CreditPlans', 'periodDays', {
      type: DataTypes.INTEGER, allowNull: false, defaultValue: 30,
    });
  }

  if (await q.tableExists('Subscriptions')) return;

  await q.createTable('Subscriptions', {
    id:     { type: DataTypes.STRING(24), primaryKey: true },
    userId: {
      type: DataTypes.STRING(24), allowNull: false,
      references: { model: 'Users', key: 'id' },
      onDelete: 'CASCADE', onUpdate: 'CASCADE',
    },
    planId: { type: DataTypes.STRING(24), allowNull: false },
    platform: { type: DataTypes.ENUM('ios', 'android'), allowNull: false },
    // Stable across renewals — identifies the subscription, not one payment.
    // UNIQUE so a replayed verify updates rather than forking the entitlement.
    originalTxnId:    { type: DataTypes.STRING(255), allowNull: false, unique: true },
    latestTxnId:      { type: DataTypes.STRING(255), allowNull: true },
    currentPeriodEnd: { type: DataTypes.DATE, allowNull: false },
    autoRenew:        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt:        { type: DataTypes.DATE, allowNull: false },
    updatedAt:        { type: DataTypes.DATE, allowNull: false },
  });
  await q.addIndex('Subscriptions', ['userId'], { name: 'subscriptions_user_id' });
}

export async function down({ context: q }) {
  await q.dropTable('Subscriptions');
  await q.removeColumn('CreditPlans', 'periodDays');
  await q.removeColumn('CreditPlans', 'isSubscription');
}
