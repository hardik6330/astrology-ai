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
import { seedDefaults } from './seeders/runSeeds.js';
import { startScheduler } from './config/scheduler.js';
import { initFirebase, isFirebaseInitialized } from './config/firebase.js';

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
  // Liveness: process is up. Cheap, never touches dependencies.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  // Readiness: verifies the real dependencies a request needs (DB reachable,
  // Firebase auth initialised). The deploy workflow gates rollback on THIS, so a
  // release that boots with a dead DB never goes live. 503 when degraded.
  app.get('/health/deep', async (_req, res) => {
    const checks = { process: 'ok', db: 'unknown', firebase: 'unknown' };
    try {
      await sequelize.authenticate();
      checks.db = 'ok';
    } catch {
      checks.db = 'down';
    }
    checks.firebase = isFirebaseInitialized() ? 'ok' : 'down';
    const healthy = checks.db === 'ok' && checks.firebase === 'ok';
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks });
  });

  // Envelope all /api JSON responses as { success, message, data }.
  // Mounted at BOTH the versioned path and the bare /api alias (v1 registered
  // first so /api/v1/* resolves there). Existing web + already-shipped APKs keep
  // calling /api; new/breaking changes can land on /api/v2 without breaking
  // clients pinned to /api/v1. Clients should migrate to /api/v1 going forward.
  app.use('/api/v1', responseWrapper, routes);
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

// Verify the connection. Schema ownership:
//   • production  → migrations only (`npm run migrate`). sync() never ALTERs an
//     existing table, so it silently misses new columns — relying on it in prod
//     is a latent "Unknown column" bug. Migrations are the source of truth.
//   • dev / test  → sync() for convenience (auto-creates missing tables).
async function initDatabase() {
  await sequelize.authenticate();
  logger.info('Database connection verified');
  if (env.NODE_ENV !== 'production') {
    await sequelize.sync();
    logger.info('Database synced (dev only — missing tables created)');
  }
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
    // Serverless: don't bind a port, don't run the in-process scheduler (an
    // external cron hits /api/cron/run), and don't seed on cold start — seeds
    // run in the deploy step via `npm run seed` so they don't tax the request
    // hot path on every cold start.
    logger.info('Vercel environment detected — DB initialized');
    return;
  }

  // Always-on host (private server / Render / Railway / Fly) or local dev: ONE
  // long-lived process, so seed once at boot and run the in-process scheduler.
  await seedDefaults();

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
