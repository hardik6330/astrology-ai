import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import os from 'node:os';

import { env } from './config/envConfig.js';
import { logger } from './config/logger.js';
import { corsOptions } from './config/cors.js';
import sequelize from './config/dbConfig.js';
import './models/index.js';                       // register associations

import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Trust the first reverse proxy (nginx / Cloudflare / Render / Fly) so that
// rate-limiting + req.ip use the real client IP from X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

app.use('/api', routes);

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
  // In dev, auto-sync schema for convenience. In prod, REQUIRE migrations —
  // never let sequelize.sync() touch a real database.
  if (env.NODE_ENV !== 'production') {
    try {
      await sequelize.sync();
      logger.info('Database synced (dev mode)');
    } catch (err) {
      logger.error({ err }, 'sequelize.sync failed — continuing anyway');
    }
  } else {
    try {
      await sequelize.authenticate();
      logger.info('Database connection verified');
    } catch (err) {
      logger.fatal({ err }, 'Cannot connect to database — exiting');
      process.exit(1);
    }
  }

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${env.PORT}`);
    logLanUrls(env.PORT);
  });

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
