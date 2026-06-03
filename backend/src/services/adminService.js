// Back-office admin auth. Admins log in with username + password (seeded from
// env on boot — see adminSeed.js), and receive a role-tagged session JWT.

import { Op } from 'sequelize';
import {
  Admin, User, Kundali, PalmReading, ChatMessage, PushToken,
} from '../models/index.js';
import { verifyPassword } from '../utils/password.js';
import { signAdminToken } from '../middleware/auth.js';
import { sendToTokens } from './notificationService.js';
import { httpError } from '../middleware/errorHandler.js';

export async function loginAdmin(username, password) {
  const admin = await Admin.findOne({ where: { username } });
  // Same generic 401 whether the username is unknown or the password is wrong,
  // so we don't leak which usernames exist. verifyPassword on a missing row
  // would throw, so guard first.
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    throw httpError(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
  }
  const token = signAdminToken({ adminId: admin.id, username: admin.username });
  return { token, admin: { id: admin.id, name: admin.name, username: admin.username } };
}

// Full admin profile for /admin/me-style display. The JWT only carries id +
// username; this hydrates name too. Never returns the password hash.
export async function getAdmin(adminId) {
  const admin = await Admin.findByPk(adminId, { attributes: ['id', 'name', 'username', 'createdAt'] });
  if (!admin) throw httpError(404, 'Admin not found', 'NOT_FOUND');
  return admin;
}

// Dashboard headline counts.
export async function getStats() {
  const [users, kundalis, palmReadings, chatMessages, pushTokens] = await Promise.all([
    User.count(),
    Kundali.count(),
    PalmReading.count(),
    ChatMessage.count(),
    PushToken.count({ where: { enabled: true } }),
  ]);
  return { users, kundalis, palmReadings, chatMessages, pushTokens };
}

// Paginated user list with an optional name/phone/city search.
export async function listUsers({ limit = 25, offset = 0, search = '' } = {}) {
  const where = {};
  if (search) {
    const like = { [Op.like]: `%${search}%` };
    where[Op.or] = [{ name: like }, { phone: like }, { birthCity: like }];
  }
  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: ['id', 'name', 'phone', 'gender', 'birthDate', 'birthCity', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(limit) || 25, 100),
    offset: Number(offset) || 0,
  });
  return { rows, count };
}

// Broadcast a custom push to every enabled device. Returns the FCM fan-out
// summary ({ sent, failed, disabled }) so the admin sees delivery results.
export async function broadcastPush({ title, body }) {
  const rows = await PushToken.findAll({ where: { enabled: true }, attributes: ['id', 'token'] });
  return sendToTokens(rows, { title, body, data: { type: 'broadcast' } });
}
