#!/usr/bin/env node
// One-off schema builder for an always-on host (e.g. the Oracle VPS) where we
// run with NODE_ENV=production. In production server.js does NOT call sync()
// (migrations are meant to own the schema), so a fresh prod DB would have zero
// tables. This script forces a sync() regardless of NODE_ENV.
//
// Because sync() builds tables FRESH, it also emits the real FK constraints
// from models/index.js (ON DELETE CASCADE/SET NULL) — so on a brand-new DB this
// gives you DB-level referential integrity, not just app-side metadata.
//
//   Usage (run ONCE against the live DB, before flipping to production):
//     cd backend && node src/scripts/syncSchema.js
//
// Notes:
//   • Importing ./models/index.js registers every model + association so sync()
//     knows about all 14 tables and their FKs.
//   • sync() is non-destructive: it CREATEs missing tables but never ALTERs or
//     drops existing ones. It will NOT add FKs to tables that already exist
//     without them — for that, start from an empty schema (drop & re-run) or
//     write a migration. Pass `--alter` only on a throwaway DB; it is risky.
//   • For ongoing schema changes after launch, switch to real migrations
//     (npm run migrate). This script is the bootstrap, not the long-term tool.

import sequelize from '../config/dbConfig.js';
import '../models/index.js'; // registers all models + associations

const alter = process.argv.includes('--alter');

try {
  await sequelize.authenticate();
  console.log(`Connected to ${sequelize.getDatabaseName?.() ?? 'database'}.`);

  await sequelize.sync(alter ? { alter: true } : undefined);
  console.log(`✓ Schema synced${alter ? ' (alter mode)' : ''} — all tables + FK constraints created.`);

  process.exit(0);
} catch (err) {
  console.error('Schema sync failed:', err);
  process.exit(1);
}
