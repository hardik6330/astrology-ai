#!/usr/bin/env node
// Run idempotent default-data seeds as a deploy step. Used on serverless
// (Vercel), where seeding on every cold start would waste DB round-trips — run
// this once per deploy instead:  node src/scripts/seed.js
// Safe to re-run; an always-on server seeds automatically at boot.

import sequelize from '../config/dbConfig.js';
import '../models/index.js';
import { seedDefaults } from '../seeders/runSeeds.js';

try {
  await sequelize.authenticate();
  await seedDefaults();
  console.log('✓ Seeds applied.');
  await sequelize.close();
  process.exit(0);
} catch (err) {
  console.error('Seeding failed:', err);
  process.exit(1);
}
