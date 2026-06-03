import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import os from 'node:os';

import { env } from './config/envConfig.js';
import { logger } from './config/logger.js';
import { corsOptions } from './config/cors.js';
import sequelize from './config/dbConfig.js';
// import { initFirebase } from './config/firebase.js';
import './models/index.js';                       // register associations

// initFirebase();

import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { responseWrapper } from './middleware/responseWrapper.js';
import { seedFromStaticCities } from './services/locationService.js';
import { SEED_CITIES } from './services/locationSeed.js';
import { seedAdmin } from './services/adminSeed.js';
import { seedSettings } from './services/settingsSeed.js';
import { seedNotificationTemplates } from './services/notificationSeed.js';
import { startScheduler } from './config/scheduler.js';

const app = express();

// Trust the first reverse proxy (nginx / Cloudflare / Render / Fly) so that
// rate-limiting + req.ip use the real client IP from X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

app.get('/', (_req, res) => res.send('Server is running'));

// Envelope all /api JSON responses as { success, message, data }.
app.use('/api', responseWrapper, routes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

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

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection verified');
    // sync() with no options is non-destructive: creates missing tables,
    // never alters or drops existing columns. Safe to run on every boot.
    await sequelize.sync();
    logger.info('Database synced (missing tables created)');
    // One-time seed: copy the legacy hard-coded cities into the Location
    // cache so existing top picks don't cost a Google call on first lookup.
    // No-op once they're in. Best-effort — failure must not block startup.
    seedFromStaticCities(SEED_CITIES).catch((err) =>
      logger.warn({ err }, 'Location seed skipped'));
    // One-time admin seed: creates the default back-office admin from env only
    // if no admin exists yet. No-op thereafter. Best-effort — never blocks boot.
    seedAdmin().catch((err) => logger.warn({ err }, 'Admin seed skipped'));
    // One-time settings seed: inserts default credit/cost keys if missing.
    // Idempotent + best-effort — admin edits are preserved, never blocks boot.
    seedSettings().catch((err) => logger.warn({ err }, 'Settings seed skipped'));
    // One-time notification-pool seed: curated English engagement hooks, only
    // inserted when the table is empty (admin curation is preserved).
    seedNotificationTemplates().catch((err) => logger.warn({ err }, 'Notification seed skipped'));
  } catch (err) {
    logger.fatal({ err }, 'Database init failed');
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
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start();
