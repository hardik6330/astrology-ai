import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

// Back-office admin account. Separate from AuthAccount (Firebase phone identity)
// and User (birth profile) — admins log in with username + password, not a
// phone OTP. The password is never stored in the clear; only its scrypt hash.
const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  name:         { type: DataTypes.STRING,      allowNull: false },
  username:     { type: DataTypes.STRING(64),  allowNull: false, unique: true },
  // scrypt digest in `salt:hash` hex form — see utils/password.js.
  passwordHash: { type: DataTypes.STRING(255), allowNull: false },
}, { timestamps: true });

export default Admin;
