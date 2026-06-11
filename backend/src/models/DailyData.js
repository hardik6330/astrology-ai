import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

const DailyData = sequelize.define('DailyData', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  userId:   { type: DataTypes.STRING(24), allowNull: false },
  date:     { type: DataTypes.DATEONLY, allowNull: false },
  guidance: { type: DataTypes.JSON, allowNull: false },
}, {
  timestamps: true,
  // Every daily fetch/save filters { userId, date } — serve it from one index.
  indexes: [{ name: 'daily_data_user_date', fields: ['userId', 'date'] }],
});

export default DailyData;
