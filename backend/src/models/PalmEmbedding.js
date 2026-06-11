import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

// EXPERIMENTAL biometric index for palm matching. Stores a numeric descriptor
// (see utils/palmEmbedding.js) per CLEAR palm reading so a NEW photo of the
// same hand can be matched across users/devices — something the SHA-256
// imageHash can't do. Kept in its own table (not on PalmReading) so this
// biometric-ish data can be queried, tuned, or purged independently.
// Auto-created by sequelize.sync() (new table); no migration needed.
const PalmEmbedding = sequelize.define('PalmEmbedding', {
  id:            { type: DataTypes.STRING(24), primaryKey: true, defaultValue: () => genId() }, //new
  userId:        { type: DataTypes.STRING(24), allowNull: false },
  palmReadingId: { type: DataTypes.STRING(24), allowNull: false },
  handType:      { type: DataTypes.STRING, allowNull: true },     // 'Left' | 'Right' — match within the same hand
  embedding:     { type: DataTypes.JSON, allowNull: false },      // number[] (Geometry/Landmarks)
  textureSignature: { type: DataTypes.JSON, allowNull: true },    // Placeholder for OpenCV texture
  lineSignature:    { type: DataTypes.JSON, allowNull: true },    // Placeholder for OpenCV lines
  // The reading content is denormalized here so a biometric match is
  // self-contained — it doesn't break if the source PalmReading row is deleted.
  reading:       { type: DataTypes.JSON, allowNull: true },
}, {
  timestamps: true,
  indexes: [{ fields: ['handType'] }], // narrow the 1:N scan to one hand
});

export default PalmEmbedding;
