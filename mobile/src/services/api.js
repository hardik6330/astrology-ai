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

async function postJSON(endpoint, body) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = new Error(errBody.error || "AI service unavailable");
    if (errBody.code) err.code = errBody.code;
    throw err;
  }
  return res.json();
}

async function getJSON(endpoint, params) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(`${API_URL}${endpoint}${qs}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load saved data");
  return res.json();
}

function formParams(form) {
  return {
    name: form.name, date: form.date, time: form.time, city: form.city,
  };
}

function parseContent(content) {
  let parsed = JSON.parse((content || "").replace(/```json|```/g, "").trim());
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
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

export async function analyzePalm(imageBase64, form) {
  const data = await postJSON("/palm", { image: imageBase64, form: attachPhone(form) });
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
