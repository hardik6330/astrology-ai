// ── API layer ──
// Single place that talks to the chat endpoint. Pages call these helpers
// instead of hand-rolling fetch + headers + JSON parsing each time.

// API URL resolution priority:
// 1. If VITE_API_URL is set to a NON-localhost value (e.g. a real ngrok/prod URL), use it as-is.
// 2. Otherwise derive it from the page's hostname + port 5000 — so opening the
//    frontend on http://192.168.x.x:5173 from a phone automatically targets
//    the dev machine's backend at http://192.168.x.x:5000/api. No env edits needed.
const RAW_API_URL = import.meta.env.VITE_API_URL || "";
const isLocalDefault = !RAW_API_URL || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(RAW_API_URL);
const API_URL =
  isLocalDefault && typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000/api`
    : RAW_API_URL || "http://localhost:5000/api";

export const API_BASE = API_URL;

// Dummy login — POSTs the phone to /auth/dummy-login. Backend findOrCreates
// the AuthAccount and, when it recognises an existing user, returns their
// saved birth details so we can skip the home form.
export async function dummyLogin(phone) {
  const res = await fetch(`${API_URL}/auth/dummy-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Login failed (HTTP ${res.status})`);
  }
  return res.json(); // { token, account: { id, phone }, savedForm? }
}

// Pulls the logged-in phone from the dummy AuthContext store and attaches
// it to any outgoing form payload so the backend can stamp it on the User
// row. Pure read — no side effects.
function attachPhone(form) {
  if (!form) return form;
  try {
    const acc = JSON.parse(localStorage.getItem("app_account") || "null");
    if (acc?.phone && !form.phone) return { ...form, phone: acc.phone };
  } catch {
    /* ignore */
  }
  return form;
}

// Every authenticated request goes through here so the Bearer token is
// attached centrally. On 401 we clear the token and reload — the router
// will then bounce the user to /login.
export async function authFetch(url, init = {}) {
  const token = localStorage.getItem("app_token");
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    localStorage.removeItem("app_token");
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
  }
  return res;
}

// Low-level POST to the chat-completion endpoint.
export async function chatCompletion(messages, type = "chat", extraData = {}) {
  const form = attachPhone(extraData.form);
  let endpoint = `${API_URL}/chat`;
  let body = { messages, factSheet: extraData.factSheet, form };

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
  const data = await res.json();
  return (data.content || "").trim();
}

export async function chatCompletionJSON(messages, type, extraData) {
  const txt = await chatCompletion(messages, type, extraData);
  return JSON.parse(txt.replace(/```json|```/g, "").trim());
}

// GET previously saved data ('interpret' or 'daily') for a person, identified
// by their birth details. For 'daily', pass targetDate (YYYY-MM-DD) to fetch a
// specific day. Returns the parsed object, or null if none is saved.
export async function fetchSaved(type, form, targetDate) {
  const params = new URLSearchParams({
    name: form.name,
    date: form.date,
    time: form.time,
    city: form.city,
  });
  if (form.gender) params.set("gender", form.gender);
  if (targetDate) params.set("targetDate", targetDate);
  const res = await authFetch(`${API_URL}/${type}?${params}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load saved data");
  const data = await res.json();

  // Parse once; if the payload was double-encoded (a JSON string of a JSON
  // string) the first parse yields a string — parse again to reach the object.
  let parsed = JSON.parse((data.content || "").replace(/```json|```/g, "").trim());
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
}

// Fetch the dates (YYYY-MM-DD) that already have saved daily guidance.
export async function fetchDailyDates(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return [];
  const params = new URLSearchParams({
    name: form.name,
    date: form.date,
    time: form.time,
    city: form.city,
  });
  if (form.gender) params.set("gender", form.gender);
  try {
    const res = await authFetch(`${API_URL}/daily-dates?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.dates || [];
  } catch {
    return [];
  }
}

// Fetch list of past palm readings (lightweight — id, handType, createdAt).
export async function fetchPalmHistory(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return [];
  const params = new URLSearchParams({
    name: form.name,
    date: form.date,
    time: form.time,
    city: form.city,
  });
  if (form.gender) params.set("gender", form.gender);
  try {
    const res = await authFetch(`${API_URL}/palm/history?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.readings || [];
  } catch {
    return [];
  }
}

// Fetch a specific past palm reading by id.
export async function fetchPalmById(id, form) {
  const params = new URLSearchParams({
    name: form.name,
    date: form.date,
    time: form.time,
    city: form.city,
  });
  if (form.gender) params.set("gender", form.gender);
  const res = await authFetch(`${API_URL}/palm/${id}?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  let parsed = JSON.parse((data.content || "").replace(/```json|```/g, "").trim());
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
}

// Send a palm photo (base64 data URL or raw base64) for AI analysis.
// Returns the parsed palm reading object.
export async function analyzePalm(imageBase64, form, claimedHand) {
  const res = await authFetch(`${API_URL}/palm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // skipGate: web ran MediaPipe locally before upload, so backend can
    // skip its own Flash gate (no duplicate quality check).
    body: JSON.stringify({ image: imageBase64, form: attachPhone(form), claimedHand, skipGate: true }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const e = new Error(errBody.error || "Palm analysis failed");
    if (errBody.code) e.code = errBody.code;
    throw e;
  }
  const data = await res.json();
  let parsed = JSON.parse((data.content || "").replace(/```json|```/g, "").trim());
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
}

// Send TWO palm photos (left + right) for the full-life comparison reading.
// Returns { left, right, comparison } — comparison is null if either hand
// came back as unusable (frontend should render the retake UI for that hand).
export async function comparePalms(leftBase64, rightBase64, form) {
  const res = await authFetch(`${API_URL}/palm/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leftImage: leftBase64,
      rightImage: rightBase64,
      form: attachPhone(form),
      skipGate: true,
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const e = new Error(errBody.error || "Palm comparison failed");
    if (errBody.code) e.code = errBody.code;
    throw e;
  }
  const data = await res.json();
  let parsed = JSON.parse((data.content || "").replace(/```json|```/g, "").trim());
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
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
  const data = await res.json();
  return data.results || [];
}

// Resolve a Place ID to {coordinates, timezone, ...}. `birthTimestamp` is
// seconds since epoch — sent so Google's Time Zone API returns the
// DST-aware offset AT the user's birth moment.
export async function getCityDetails(placeId, token, birthTimestamp) {
  const params = new URLSearchParams({ placeId, token });
  if (birthTimestamp) params.set("ts", String(birthTimestamp));
  const res = await fetch(`${API_URL}/locations/details?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Location lookup failed (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchChatHistory(form) {
  if (!form?.name || !form?.date || !form?.time || !form?.city) return [];
  const params = new URLSearchParams({
    name: form.name,
    date: form.date,
    time: form.time,
    city: form.city,
  });
  if (form.gender) params.set("gender", form.gender);
  try {
    const res = await authFetch(`${API_URL}/chat?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  } catch {
    return [];
  }
}
