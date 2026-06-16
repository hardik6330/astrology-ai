import * as adminSvc from '../services/adminService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const result = await adminSvc.loginAdmin(req.body.username, req.body.password);
  res.json(result);
});

// req.admin is set by requireAdmin after verifying the admin JWT. We hydrate
// the full row (name + createdAt) rather than echoing the bare token payload.
export const me = asyncHandler(async (req, res) => {
  const admin = await adminSvc.getAdmin(req.admin.adminId);
  res.json({ admin });
});

export const stats = asyncHandler(async (_req, res) => {
  res.json(await adminSvc.getStats());
});

export const users = asyncHandler(async (req, res) => {
  const { limit, offset, search, all } = req.query;
  res.json(await adminSvc.listUsers({ limit, offset, search, fetchAll: all === 'true' }));
});

// Order history — one row per Purchase, buyer + plan joined in.
export const orders = asyncHandler(async (req, res) => {
  const { limit, offset, search, all } = req.query;
  res.json(await adminSvc.listOrders({ limit, offset, search, fetchAll: all === 'true' }));
});

export const broadcast = asyncHandler(async (req, res) => {
  res.json(await adminSvc.broadcastPush(req.body));
});

export const pushUser = asyncHandler(async (req, res) => {
  const { title, body } = req.body;
  res.json(await adminSvc.pushToUser({ userId: req.params.id, title, body }));
});

export const settings = asyncHandler(async (_req, res) => {
  res.json({ settings: await adminSvc.listSettings() });
});

export const saveSettings = asyncHandler(async (req, res) => {
  res.json({ settings: await adminSvc.saveSettings(req.body.settings) });
});

// ── Credit plans (back-office CRUD) ──
export const plans = asyncHandler(async (_req, res) => {
  res.json({ plans: await adminSvc.listPlans() });
});

export const createPlan = asyncHandler(async (req, res) => {
  res.json({ plan: await adminSvc.createPlan(req.body) });
});

export const updatePlan = asyncHandler(async (req, res) => {
  res.json({ plan: await adminSvc.updatePlan(req.params.id, req.body) });
});
