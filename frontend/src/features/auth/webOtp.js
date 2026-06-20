// Firebase Phone Auth (web). Sends the SMS code via signInWithPhoneNumber using
// an INVISIBLE reCAPTCHA, then verifies the code client-side to get a Firebase
// ID token. The token is POSTed to /api/auth/verify-otp, where the backend
// verifies it and issues our own JWT. See AuthContext.jsx + LoginPage.jsx.

import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "./firebaseConfig";

const CONTAINER_ID = "recaptcha-container";

// Invisible reCAPTCHA verifier. We REUSE one verifier across sends/resends, but
// the key fix for "reCAPTCHA has already been rendered in this element" is to
// render each verifier into a FRESH child <div> rather than the fixed
// #recaptcha-container. grecaptcha registers the exact DOM node it rendered into
// and never forgets it — `verifier.clear()` + emptying innerHTML do NOT
// un-register it, so after a failed/cleared attempt, building a new verifier on
// the SAME node throws. By giving every verifier a brand-new node (and removing
// it on clear), grecaptcha never sees a node it already used → no collision.
let verifier = null;
let widgetEl = null;

function getVerifier() {
  if (verifier) return verifier;

  // Mount a throwaway child inside the stable #recaptcha-container so each
  // verifier targets a node grecaptcha has never seen.
  const host = typeof document !== "undefined" ? document.getElementById(CONTAINER_ID) : null;
  if (host) {
    widgetEl = document.createElement("div");
    host.appendChild(widgetEl);
    verifier = new RecaptchaVerifier(auth, widgetEl, { size: "invisible" });
  } else {
    // Fallback (container not mounted yet) — use the id directly.
    verifier = new RecaptchaVerifier(auth, CONTAINER_ID, { size: "invisible" });
  }
  return verifier;
}

// Detach the verifier and DELETE its rendered node so the next getVerifier()
// renders into a clean, never-used element. Called after a failed send (the
// challenge may be consumed) and on unmount (LoginPage cleanup).
export function clearRecaptcha() {
  try {
    verifier?.clear();
  } catch {
    /* ignore */
  }
  verifier = null;
  if (widgetEl) {
    widgetEl.remove(); // drop the exact node grecaptcha registered
    widgetEl = null;
  }
}

// Send the OTP SMS. `e164` must be full international format, e.g. "+919876543210".
// Returns a confirmationResult whose .confirm(code) completes verification.
export async function sendOtp(e164) {
  try {
    return await signInWithPhoneNumber(auth, e164, getVerifier());
  } catch (err) {
    // A failed attempt can leave the verifier holding a consumed/expired
    // challenge — drop it so the next send (e.g. Resend) builds a fresh one.
    clearRecaptcha();
    throw err;
  }
}

// Verify the code the user typed; resolves to the Firebase ID token to hand the
// backend. Throws on a wrong/expired code (caller shows the message).
export async function confirmOtp(confirmationResult, code) {
  const cred = await confirmationResult.confirm(code);
  return cred.user.getIdToken();
}
