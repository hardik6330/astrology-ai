import os from 'node:os';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import 'mysql2';
import { env } from './envConfig.js';

// Tests run on SQLite so service-level tests (credits, purchases, engage CAS)
// exercise the real Sequelize queries without a MySQL server. FILE-backed (not
// :memory:) on purpose: sequelize's sqlite manager shares ONE connection for
// :memory: — concurrent/nested transactions would hit "cannot start a
// transaction within a transaction" — while file storage gets a connection per
// transaction, matching MySQL semantics. Per-PID path isolates vitest workers.
const sequelize =
  env.NODE_ENV === 'test'
    ? new Sequelize({
        dialect: 'sqlite',
        storage: path.join(os.tmpdir(), `astrology-ai-test-${process.pid}.sqlite`),
        logging: false,
      })
    : new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
        host: env.DB_HOST,
        port: env.DB_PORT,
        dialect: 'mysql',
        logging: false,
        // Connection pool. VERCEL=1 is injected by Vercel only — on a private
        // always-on server it's unset, so this auto-switches with NO code
        // change: a small per-λ pool on serverless (many concurrent λ would
        // otherwise blow past MySQL's max_connections), a larger pool on a
        // single long-lived process. Override via DB_POOL_MAX/MIN.
        pool: {
          max: env.DB_POOL_MAX ?? (process.env.VERCEL === '1' ? 2 : 10),
          min: env.DB_POOL_MIN ?? 0,
          idle: 10_000,    // drop idle conns so λ don't pin them / quiet servers shed them
          acquire: 30_000, // fail fast instead of hanging a request when saturated
          evict: 1_000,
        },
      });

export default sequelize;
