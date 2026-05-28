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
  ENV_URL && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(ENV_URL)
    ? ENV_URL
    : deriveDevUrl();

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

async function postJSON(endpoint, body) {
  const url = `${API_URL}${endpoint}`;
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = new Error(errBody.error || `AI service unavailable (HTTP ${res.status})`);
    if (errBody.code) err.code = errBody.code;
    err.status = res.status;
    err.url = url;
    throw err;
  }
  return res.json();
}

async function getJSON(endpoint, params) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const url = `${API_URL}${endpoint}${qs}`;
  const res = await fetchWithRetry(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(`Failed to load (HTTP ${res.status}) → ${url}`);
    err.status = res.status;
    err.url = url;
    throw err;
  }
  return res.json();
}

function formParams(form) {
  const p = {
    name: form.name, date: form.date, time: form.time, city: form.city,
  };
  if (form.gender) p.gender = form.gender;
  return p;
}

function parseContent(content) {
  let parsed = JSON.parse((content || "").replace(/```json|```/g, "").trim());
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
}

// Dummy login: send the phone, get back a real JWT + AuthAccount row.
// Used by mobile until real Firebase Phone Auth is wired in.
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
  return res.json(); // { token, account: { id, phone } }
}

// Fire-and-forget ping to wake the serverless backend on app start.
// Hits "/" (the root route returns "Server is running") so the cold start
// finishes before the user submits their first real request.
export function warmupBackend() {
  // Strip "/api" suffix since the warm-up route is at the root
  const base = API_URL.replace(/\/api\/?$/, "");
  fetch(`${base}/`).catch(() => { /* ignore — best-effort warm-up */ });
}

export async function chatCompletion(messages, type = "chat", extra = {}) {
  const form = attachPhone(extra.form);
  let endpoint = "/chat";
  let body = { messages, factSheet: extra.factSheet, form };
  if (type === "interpret") {
    endpoint = "/interpret";
    body = { factSheet: extra.factSheet, form };
  } else if (type === "daily") {
    endpoint = "/daily";
    body = { ctx: extra.ctx, form, targetDate: extra.date };
  }
  const data = await postJSON(endpoint, body);
  return (data.content || "").trim();
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
  return parseContent(data.content);
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
