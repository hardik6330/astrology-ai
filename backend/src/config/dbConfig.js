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
      });

export default sequelize;
