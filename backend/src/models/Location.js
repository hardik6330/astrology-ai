import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

// Cache of resolved birth-cities. Keyed by Google's place_id so duplicate
// spellings collapse to one row. Coordinates and tz offset are permanent
// (a place's lat/lng doesn't change), so this cache never expires.
const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  placeId:     { type: DataTypes.STRING(128), allowNull: false, unique: true },
  searchName:  { type: DataTypes.STRING(256), allowNull: false },
  lat:         { type: DataTypes.DOUBLE, allowNull: false },
  lng:         { type: DataTypes.DOUBLE, allowNull: false },
  // Hours offset from UTC at the user's BIRTH date (DST-aware). Stored as a
  // float so half-hour zones like IST (+5.5) and Nepal (+5.75) work.
  tzOffset:    { type: DataTypes.FLOAT, allowNull: false },
  tzId:        { type: DataTypes.STRING(64), allowNull: true },  // e.g. "Asia/Kolkata"
  source:      { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'google_api' },
}, {
  timestamps: true,
  indexes: [{ fields: ['searchName'] }],
});

export default Location;
