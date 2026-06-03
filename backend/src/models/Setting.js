// Key/value store for runtime-configurable system settings (credits + feature
// costs). Values are stored as strings; callers coerce (Number()) as needed.
// Sequelize pluralizes the table name to "Settings".

import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';

const Setting = sequelize.define('Setting', {
  key:         { type: DataTypes.STRING(64),  primaryKey: true },
  value:       { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.STRING(255), allowNull: true },
}, { timestamps: true });

export default Setting;
