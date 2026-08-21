import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

// Per-account key/value memory for the "show your work" layer — the user's
// answers to Timeline Checks and which Gochar alignments they've already asked
// about. This lived in localStorage / AsyncStorage, which meant it died on
// reinstall and never crossed devices. It's the one asset that compounds with
// use, so it belongs on the server.
//
// Keyed on accountId (not userId) because an account exists from first login,
// before any birth profile does, and the CASCADE mirrors PushToken.
const ChartMemory = sequelize.define('ChartMemory', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  accountId: { type: DataTypes.STRING(24), allowNull: false },
  // The client's opaque key, kept in full for debuggability. TEXT because a
  // timelineCheck key embeds a whole question and can outrun any VARCHAR we'd
  // pick — which is exactly why the UNIQUE index below is on the hash, not this.
  key:     { type: DataTypes.TEXT, allowNull: false },
  // sha256(key). Fixed width, so the composite UNIQUE always fits an index and
  // two different long questions can never collide into one row via truncation.
  keyHash: { type: DataTypes.STRING(64), allowNull: false },
  value:   { type: DataTypes.JSON, allowNull: false },
}, {
  timestamps: true,
  indexes: [{ name: 'chart_memory_account_key', fields: ['accountId', 'keyHash'], unique: true }],
});

export default ChartMemory;
