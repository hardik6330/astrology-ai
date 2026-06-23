import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

const Kundali = sequelize.define('Kundali', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  userId:         { type: DataTypes.STRING(24), allowNull: false },
  locationId:     { type: DataTypes.STRING(24), allowNull: true },
  // Birth-identity hash (name+date+time+city+gender — see utils/chartHash.js).
  // The cache key: a user keeps ONE saved interpretation per distinct chart, so
  // editing birth details and later returning to a prior chart is a free
  // re-view instead of a re-charge. Nullable for legacy/incomplete rows.
  chartHash:      { type: DataTypes.STRING(64), allowNull: true },
  chartData:      { type: DataTypes.JSON, allowNull: false },
  interpretation: { type: DataTypes.JSON, allowNull: false },
}, {
  timestamps: true,
  // Reads are `findOne({ where: { userId, chartHash } })`. UNIQUE on the pair:
  // one saved chart per (user, birth-identity), and a concurrent double-insert
  // for the same chart fails at the DB instead of forking a second row. The
  // composite also serves userId-only lookups (left-prefix).
  indexes: [{ name: 'kundalis_user_charthash', fields: ['userId', 'chartHash'], unique: true }],
});

export default Kundali;
