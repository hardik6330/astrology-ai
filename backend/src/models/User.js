import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  phone:     { type: DataTypes.STRING, allowNull: true },
  name:      { type: DataTypes.STRING, allowNull: false },
  gender:    { type: DataTypes.STRING, allowNull: true },
  birthDate: { type: DataTypes.STRING, allowNull: false },
  birthTime: { type: DataTypes.STRING, allowNull: false },
  birthCity: { type: DataTypes.STRING, allowNull: false },
  // Spendable Cosmic Credits balance. New profiles are granted the
  // initial_credits bonus on creation (see userService.findOrCreateUser).
  credits:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  timestamps: true,
  // findUserByForm (every content request) filters on name+birth fields, and
  // sibling lookups do the same — (name, birthDate) keeps those off full scans.
  // Phone EQUALITY (form-scoped lookups) uses the phone index; the suffix
  // LIKE '%digits' login path can't use any B-tree index by nature.
  indexes: [
    { name: 'users_name_birth_date', fields: ['name', 'birthDate'] },
    { name: 'users_phone', fields: ['phone'] },
  ],
});

export default User;
