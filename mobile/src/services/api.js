// API layer — mirrors frontend/src/services/api.js but resolves the backend
// URL using Expo Constants instead of window.location.
//
// URL resolution priority:
// 1. EXPO_PUBLIC_API_URL (set in .env or EAS secret) — used in prod/staging builds.
// 2. Derived from the Expo dev server's host IP — so running on a physical
//    phone via Expo Go automatically hits the dev machine's backend on :5000.
// 3. Fallback to http://localhost:5000/api (simulator only).

import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { noteBalance } from "./creditsStore";
import { noteCosts } from "./costsStore";

// Phone is cached after the dummy OTP login and attached to every form
// payload so the backend can stamp it on the User row. Kept in a module ref
// to avoid an AsyncStorage round-trip on every API call.
let _phone = null;
AsyncStorage.getItem("app_account").then((s) => {
  try { _phone = s ? JSON.parse(s).phone || null : null; } catch { /* ignore */ }
});
export function primeAuthPhone(phone) { _phone = phone || null; }
function attachPhone(form) {
  if (!form || form.phone || !_phone) return form;
  return { ...form, phone: _phone };
}

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || "";

function deriveDevUrl() {
  // In Expo dev, `hostUri` looks like "192.168.1.42:8081".
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    "";
  const host = hostUri.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:5000/api`;
  }
  return "http://localhost:5000/api";
}

export const API_URL =
  ENV_URL && ENV_URL.startsWith("http")
    ? ENV_URL
    : deriveDevUrl();

// 401 Unauthorized observer. AuthContext registers a listener here so we can
// trigger a global logout from deep inside the API layer.
let unauthorizedHandler = null;
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

// Fetch wrapper: adds a per-request timeout, one automatic retry for
// "Network request failed" (Vercel cold start, DNS hiccup, momentary
// loss of Wi-Fi), and surfaces the actual URL + cause in the thrown error.
async function fetchWithRetry(url, options = {}, { timeoutMs = 30000, retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === "AbortError";
      const isNetwork = /network request failed|network error/i.test(err.message || "");
      // Retry once for transient network errors / timeouts (cold start)
      if (attempt < retries && (isTimeout || isNetwork)) {
        // small back-off so the server has a moment to wake up
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const reason = isTimeout ? `timeout after ${timeoutMs}ms` : err.message;
      const wrapped = new Error(`fetch failed (${reason}) → ${url}`);
      wrapped.cause = err;
      wrapped.url = url;
      throw wrapped;
    }
  }
}

// Bearer header for the session JWT (or {} when not logged in). The AI/credit
// routes require it — read straight from AsyncStorage so callers don't thread
// the token through.
async function authHeaders() {
  const token = await AsyncStorage.getItem("app_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// The backend wraps every success response as { success, message, data }.
// Unwrap to the inner `data` so callers see the same payload as before.
// Bodies without the envelope pass through untouched.
function unwrap(body) {
  return body && body.success === true && "data" in body ? body.data : body;
}

async function postJSON(endpoint, body) {
  const url = `${API_URL}${endpoint}`;
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (res.status === 401 && unauthorizedHandler) {
    unauthorizedHandler();
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = new Error(errBody.error || `AI service unavailable (HTTP ${res.status})`);
    if (errBody.code) err.code = errBody.code;
    err.status = res.status;
    err.url = url;
    throw err;
  }
  return unwrap(await res.json());
}

async function getJSON(endpoint, params) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const url = `${API_URL}${endpoint}${qs}`;
  const res = await fetchWithRetry(url, { headers: { ...(await authHeaders()) } });
  if (res.status === 401 && unauthorizedHandler) {
    unauthorizedHandler();
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(`Failed to load (HTTP ${res.status}) → ${url}`);
    err.status = res.status;
    err.url = url;
    throw err;
  }
  return unwrap(await res.json());
}

function formParams(form) {
  const p = {
    name: form.name, date: form.date, time: form.time, city: form.city,
  };
  if (form.gender) p.gender = form.gender;
  // Phone is part of the User identity key — without it, the backend
  // would match a different user with the same birth data.
  const phone = form.phone || _phone;
  if (phone) p.phone = phone;
  return p;
}

function parseContent(content) {
  let parsed = JSON.parse((content || "").replace(/```json|```/g, "").trim());
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
}

// Startup config from the backend.
// → { latestVersion, forceUpdate, updateUrl } — drive the force-update gate.
// (Auth mode is decided client-side via EXPO_PUBLIC_OTP_SERVICE, not here.)
// Fails OPEN: on any error we return safe defaults (no force-update) so a
// flaky network never locks the user out of the app.
export async function getAuthConfig() {
  const fallback = { latestVersion: null, forceUpdate: false, updateUrl: "" };
  try {
    const data = await getJSON("/auth/config");
    return { ...fallback, ...(data || {}) };
  } catch {
    return fallback;
  }
}

// Real OTP login: send the verified Firebase ID token (from otp.confirmOtp),
// get back our JWT + AuthAccount row + any saved birth details.
export async function verifyOtp(idToken) {
  const url = `${API_URL}/auth/verify-otp`;
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  }, { timeoutMs: 20000, retries: 1 });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Login failed (HTTP ${res.status})`);
  }
  return unwrap(await res.json()); // { token, account: { id, phone }, savedForm? }
}

// Dummy login (used when EXPO_PUBLIC_OTP_SERVICE is OFF) — trades a bare phone
// for our JWT, no SMS. → { token, account: { id, phone }, savedForm? }
export async function dummyLogin(phone) {
  const url = `${API_URL}/auth/dummy-login`;
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  }, { timeoutMs: 20000, retries: 1 });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Login failed (HTTP ${res.status})`);
  }
  return unwrap(await res.json());
}

// ── Push tokens ──
// Both endpoints require the session JWT (requireAuth on the backend); the
// shared authHeaders() helper above attaches it.

// Send this device's FCM token to the backend so cron campaigns can reach it.
export async function registerPushToken(fcmToken, platform) {
  const res = await fetchWithRetry(`${API_URL}/push/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ token: fcmToken, platform }),
  });
  if (!res.ok) throw new Error(`push register failed (HTTP ${res.status})`);
  return unwrap(await res.json());
}

// Soft-disable this device's token on logout so the user stops getting pushes.
export async function unregisterPushToken(fcmToken) {
  await fetchWithRetry(`${API_URL}/push/unregister`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ token: fcmToken }),
  }).catch(() => { /* best-effort — logout shouldn't block on this */ });
}

// Fire-and-forget ping to wake the serverless backend on app start.
// Hits "/" (the root route returns "Server is running") so the cold start
// finishes before the user submits their first real request.
export function warmupBackend() {
  // Strip "/api" suffix since the warm-up route is at the root
  const base = API_URL.replace(/\/api\/?$/, "");
  fetch(`${base}/`).catch(() => { /* ignore — best-effort warm-up */ });
}

// Trim the conversation to the last N turns before sending. The full
// transcript still lives in ChatContext + on the backend; this just keeps
// per-turn prompt size bounded.
const CHAT_HISTORY_MAX = 30;
function trimChatHistory(messages) {
  if (!Array.isArray(messages) || messages.length <= CHAT_HISTORY_MAX) return messages;
  return messages.slice(-CHAT_HISTORY_MAX);
}

export async function chatCompletion(messages, type = "chat", extra = {}) {
  const form = attachPhone(extra.form);
  let endpoint = "/chat";
  let body = { messages: trimChatHistory(messages), factSheet: extra.factSheet, form };
  if (type === "interpret") {
    endpoint = "/interpret";
    body = { factSheet: extra.factSheet, form };
  } else if (type === "daily") {
    endpoint = "/daily";
    body = { ctx: extra.ctx, form, targetDate: extra.date };
  }
  const data = await postJSON(endpoint, body);
  noteBalance(data.balance); // refresh the credit badge after a charge
  return (data.content || "").trim();
}

// Current credit balance for the logged-in user — populates the credit badge.
// The user is resolved server-side from the auth token, so no form is needed.
// No-ops (returns null) without a token so it never bounces a logged-out user.
export async function getCredits() {
  const token = await AsyncStorage.getItem("app_token");
  if (!token) return null;
  try {
    const data = await getJSON("/credits");
    if (!data) return null;
    noteBalance(data.credits);
    noteCosts(data.costs);
    return data.credits;
  } catch {
    return null;
  }
}

// List the purchasable credit packages. → [{ id, name, credits, priceInr, bonusLabel }]
// priceInr is in paise. Returns [] without a token / on error.
export async function fetchCreditPlans() {
  const token = await AsyncStorage.getItem("app_token");
  if (!token) return [];
  try {
    const data = await getJSON("/credits/plans");
    return data?.plans || [];
  } catch {
    return [];
  }
}

// Buy a credit plan (mock checkout — no real payment yet). On success the
// backend grants the credits; noteBalance refreshes the badge from the returned
// balance. → { granted, balance, credits, orderId }. Throws on failure.
export async function purchasePlan(planId) {
  const data = await postJSON("/credits/purchase", { planId });
  noteBalance(data.balance);
  return data;
}

// Verify a Mobile In-App Purchase (Apple/Google).
// receipt is for iOS, purchaseToken is for Android.
export async function verifyIapPayment({ planId, platform, receipt, purchaseToken }) {
  const data = await postJSON("/credits/verify-iap", {
    planId, platform, receipt, purchaseToken,
  });
  noteBalance(data.balance);
  return data;
}

export async function chatCompletionJSON(messages, type, extra) {
  const txt = await chatCompletion(messages, type, extra);
  return JSON.parse(txt.replace(/```json|```/g, "").trim());
}

export async function fetchSaved(type, form, targetDate) {
  const params = formParams(form);
  if (targetDate) params.targetDate = targetDate;
  const data = await getJSON(`/${type}`, params);
  if (!data) return null;
  return parseContent(data.content);
}

export async function fetchDailyDates(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return [];
  try {
    const data = await getJSON("/daily-dates", formParams(form));
    return data?.dates || [];
  } catch {
    return [];
  }
}

export async function fetchPalmHistory(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return [];
  try {
    const data = await getJSON("/palm/history", formParams(form));
    return data?.readings || [];
  } catch {
    return [];
  }
}

export async function fetchPalmById(id, form) {
  const data = await getJSON(`/palm/${id}`, formParams(form));
  if (!data) return null;
  return parseContent(data.content);
}

export async function analyzePalm(imageBase64, form, claimedHand) {
  const data = await postJSON("/palm", {
    image: imageBase64,
    form: attachPhone(form),
    claimedHand,
    skipGate: true // mobile now uses local TFJS gate, skip backend Flash gate
  });
  noteBalance(data.balance);
  return parseContent(data.content);
}

// Both-Hands comparison. Returns { left, right, comparison } — comparison
// is null if either hand came back unusable (frontend renders retake UI).
export async function comparePalms(leftBase64, rightBase64, form) {
  const data = await postJSON("/palm/compare", {
    leftImage: leftBase64,
    rightImage: rightBase64,
    form: attachPhone(form),
    skipGate: true // mobile now uses local TFJS gate, skip backend Flash gate
  });
  noteBalance(data.balance);
  return parseContent(data.content);
}

// Google Places autocomplete via our backend proxy. `token` is the Places
// sessiontoken — pass the SAME one to searchCities + getCityDetails so
// autocomplete is free.
export async function searchCities(query, token) {
  if (!query || query.trim().length < 2) return [];
  try {
    const data = await getJSON("/locations/search", { q: query, token });
    return data?.results || [];
  } catch {
    return [];
  }
}

export async function getCityDetails(placeId, token, birthTimestamp) {
  const params = { placeId, token };
  if (birthTimestamp) params.ts = String(birthTimestamp);
  const data = await getJSON("/locations/details", params);
  if (!data) throw new Error("Location lookup failed");
  return data;
}

export async function fetchChatHistory(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return [];
  try {
    const data = await getJSON("/chat", formParams(form));
    return data?.messages || [];
  } catch {
    return [];
  }
}

// Persist birth details onto the logged-in user's row the moment they're
// entered — before any reading is generated, no credits charged. Best-effort:
// a failure must never block the user from proceeding to their reading.
export async function saveProfile(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return false;
  try {
    await postJSON("/profile", { form: attachPhone(form) });
    return true;
  } catch {
    return false;
  }
}
