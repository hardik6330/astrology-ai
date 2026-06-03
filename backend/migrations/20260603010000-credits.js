// Cosmic Credits: a spendable balance on each user + a ledger of every
// grant/spend. The credits column is backfilled with the welcome bonus so the
// rollout doesn't lock existing users out; new-profile grants are written
// explicitly (with a ledger row) by userService.findOrCreateUser.

import { DataTypes } from 'sequelize';

export async function up({ context: q }) {
  await q.addColumn('Users', 'credits', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
  // Backfill pre-existing users with the welcome bonus.
  await q.sequelize.query('UPDATE Users SET credits = 200');

  await q.createTable('CreditTransactions', {
    id:        { type: DataTypes.STRING(24), primaryKey: true },
    userId:    {
      type: DataTypes.STRING(24),
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      onDelete: 'CASCADE',
    },
    amount:    { type: DataTypes.INTEGER, allowNull: false }, // + grant / − spend
    balance:   { type: DataTypes.INTEGER, allowNull: false }, // resulting balance after this txn
    reason:    { type: DataTypes.STRING(40), allowNull: false }, // signup_bonus | carryover | chat | insights | daily | palm | refund | admin
    meta:      { type: DataTypes.JSON, allowNull: true }, // optional context (e.g. date, message)
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await q.addIndex('CreditTransactions', ['userId', 'createdAt']);
}

export async function down({ context: q }) {
  await q.dropTable('CreditTransactions');
  await q.removeColumn('Users', 'credits');
}
