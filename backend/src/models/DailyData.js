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
  // Birth-identity hash (name+date+time+city+gender — see utils/chartHash.js).
  // Daily guidance depends on the natal chart, so it's cached PER chart: a user
  // who edits birth details and returns to a prior chart re-views that chart's
  // saved days for free instead of re-charging. Nullable for legacy rows.
  chartHash: { type: DataTypes.STRING(64), allowNull: true },
  guidance: { type: DataTypes.JSON, allowNull: false },
}, {
  timestamps: true,
  // Every daily fetch/save filters { userId, date, chartHash }. UNIQUE on the
  // triple: one reading per user per day per chart — guards against a concurrent
  // double-insert for the same (date, chart).
  indexes: [{ name: 'daily_data_user_date_chart', fields: ['userId', 'date', 'chartHash'], unique: true }],
});

export default DailyData;
