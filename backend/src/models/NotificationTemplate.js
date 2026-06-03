// A pool of short, English "engagement" push notifications (Astroyogi-style
// hooks). The engage cron job picks one at random and fans it out. `enabled`
// lets the admin curate the pool; `lastSentAt` drives least-recently-used
// rotation so the same line isn't repeated back-to-back. AI-drafted lines land
// with source='ai' and enabled=false until an admin approves them.
//
// Simple new table → created by sequelize.sync() on boot (no migration needed,
// per CLAUDE.md: migrations are only for column/alter changes).

import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

const NotificationTemplate = sequelize.define('NotificationTemplate', {
  id:        { type: DataTypes.STRING(24),  primaryKey: true, defaultValue: () => genId() },
  title:     { type: DataTypes.STRING(160), allowNull: false },
  body:      { type: DataTypes.STRING(500), allowNull: false },
  category:  { type: DataTypes.STRING(32),  allowNull: true },   // love | money | career | dasha | …
  screen:    { type: DataTypes.STRING(32),  allowNull: false, defaultValue: 'reading' }, // deep-link target
  enabled:   { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true },
  source:    { type: DataTypes.STRING(16),  allowNull: false, defaultValue: 'curated' }, // curated | ai
  lastSentAt:{ type: DataTypes.DATE,        allowNull: true },
}, { timestamps: true });

export default NotificationTemplate;
