// Process entry point: connects the DB, runs idempotent seeds, binds the port,
// starts the in-process scheduler, and handles graceful shutdown.

import os from 'node:os';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config/envConfig.js';
import { logger } from './config/logger.js';
import sequelize from './config/dbConfig.js';
import { corsOptions } from './config/cors.js';
import './models/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { responseWrapper } from './middleware/responseWrapper.js';
import { seedAdmin } from './seeders/adminSeed.js';
import { seedSettings } from './seeders/settingsSeed.js';
import { seedNotificationTemplates } from './seeders/notificationSeed.js';
import { seedCreditPlans } from './seeders/creditPlanSeed.js';
import { startScheduler } from './config/scheduler.js';
import { initFirebase } from './config/firebase.js';

// ── Express App Setup ────────────────────────────────────────────────────────

export function createApp() {
  const app = express();

  // Trust the first reverse proxy (nginx / Cloudflare / Render / Fly) so that
  // rate-limiting + req.ip use the real client IP from X-Forwarded-For.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));

  app.get('/', (_req, res) => res.send('Server is running'));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Envelope all /api JSON responses as { success, message, data }.
  app.use('/api', responseWrapper, routes);

  // Centralized error handler — must be mounted LAST.
  app.use(errorHandler);

  return app;
}

const app = createApp();

// Default instance for serverless handlers (Vercel) and tests.
export default app;

// ── Server Startup ───────────────────────────────────────────────────────────

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

// Verify the connection, create any missing tables, then seed defaults.
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
    initFirebase();
  } catch (err) {
    logger.fatal({ err }, 'Startup init failed');
    if (env.NODE_ENV === 'production') process.exit(1);
  }

  // On Vercel, the platform handles port binding. Vercel sets VERCEL=1, so match
  // EXACTLY '1' — env vars are strings and the string "0" is truthy, so a plain
  // `if (process.env.VERCEL)` would treat VERCEL=0 as "on Vercel" and skip
  // app.listen(), making the local dev server exit immediately.
  const onVercel = process.env.VERCEL === '1';
  if (onVercel) {
    logger.info('Vercel environment detected — DB initialized');
    return;
  }

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${env.PORT}`);
    logLanUrls(env.PORT);
  });

  startScheduler();

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
