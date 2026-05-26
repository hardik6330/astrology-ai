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
}, { timestamps: true });

export default User;
