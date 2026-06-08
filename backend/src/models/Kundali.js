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
  chartData:      { type: DataTypes.JSON, allowNull: false },
  interpretation: { type: DataTypes.JSON, allowNull: false },
}, { timestamps: true });

export default Kundali;
