// Builds the configured Express app WITHOUT binding a port, so the exact same
// app can be driven three ways: server.js (listen), a serverless handler
// (Vercel), and tests (supertest). No DB connection or seeding happens here —
// those are run-time concerns owned by server.js.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { corsOptions } from './config/cors.js';
import './models/index.js'; // register Sequelize associations (idempotent)
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { responseWrapper } from './middleware/responseWrapper.js';

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

// Default instance for serverless handlers and tests.
export default createApp();
