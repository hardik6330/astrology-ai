// Admin API layer — talks to the back-office /admin/* endpoints. Built on the
// shared request() client (URL/headers/error/JSON live in @/common/apiClient);
// here we just add the admin bearer token and name the endpoints.

import { request } from "@/common/apiClient";
import { tokenStore } from "@/common/tokenStore";

// Shared store for the admin bearer token (also used by AdminAuthContext).
export const adminToken = tokenStore("admin_token");

// Authed admin request — attaches the stored admin token to every call.
function adminFetch(path, opts = {}) {
  return request(path, { ...opts, token: adminToken.get() });
}

// POST /admin/login → { token, admin: { id, name, username } }. Public (no token).
export function adminLogin(username, password) {
  return request("/admin/login", { method: "POST", body: { username, password } });
}

// GET /admin/me — validates the stored token; throws on 401/403.
export function adminMe() {
  return adminFetch("/admin/me");
}

// GET /admin/stats → { users, kundalis, palmReadings, chatMessages, pushTokens }.
export function adminStats() {
  return adminFetch("/admin/stats");
}

// GET /admin/users → { rows, count }. Supports paging + search.
export function adminUsers({ limit = 25, offset = 0, search = "" } = {}) {
  const qs = new URLSearchParams({ limit, offset });
  if (search) qs.set("search", search);
  return adminFetch(`/admin/users?${qs}`);
}

// POST /admin/push/broadcast → FCM fan-out summary.
export function adminBroadcast(title, body) {
  return adminFetch("/admin/push/broadcast", { method: "POST", body: { title, body } });
}

// POST /admin/users/:id/push → send a custom notification to one user's devices.
export function adminPushUser(userId, title, body) {
  return adminFetch(`/admin/users/${userId}/push`, { method: "POST", body: { title, body } });
}

// GET /admin/settings → { settings: [{ key, value, description }] }.
export function adminGetSettings() {
  return adminFetch("/admin/settings");
}

// POST /admin/settings → persists [{ key, value }] and returns the fresh list.
export function adminSaveSettings(settings) {
  return adminFetch("/admin/settings", { method: "POST", body: { settings } });
}

// ── Credit plans ──
// GET /admin/plans → { plans: [...] } (incl. disabled). priceInr is in paise.
export function adminGetPlans() {
  return adminFetch("/admin/plans");
}

// POST /admin/plans → creates a plan, returns { plan }.
export function adminCreatePlan(plan) {
  return adminFetch("/admin/plans", { method: "POST", body: plan });
}

// PUT /admin/plans/:id → patches a plan (partial), returns { plan }.
export function adminUpdatePlan(id, patch) {
  return adminFetch(`/admin/plans/${id}`, { method: "PUT", body: patch });
}
