// Process entry point: connects the DB, runs idempotent seeds, binds the port,
// starts the in-process scheduler, and handles graceful shutdown. The Express
// app itself is built in app.js (so tests/serverless can import it port-free).

import os from 'node:os';

import app from './app.js';
import { env } from './config/envConfig.js';
import { logger } from './config/logger.js';
import sequelize from './config/dbConfig.js';
import { seedAdmin } from './seeders/adminSeed.js';
import { seedSettings } from './seeders/settingsSeed.js';
import { seedNotificationTemplates } from './seeders/notificationSeed.js';
import { seedCreditPlans } from './seeders/creditPlanSeed.js';
import { startScheduler } from './config/scheduler.js';
import { initFirebase } from './config/firebase.js';

// Print every non-internal IPv4 interface so the dev knows which LAN address
// to hit from a phone / second device on the same Wi-Fi.
function logLanUrls(port) {
  logger.info(`Local:   http://localhost:${port}`);
  Object.values(os.networkInterfaces()).flat().forEach((i) => {
    if (i && i.family === 'IPv4' && !i.internal) {
      logger.info(`Network: http://${i.address}:${port}`);
    }
  });
}

// Verify the connection, create any missing tables, then seed defaults. sync()
// with no options is non-destructive: it creates missing tables and never
// alters or drops existing columns, so it's safe to run on every boot. Seeds
// are idempotent + best-effort — they must never block startup.
async function initDatabase() {
  await sequelize.authenticate();
  logger.info('Database connection verified');
  await sequelize.sync();
  logger.info('Database synced (missing tables created)');

  seedAdmin().catch((err) => logger.warn({ err }, 'Admin seed skipped'));
  seedSettings().catch((err) => logger.warn({ err }, 'Settings seed skipped'));
  seedNotificationTemplates().catch((err) => logger.warn({ err }, 'Notification seed skipped'));
  seedCreditPlans().catch((err) => logger.warn({ err }, 'Credit plan seed skipped'));
}

async function start() {
  try {
    await initDatabase();
    // L1: prove Firebase creds are valid at boot so prod fails fast instead of
    // serving an app where login is silently broken (throws in prod, warns in dev).
    initFirebase();
  } catch (err) {
    logger.fatal({ err }, 'Startup init failed');
    if (env.NODE_ENV === 'production') process.exit(1);
  }

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${env.PORT}`);
    logLanUrls(env.PORT);
  });

  // Start the in-process push scheduler — but NOT on Vercel, where the function
  // is ephemeral and the timers would never fire. Vercel sets process.env.VERCEL.
  if (!process.env.VERCEL) {
    startScheduler();
  } else {
    logger.warn('Vercel detected — in-process scheduler skipped (use external cron)');
  }

  // Graceful shutdown — let in-flight requests finish before exiting.
  function shutdown(signal) {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      sequelize.close().finally(() => process.exit(0));
    });
    setTimeout(() => {
      logger.error('Force-exiting after 10s grace period');
      process.exit(1);
    }, 10_000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
