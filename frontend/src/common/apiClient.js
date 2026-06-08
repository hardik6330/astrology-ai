// Shared low-level HTTP client. Resolves the API base once and exposes a single
// request() that builds the URL + headers, attaches a bearer token, parses the
// JSON body, and throws a rich Error (with .status and backend .code) on
// failure. Both the user-facing services/api.js and the admin adminApi.js
// build on this so the fetch/headers/error/JSON boilerplate lives in one place.

import { tokenStore } from "./tokenStore";

// API URL resolution:
// 1. VITE_API_URL set to a non-localhost value (real ngrok/prod) → use as-is.
// 2. Otherwise derive from the page hostname + port 5000, so opening the app on
//    http://192.168.x.x:5173 from a phone targets the dev backend automatically.
const RAW_API_URL = import.meta.env.VITE_API_URL || "";
const isLocalDefault = !RAW_API_URL || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(RAW_API_URL);

export const API_BASE =
  isLocalDefault && typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000/api`
    : RAW_API_URL || "http://localhost:5000/api";

// The backend wraps every success response as { success, message, data }.
// Unwrap to the inner `data` so callers see the same payload as before. Bodies
// without the envelope (legacy / non-/api endpoints) pass through untouched.
export function unwrap(body) {
  return body && body.success === true && "data" in body ? body.data : body;
}

/**
 * Shared 401 handler — clears the token and bounces to /login.
 */
export function handleUnauthorized() {
  tokenStore("app_token").remove();
  tokenStore("app_account").remove();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
}

/**
 * Make a JSON request and return the parsed body (unwrapped from the envelope).
 * @param {string} path  e.g. "/admin/login" (appended to base) or a full URL
 * @param {{method?, body?, token?, headers?, base?}} opts
 * @returns the response `data` on 2xx
 * @throws Error with `.status` (HTTP code) and `.code` (backend error code)
 */
export async function request(path, { method = "GET", body, token, headers = {}, base = API_BASE } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h["Content-Type"] = "application/json";

  const res = await fetch(`${base}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // On 401 Unauthorized (expired or invalid token) we clear the stored
    // credentials and bounce to /login.
    if (res.status === 401) {
      handleUnauthorized();
    }

    const err = new Error(data.error || `Request failed (HTTP ${res.status})`);
    err.status = res.status;
    if (data.code) err.code = data.code;
    throw err;
  }
  return unwrap(data);
}
