import { Admin } from '../models/index.js';
import { hashPassword } from '../utils/password.js';
import { env } from '../config/envConfig.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'admin-seed' });

// One-time bootstrap of the default admin from env. Idempotent: if ANY admin
// already exists, this is a no-op — we never overwrite an existing account or
// reset its password on reboot. Best-effort; a failure must not block startup.
export async function seedAdmin() {
  const existing = await Admin.findOne({ attributes: ['id'] });
  if (existing) {
    log.info('admin already present — seed skipped');
    return;
  }
  await Admin.create({
    name: env.ADMIN_NAME,
    username: env.ADMIN_USERNAME,
    passwordHash: hashPassword(env.ADMIN_PASSWORD),
  });
  log.info({ username: env.ADMIN_USERNAME }, 'default admin seeded');
}
