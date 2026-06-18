// ── API layer ──
// Page-facing helpers. The URL resolution + low-level fetch/headers/error/JSON
// boilerplate now lives in @/common/apiClient; this module keeps the
// domain-specific bits (auth 401-redirect, phone scoping, content double-parse).

import { API_BASE as API_URL, request, unwrap, handleUnauthorized } from "@/common/apiClient";
import { tokenStore } from "@/common/tokenStore";
import { noteBalance } from "@/common/creditsStore";
import { noteCosts } from "@/common/costsStore";

// Re-export under the original name so existing importers keep working.
export const API_BASE = API_URL;

// Session storage shared with the auth context (same localStorage keys).
const appToken = tokenStore("app_token");
const appAccount = tokenStore("app_account");

// Real OTP login — POSTs the Firebase ID token (from webOtp.confirmOtp) to
// /auth/verify-otp. Backend verifies it, upserts the AuthAccount, and returns
// our JWT + any saved birth details. → { token, account: { id, phone }, savedForm? }
export function verifyOtp(idToken) {
  return request("/auth/verify-otp", { method: "POST", body: { idToken } });
}

// Dev OTP bypass — POSTs a bare E.164 `phone` (no Firebase) to /auth/verify-otp.
// Used only when VITE_OTP_ENABLED='false'; the backend rejects this path unless
// its own OTP_ENABLED='false', so it's inert against production. Same response
// shape as verifyOtp. → { token, account: { id, phone }, savedForm? }
export function bypassLogin(phone) {
  return request("/auth/verify-otp", { method: "POST", body: { phone } });
}

// Current session + any saved birth form. Used to re-hydrate a returning user
// on app reload (token persists, but the client-side form does not).
// → { account: { id, phone }, savedForm? }
export function getMe() {
  return request("/auth/me");
}

// Pulls the logged-in phone from the AuthContext store and attaches
// it to any outgoing form payload so the backend can stamp it on the User
// row. Pure read — no side effects.
function attachPhone(form) {
  if (!form) return form;
  try {
    const acc = JSON.parse(appAccount.get() || "null");
    if (acc?.phone && !form.phone) return { ...form, phone: acc.phone };
  } catch {
    /* ignore */
  }
  return form;
}

// URLSearchParams shape for GET requests. Includes phone so the backend's
// User lookup is scoped per-account (two phones with identical birth data
// must resolve to different users).
function formParams(form) {
  const withPhone = attachPhone(form);
  const params = new URLSearchParams({
    name: withPhone.name,
    date: withPhone.date,
    time: withPhone.time,
    city: withPhone.city,
  });
  if (withPhone.gender) params.set("gender", withPhone.gender);
  if (withPhone.phone) params.set("phone", withPhone.phone);
  return params;
}

// Every authenticated request goes through here so the Bearer token is
// attached centrally. `request()` in apiClient handles the 401 -> /login redirect.
async function authFetch(url, init = {}) {
  const token = appToken.get();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) handleUnauthorized();
  return res;
}

// Register this browser's FCM token so cron/insight campaigns can reach it.
// authFetch attaches the Bearer JWT; backend stores it in PushTokens.
export async function registerWebPushToken(token) {
  const res = await authFetch(`${API_URL}/push/register`, {
    method: "POST",
    body: JSON.stringify({ token, platform: "web" }),
  });
  if (!res.ok) throw new Error(`web push register failed (HTTP ${res.status})`);
  return unwrap(await res.json());
}

// Trim the conversation to the last N turns before sending. The full
// transcript still lives in ChatContext (and on the backend, for topic
// recall) — this just keeps the per-turn prompt size bounded.
const CHAT_HISTORY_MAX = 30;
function trimChatHistory(messages) {
  if (!Array.isArray(messages) || messages.length <= CHAT_HISTORY_MAX) return messages;
  return messages.slice(-CHAT_HISTORY_MAX);
}

// Normalize an API `content` payload to a real object. The API now returns a
// parsed object; this stays tolerant of legacy (possibly double-encoded) JSON
// strings and plain text so old data / chat replies don't break.
export function parseContent(content) {
  if (content == null) return null;
  if (typeof content === "object") return content;
  let parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
}

// Low-level POST to the chat-completion endpoint.
export async function chatCompletion(messages, type = "chat", extraData = {}) {
  const form = attachPhone(extraData.form);
  let endpoint = `${API_URL}/chat`;
  let body = { messages: trimChatHistory(messages), factSheet: extraData.factSheet, form };

  if (type === "interpret") {
    endpoint = `${API_URL}/interpret`;
    body = { factSheet: extraData.factSheet, form };
  } else if (type === "daily") {
    endpoint = `${API_URL}/daily`;
    body = { ctx: extraData.ctx, form, targetDate: extraData.date };
  }

  const res = await authFetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = new Error(errBody.error || "AI service unavailable");
    if (errBody.code) err.code = errBody.code;
    throw err;
  }
  const data = unwrap(await res.json());
  noteBalance(data.balance); // refresh the credit badge after a charge
  // content is a real object (interpret/daily JSON) or a plain string (chat text).
  return typeof data.content === "string" ? data.content.trim() : data.content;
}

export async function chatCompletionJSON(messages, type, extraData) {
  const result = await chatCompletion(messages, type, extraData);
  return parseContent(result); // tolerant: object passthrough or parse legacy string
}

// GET previously saved data ('interpret' or 'daily') for a person, identified
// by their birth details. For 'daily', pass targetDate (YYYY-MM-DD) to fetch a
// specific day. Returns the parsed object, or null if none is saved.
export async function fetchSaved(type, form, targetDate) {
  const params = formParams(form);
  if (targetDate) params.set("targetDate", targetDate);
  const res = await authFetch(`${API_URL}/${type}?${params}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load saved data");
  const data = unwrap(await res.json());

  // Parse once; if the payload was double-encoded (a JSON string of a JSON
  // string) the first parse yields a string — parse again to reach the object.
  let parsed = parseContent(data.content);
  return parsed;
}

// Fetch the dates (YYYY-MM-DD) that already have saved daily guidance.
export async function fetchDailyDates(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return [];
  const params = formParams(form);
  try {
    const res = await authFetch(`${API_URL}/daily-dates?${params}`);
    if (!res.ok) return [];
    const data = unwrap(await res.json());
    return data.dates || [];
  } catch {
    return [];
  }
}

// Fetch list of past palm readings (lightweight — id, handType, createdAt).
export async function fetchPalmHistory(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return [];
  const params = formParams(form);
  try {
    const res = await authFetch(`${API_URL}/palm/history?${params}`);
    if (!res.ok) return [];
    const data = unwrap(await res.json());
    return data.readings || [];
  } catch {
    return [];
  }
}

// Fetch a specific past palm reading by id.
export async function fetchPalmById(id, form) {
  const params = formParams(form);
  const res = await authFetch(`${API_URL}/palm/${id}?${params}`);
  if (!res.ok) return null;
  const data = unwrap(await res.json());
  let parsed = parseContent(data.content);
  return parsed;
}

// Send a palm photo (base64 data URL or raw base64) for AI analysis.
// Returns the parsed palm reading object.
export async function analyzePalm(imageBase64, form, claimedHand, skipGate = true, landmarks = null) {
  const res = await authFetch(`${API_URL}/palm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // skipGate: web normally runs MediaPipe locally before upload, so the
    // backend can skip its own Flash gate. If the local gate hung/failed, we
    // pass skipGate:false so the backend gates instead (never blocks the read).
    // landmarks: the 21 MediaPipe points (when the gate ran) for the palm-geometry hint.
    body: JSON.stringify({ image: imageBase64, form: attachPhone(form), claimedHand, skipGate, landmarks }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const e = new Error(errBody.error || "Palm analysis failed");
    if (errBody.code) e.code = errBody.code;
    throw e;
  }
  const data = unwrap(await res.json());
  noteBalance(data.balance);
  let parsed = parseContent(data.content);
  return parsed;
}

// Send TWO palm photos (left + right) for the full-life comparison reading.
// Returns { left, right, comparison } — comparison is null if either hand
// came back as unusable (frontend should render the retake UI for that hand).
export async function comparePalms(
  leftBase64,
  rightBase64,
  form,
  leftLandmarks = null,
  rightLandmarks = null
) {
  const res = await authFetch(`${API_URL}/palm/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leftImage: leftBase64,
      rightImage: rightBase64,
      form: attachPhone(form),
      skipGate: true,
      leftLandmarks,
      rightLandmarks,
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const e = new Error(errBody.error || "Palm comparison failed");
    if (errBody.code) e.code = errBody.code;
    throw e;
  }
  const data = unwrap(await res.json());
  noteBalance(data.balance);
  let parsed = parseContent(data.content);
  return parsed;
}

// Current credit balance for the logged-in user — populates the credit badge.
// The user is resolved server-side from the auth token, so no form is needed.
// No-ops (returns null) without a token so it never bounces a logged-out
// visitor to /login.
export async function getCredits() {
  if (!appToken.get()) return null;
  try {
    const res = await authFetch(`${API_URL}/credits`);
    if (!res.ok) return null;
    const data = unwrap(await res.json());
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
  if (!appToken.get()) return [];
  try {
    const res = await authFetch(`${API_URL}/credits/plans`);
    if (!res.ok) return [];
    const data = unwrap(await res.json());
    return data.plans || [];
  } catch {
    return [];
  }
}

// Small helper to surface a backend error with its code attached.
async function throwApiError(res, fallback) {
  const errBody = await res.json().catch(() => ({}));
  const e = new Error(errBody.error || fallback);
  if (errBody.code) e.code = errBody.code;
  throw e;
}

// Open a credit-purchase order. Returns either:
//   { provider:'razorpay', orderId, credits, name, razorpay:{ keyId, orderId,
//     amount, currency } }  — caller opens Checkout, then calls verifyPayment()
//   { provider:'mock', paid:true, granted, balance, credits, orderId }
//     — already settled (dev / no keys); badge refreshed here.
export async function createCreditOrder(planId) {
  const res = await authFetch(`${API_URL}/credits/order`, {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) await throwApiError(res, "Could not start checkout");
  const data = unwrap(await res.json());
  if (data.provider === "mock") noteBalance(data.balance);
  return data;
}

// Verify a completed Razorpay payment server-side (signature check → grant).
// `payload` = { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }.
// → { granted, balance, credits, status }. Refreshes the badge.
export async function verifyCreditPayment(payload) {
  const res = await authFetch(`${API_URL}/credits/verify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) await throwApiError(res, "Payment verification failed");
  const data = unwrap(await res.json());
  noteBalance(data.balance);
  return data;
}

// Fetch the saved chat history for a person. Returns an array of
// { role, content } messages, or an empty array if none / on error.
// Google Places autocomplete via our backend proxy. `token` is the Places
// sessiontoken — passing the SAME token to searchCities + getCityDetails
// makes autocomplete free. Generate one per "search session" client-side.
export async function searchCities(query, token) {
  if (!query || query.trim().length < 2) return [];
  const params = new URLSearchParams({ q: query, token });
  const res = await fetch(`${API_URL}/locations/search?${params}`);
  if (!res.ok) return [];
  const data = unwrap(await res.json());
  return data.results || [];
}

// Resolve a Place ID to {coordinates, timezone, ...}. `birthTimestamp` is
// seconds since epoch — sent so Google's Time Zone API returns the
// DST-aware offset AT the user's birth moment.
export function getCityDetails(placeId, token, birthTimestamp) {
  const params = new URLSearchParams({ placeId, token });
  if (birthTimestamp) params.set("ts", String(birthTimestamp));
  // `token` here is the Google Places sessiontoken (a query param), NOT an auth
  // bearer — so it's passed in the path, not as request()'s token option.
  return request(`/locations/details?${params}`);
}

// Reverse geocode lat/lon to { name, lat, lon, timezone }.
// Returns a coordinates-derived timezone which is more accurate for
// astrological charts than the browser's system timezone.
export function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({ lat, lon });
  return request(`/locations/reverse?${params}`);
}

// Persist birth details onto the logged-in user's row the moment they're
// entered — before any reading is generated, no credits charged. Best-effort:
// a failure must never block the user from proceeding to their reading.
export async function saveProfile(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return false;
  try {
    const res = await authFetch(`${API_URL}/profile`, {
      method: "POST",
      body: JSON.stringify({ form: attachPhone(form) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchChatHistory(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return [];
  const params = formParams(form);
  try {
    const res = await authFetch(`${API_URL}/chat?${params}`);
    if (!res.ok) return [];
    const data = unwrap(await res.json());
    return data.messages || [];
  } catch {
    return [];
  }
}
