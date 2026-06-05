// Adds Purchases.providerTxnId — a unique, gateway-side transaction id used to
// make payment settlement idempotent (razorpay_payment_id for web, hashed Play
// purchaseToken for IAP). Defensive: the Purchases table is created by
// sequelize.sync() on fresh boots (which already includes this column from the
// model), so we only add it when it's actually missing — keeping this safe to
// run on both sync-created and migrate-created databases.

import { DataTypes } from 'sequelize';

export async function up({ context: q }) {
  const table = await q.describeTable('Purchases');
  if (table.providerTxnId) return; // already present (sync-created DB) — no-op

  await q.addColumn('Purchases', 'providerTxnId', {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
  });
}

export async function down({ context: q }) {
  const table = await q.describeTable('Purchases');
  if (!table.providerTxnId) return;
  await q.removeColumn('Purchases', 'providerTxnId');
}
