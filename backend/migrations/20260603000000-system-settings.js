// System settings: a key/value store for runtime-configurable values
// (initial credits, per-feature costs, …) so they can be changed from the
// admin panel without a redeploy. Defaults are seeded at boot by
// services/settingsSeed.js (idempotent), keeping this migration structural.

import { DataTypes } from 'sequelize';

export async function up({ context: q }) {
  await q.createTable('Settings', {
    key:         { type: DataTypes.STRING(64),  primaryKey: true },
    value:       { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: true },
    createdAt:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
}

export async function down({ context: q }) {
  await q.dropTable('Settings');
}
