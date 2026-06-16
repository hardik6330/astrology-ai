// Back-office admin auth. Admins log in with username + password (seeded from
// env on boot — see adminSeed.js), and receive a role-tagged session JWT.

import { Op } from 'sequelize';
import {
  Admin, User, Kundali, PalmReading, ChatMessage, PushToken, Purchase, CreditPlan,
} from '../models/index.js';
import { verifyPassword } from '../utils/password.js';
import { signAdminToken } from '../middleware/auth.js';
import { sendToTokens } from './notificationService.js';
import { sendCustomToPhone } from './pushService.js';
import * as settings from './settingsService.js';
import * as purchase from './purchaseService.js';
import { AppError } from '../errors/AppError.js';

export async function loginAdmin(username, password) {
  const admin = await Admin.findOne({ where: { username } });
  // Same generic 401 whether the username is unknown or the password is wrong,
  // so we don't leak which usernames exist. verifyPassword on a missing row
  // would throw, so guard first.
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    throw AppError.http(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
  }
  const token = signAdminToken({ adminId: admin.id, username: admin.username });
  return { token, admin: { id: admin.id, name: admin.name, username: admin.username } };
}

// Full admin profile for /admin/me-style display. The JWT only carries id +
// username; this hydrates name too. Never returns the password hash.
export async function getAdmin(adminId) {
  const admin = await Admin.findByPk(adminId, { attributes: ['id', 'name', 'username', 'createdAt'] });
  if (!admin) throw AppError.http(404, 'Admin not found', 'NOT_FOUND');
  return admin;
}

// Dashboard headline counts + revenue. Revenue counts PAID orders only;
// priceInr is the paise snapshot taken at order time, so later plan edits
// never rewrite history. `updatedAt` stands in for the settlement instant
// (the status flip to 'paid' is the row's last write).
export async function getStats() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const paid = { status: 'paid' };
  const [users, kundalis, palmReadings, chatMessages, pushTokens,
    revenuePaise, monthPaise, paidOrders, payingUsers] = await Promise.all([
    User.count(),
    Kundali.count(),
    PalmReading.count(),
    ChatMessage.count(),
    PushToken.count({ where: { enabled: true } }),
    Purchase.sum('priceInr', { where: paid }),
    Purchase.sum('priceInr', { where: { ...paid, updatedAt: { [Op.gte]: monthStart } } }),
    Purchase.count({ where: paid }),
    Purchase.count({ where: paid, distinct: true, col: 'userId' }),
  ]);
  return {
    users, kundalis, palmReadings, chatMessages, pushTokens,
    revenue: {
      totalPaise: revenuePaise || 0,
      monthPaise: monthPaise || 0,
      paidOrders,
      payingUsers,
    },
  };
}

// Wrap a findAndCountAll result in a consistent paginated envelope: `rows` plus
// a `pagination` block with 1-based page, page size, totals and has-next/prev
// (total record count lives in pagination.total). When `fetchAll` is set the
// query ran unpaginated, so it's a single page covering every row.
function paginated(rows, count, pageSize, offset, fetchAll = false) {
  const page = fetchAll ? 1 : Math.floor(offset / pageSize) + 1;
  const totalPages = fetchAll ? 1 : Math.max(1, Math.ceil(count / pageSize));
  return {
    rows,
    pagination: {
      page,
      pageSize: fetchAll ? count : pageSize,
      total: count,
      totalPages,
      hasPrev: !fetchAll && page > 1,
      hasNext: !fetchAll && page < totalPages,
      fetchAll,
    },
  };
}

// Paginated user list with an optional name/phone/city search.
export async function listUsers({ limit = 25, offset = 0, search = '', fetchAll = false } = {}) {
  const where = {};
  if (search) {
    const like = { [Op.like]: `%${search}%` };
    where[Op.or] = [{ name: like }, { phone: like }, { birthCity: like }];
  }
  const pageSize = Math.min(Number(limit) || 25, 100);
  const off = Number(offset) || 0;
  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: ['id', 'name', 'phone', 'gender', 'birthDate', 'birthCity', 'createdAt'],
    order: [['createdAt', 'DESC']],
    // fetchAll bypasses pagination — return every matching row.
    ...(fetchAll ? {} : { limit: pageSize, offset: off }),
  });
  return paginated(rows, count, pageSize, off, fetchAll);
}

// Order list: one row per Purchase (all statuses — paid, created, failed —
// each row carries its status), newest first, with the buyer + plan joined in.
// Optional name/phone search; paginated like listUsers.
export async function listOrders({ limit = 25, offset = 0, search = '', fetchAll = false } = {}) {
  // NB: Op.or is a Symbol key — Object.keys() can't see it, so gate on
  // `search` itself, not on the object's (always-empty) string keys.
  const like = { [Op.like]: `%${search}%` };
  const pageSize = Math.min(Number(limit) || 25, 100);
  const off = Number(offset) || 0;
  const { rows, count } = await Purchase.findAndCountAll({
    attributes: ['id', 'credits', 'priceInr', 'status', 'provider', 'createdAt', 'updatedAt'],
    include: [
      {
        model: User,
        attributes: ['id', 'name', 'phone'],
        where: search ? { [Op.or]: [{ name: like }, { phone: like }] } : undefined,
        required: true,
      },
      // Plan may be soft-disabled but never hard-deleted, so the name resolves
      // for historical orders too. LEFT JOIN just in case.
      { model: CreditPlan, attributes: ['name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    // fetchAll bypasses pagination — return every matching row.
    ...(fetchAll ? {} : { limit: pageSize, offset: off }),
  });

  const mapped = rows.map((p) => ({
    id: p.id,
    userId: p.User?.id,
    name: p.User?.name || '—',
    phone: p.User?.phone || null,
    plan: p.CreditPlan?.name || '—',
    credits: p.credits,
    pricePaise: p.priceInr,
    status: p.status,
    provider: p.provider,
    createdAt: p.createdAt,
  }));
  return paginated(mapped, count, pageSize, off, fetchAll);
}

// Broadcast a custom push to every enabled device. Returns the FCM fan-out
// summary ({ sent, failed, disabled }) so the admin sees delivery results.
export async function broadcastPush({ title, body }) {
  const rows = await PushToken.findAll({ where: { enabled: true }, attributes: ['id', 'token'] });
  return sendToTokens(rows, { title, body, data: { type: 'broadcast' } });
}

// Push a custom notification to one user's devices. The user is matched to
// their push tokens by phone (User↔AuthAccount bridge). 404s if the user is
// gone; a user with no phone / no enabled device just yields a 0-sent summary.
export async function pushToUser({ userId, title, body }) {
  const user = await User.findByPk(userId, { attributes: ['id', 'name', 'phone'] });
  if (!user) throw AppError.http(404, 'User not found', 'NOT_FOUND');
  if (!user.phone) throw AppError.http(409, 'User has no phone on record', 'NO_PHONE');
  return sendCustomToPhone(user.phone, { title, body });
}

// ── System settings (credits + feature costs) ───────────────────────────────

export function listSettings() {
  return settings.getAll();
}

export function saveSettings(updates) {
  return settings.updateMany(updates);
}

// ── Credit plans ─────────────────────────────────────────────────────────────

export function listPlans() {
  return purchase.listAllPlans();
}

export function createPlan(data) {
  return purchase.createPlan(data);
}

export function updatePlan(id, data) {
  return purchase.updatePlan(id, data);
}
