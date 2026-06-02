// One row per device push token. A single AuthAccount can own several (phone +
// tablet), so the account→token relationship is one-to-many. We store the raw
// FCM registration token and disable (not delete) it when FCM reports it dead,
// keeping a cheap audit trail of churned devices.

import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

const PushToken = sequelize.define('PushToken', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  accountId:  { type: DataTypes.STRING(24),  allowNull: false },
  // FCM tokens are long and unbounded-ish; 512 keeps the unique index inside
  // MySQL's 3072-byte utf8mb4 key limit while comfortably fitting real tokens.
  token:      { type: DataTypes.STRING(512), allowNull: false, unique: true },
  platform:   { type: DataTypes.STRING(16),  allowNull: true },  // 'android' | 'ios'
  enabled:    { type: DataTypes.BOOLEAN,      allowNull: false, defaultValue: true },
  lastSeenAt: { type: DataTypes.DATE,         allowNull: true },
}, { timestamps: true });

export default PushToken;
