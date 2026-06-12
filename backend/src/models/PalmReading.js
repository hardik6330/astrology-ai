import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

// One palm reading per analysis attempt. The image itself is NEVER stored —
// only the SHA-256 hash (for dedupe) and the AI-generated reading.
const PalmReading = sequelize.define('PalmReading', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  userId:       { type: DataTypes.STRING(24), allowNull: false },
  deviceId:     { type: DataTypes.STRING, allowNull: true },   // Layer 1: Unique device identification
  handType:     { type: DataTypes.STRING, allowNull: true },   // 'Left' | 'Right' | 'Unclear'
  imageQuality: { type: DataTypes.STRING, allowNull: true },   // 'clear' | 'blurry' | 'unusable'
  imageHash:    { type: DataTypes.STRING(64), allowNull: true },
  reading:      { type: DataTypes.JSON, allowNull: false },
}, {
  timestamps: true,
  // Per-scan dedupe filters { userId, imageHash } before any AI spend.
  indexes: [
    { name: 'palm_readings_user_image_hash', fields: ['userId', 'imageHash'] },
    { fields: ['deviceId'] }
  ],
});

export default PalmReading;
