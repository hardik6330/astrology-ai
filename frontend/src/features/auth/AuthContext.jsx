// Real Firebase Phone Auth gate. The SMS send + code verification happen on the
// client (see webOtp.js); here we take the resulting Firebase ID token, hand it
// to /api/auth/verify-otp, and store the backend-issued JWT.

import { createContext, useContext, useEffect, useState } from "react";
import { tokenStore } from "@/common/tokenStore";
import { verifyOtp, bypassLogin } from "@/services/api";
import { logEvent } from "@/utils/analytics";
import * as chartMemory from "@/common/chartMemory";

// Web push pulls in Firebase Cloud Messaging (heavy) and is only ever needed
// once the user is signed in. Load it lazily so a logged-out visitor on the
// marketing landing never downloads Firebase at all. Fire-and-forget — these
// are best-effort and must never block or throw into auth flow.
function registerForWebPush() {
  import("@/features/notifications/webPush")
    .then((m) => m.registerForWebPush())
    .catch((err) => console.error("Web Push registration failed:", err));
}
function teardownWebPush() {
  import("@/features/notifications/webPush")
    .then((m) => m.teardownWebPush())
    .catch((err) => console.error("Web Push teardown failed:", err));
}

// appToken (the bearer) is shared with services/api.js; appAccount holds the
// cached account JSON.
const appToken = tokenStore("app_token");
const appAccount = tokenStore("app_account");
const AuthContext = createContext(null);

// Decode a JWT's `exp` (seconds) without a library and report whether it's
// already past. We treat an undecodable token as expired so a corrupt value
// can't masquerade as a live session. 30s skew guards against clock drift.
function isTokenExpired(jwt) {
  if (!jwt) return true;
  try {
    const [, payload] = jwt.split(".");
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (!exp) return false; // no exp claim → can't judge; let the server decide
    return exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

// A stored token is only a valid session if it hasn't expired; otherwise drop it
// so the user lands on /login cleanly instead of flashing authenticated UI.
function validStoredToken() {
  const t = appToken.get();
  if (isTokenExpired(t)) {
    appToken.remove();
    appAccount.remove();
    return null;
  }
  return t;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(validStoredToken);
  const [account, setAccount] = useState(() => {
    try {
      return JSON.parse(appAccount.get() || "null");
    } catch {
      return null;
    }
  });

  // Already signed in from a prior session — register the web push token on
  // launch (covers permission changes / token rotation while away).
  useEffect(() => {
    if (token) {
      registerForWebPush();
      chartMemory.hydrate(); // pull Timeline answers / asked alignments for this account
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exchange a verified Firebase ID token for our session JWT via
  // /api/auth/verify-otp. Returns any savedForm so the caller can hydrate
  // ChartContext and route a returning user straight to their kundali.
  // Throws on a backend/verification failure (caller surfaces the message).
  async function completeOtpLogin(idToken) {
    const data = await verifyOtp(idToken); // { token, account, savedForm? }
    logEvent("login");
    return finishLogin(data);
  }

  // Dev-only OTP bypass: trade a bare E.164 phone for our session JWT, skipping
  // Firebase entirely. Only reachable when VITE_OTP_ENABLED='false' (LoginPage
  // gates the call); the backend rejects it unless its bypass is on too.
  async function completePhoneBypass(phone) {
    return finishLogin(await bypassLogin(phone));
  }

  // Persist the session + register push.
  function finishLogin(data) {
    appToken.set(data.token);
    appAccount.set(JSON.stringify(data.account));
    setToken(data.token);
    setAccount(data.account);
    registerForWebPush();
    chartMemory.hydrate();
    return { savedForm: data.savedForm || null };
  }

  function logout() {
    teardownWebPush();
    // Wipe our app's specific local data so the next user starts completely clean.
    // We explicitly namespace our removals so we don't accidentally wipe
    // 3rd-party SDK persistence (like Firebase or Razorpay caches).
    try {
      Object.keys(localStorage).forEach((k) => {
        // cm:* is the chart-memory offline cache; the legacy prefixes are the
        // pre-server keys, still swept so an upgrading user starts clean.
        if (
          k.startsWith("app_") ||
          k.startsWith("cm:") ||
          k.startsWith("asked_alignments:") ||
          k.startsWith("timelineCheck:")
        ) {
          localStorage.removeItem(k);
        }
      });
    } catch {
      appToken.remove();
      appAccount.remove(); // fallback: at least clear the session
    }
    chartMemory.reset();
    setToken(null);
    setAccount(null);
  }

  return (
    <AuthContext.Provider
      value={{ token, account, hydrating: false, completeOtpLogin, completePhoneBypass, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
