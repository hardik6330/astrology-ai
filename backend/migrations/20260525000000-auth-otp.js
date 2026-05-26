// Phone-OTP auth: adds Users.phone and a separate AuthAccounts table
// mapping firebaseUid → phone. Identity (firebase) is intentionally NOT
// stored on the Users row — only the phone number is, so the public
// profile table stays focused on chart data.

import { DataTypes } from 'sequelize';

export async function up({ context: q }) {
  await q.addColumn('Users', 'phone', { type: DataTypes.STRING(20), allowNull: true });

  await q.createTable('AuthAccounts', {
    id:          { type: DataTypes.STRING(24),  primaryKey: true },
    firebaseUid: { type: DataTypes.STRING(128), allowNull: false, unique: true },
    phone:       { type: DataTypes.STRING(20),  allowNull: false },
    lastLoginAt: { type: DataTypes.DATE,        allowNull: true  },
    createdAt:   { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt:   { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW },
  });
  await q.addIndex('AuthAccounts', ['phone']);
}

export async function down({ context: q }) {
  await q.dropTable('AuthAccounts');
  await q.removeColumn('Users', 'phone');
}
