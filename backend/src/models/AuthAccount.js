// Auth identity ledger — kept separate from Users so the public profile
// (name, birth details) is decoupled from the credential / firebase identity.
// One row per phone number we've ever verified via Firebase Phone Auth.

import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

const AuthAccount = sequelize.define('AuthAccount', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  firebaseUid: { type: DataTypes.STRING(128), allowNull: false, unique: true },
  phone:       { type: DataTypes.STRING(20),  allowNull: false },
  lastLoginAt: { type: DataTypes.DATE,        allowNull: true  },
}, { timestamps: true });

export default AuthAccount;
