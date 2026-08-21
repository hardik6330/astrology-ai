// Chart memory moves off the device.
//
// Timeline Check answers and asked Gochar alignments lived in localStorage /
// AsyncStorage, so they died on reinstall and never crossed devices. They're
// the one thing that compounds with use, so they belong on the server.
//
// ⚠️ Guarded, and every future createTable must be too. The baseline (0000) is a
// LIVE sequelize.sync() of the current models — so on a fresh DB it already
// builds this table (and its index) before this migration runs, and an
// unguarded createTable would blow up. On an existing prod DB the baseline
// no-ops and this migration does the real work. Both paths have to pass.

import { DataTypes } from 'sequelize';

export async function up({ context: q }) {
  if (await q.tableExists('ChartMemories')) return;

  await q.createTable('ChartMemories', {
    id:        { type: DataTypes.STRING(24), primaryKey: true },
    accountId: {
      type: DataTypes.STRING(24), allowNull: false,
      references: { model: 'AuthAccounts', key: 'id' },
      onDelete: 'CASCADE', onUpdate: 'CASCADE',
    },
    key:       { type: DataTypes.TEXT, allowNull: false },
    // sha256(key) — fixed width so the composite UNIQUE always fits an index.
    keyHash:   { type: DataTypes.STRING(64), allowNull: false },
    value:     { type: DataTypes.JSON, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await q.addIndex('ChartMemories', ['accountId', 'keyHash'], {
    name: 'chart_memory_account_key', unique: true,
  });
}

export async function down({ context: q }) {
  await q.dropTable('ChartMemories');
}
