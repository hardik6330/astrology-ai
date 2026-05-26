import { Sequelize } from 'sequelize';
import 'mysql2';
import { env } from './envConfig.js';

const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'mysql',
  logging: false,
});

export default sequelize;
