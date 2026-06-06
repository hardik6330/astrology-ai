// Firebase Phone Auth (web). Sends the SMS code via signInWithPhoneNumber using
// an INVISIBLE reCAPTCHA, then verifies the code client-side to get a Firebase
// ID token. The token is POSTed to /api/auth/verify-otp, where the backend
// verifies it and issues our own JWT. See AuthContext.jsx + LoginPage.jsx.

import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "./firebaseConfig";

let verifier = null;

const CONTAINER_ID = "recaptcha-container";

// verifier.clear() detaches Firebase's wrapper but leaves grecaptcha's rendered
// widget inside the DOM node — so creating a new verifier on the same node
// throws "reCAPTCHA has already been rendered in this element" (seen on Resend).
// Emptying the node removes the stale widget before we re-render.
function resetContainer() {
  const el = typeof document !== "undefined" ? document.getElementById(CONTAINER_ID) : null;
  if (el) el.innerHTML = "";
}

// The invisible reCAPTCHA binds to a DOM node (#recaptcha-container, rendered by
// LoginPage). Recreated per send so a consumed/expired challenge can't block a
// resend ("reCAPTCHA already rendered" errors).
function freshVerifier() {
  try {
    verifier?.clear();
  } catch {
    /* ignore */
  }
  resetContainer();
  verifier = new RecaptchaVerifier(auth, CONTAINER_ID, { size: "invisible" });
  return verifier;
}

// Send the OTP SMS. `e164` must be full international format, e.g. "+919876543210".
// Returns a confirmationResult whose .confirm(code) completes verification.
export function sendOtp(e164) {
  return signInWithPhoneNumber(auth, e164, freshVerifier());
}

// Verify the code the user typed; resolves to the Firebase ID token to hand the
// backend. Throws on a wrong/expired code (caller shows the message).
export async function confirmOtp(confirmationResult, code) {
  const cred = await confirmationResult.confirm(code);
  return cred.user.getIdToken();
}

// Drop the reCAPTCHA widget (e.g. when leaving the login screen).
export function clearRecaptcha() {
  try {
    verifier?.clear();
  } catch {
    /* ignore */
  }
  resetContainer();
  verifier = null;
}
