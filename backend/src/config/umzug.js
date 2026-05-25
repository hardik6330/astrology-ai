import { Umzug, SequelizeStorage } from 'umzug';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sequelize from './dbConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../migrations');

// Umzug runs *.js files in migrations/ alphabetically. Each migration file
// exports { up({ context }), down({ context }) } where context is the
// Sequelize QueryInterface. Past runs are tracked in the SequelizeMeta table.
export const umzug = new Umzug({
  migrations: {
    glob: ['*.js', { cwd: migrationsDir }],
    resolve: ({ name, path: filepath, context }) => {
      return {
        name,
        up:   async () => (await import(filepath)).up({ context }),
        down: async () => (await import(filepath)).down({ context }),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

