// Firebase Phone Auth (web). Sends the SMS code via signInWithPhoneNumber using
// an INVISIBLE reCAPTCHA, then verifies the code client-side to get a Firebase
// ID token. The token is POSTed to /api/auth/verify-otp, where the backend
// verifies it and issues our own JWT. See AuthContext.jsx + LoginPage.jsx.

import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "./firebaseConfig";

const CONTAINER_ID = "recaptcha-container";

// ONE invisible reCAPTCHA verifier, REUSED across sends and resends. grecaptcha
// tracks the specific DOM node it rendered into; verifier.clear() + emptying the
// node do NOT fully un-register it, so recreating a verifier on the same
// #recaptcha-container threw "reCAPTCHA has already been rendered in this
// element" on Resend. Invisible reCAPTCHA mints a fresh token on every
// signInWithPhoneNumber call, so reusing the same verifier is the supported
// pattern — we only tear it down on failure or when leaving the screen.
let verifier = null;

function getVerifier() {
  if (!verifier) {
    verifier = new RecaptchaVerifier(auth, CONTAINER_ID, { size: "invisible" });
  }
  return verifier;
}

// Detach the verifier and remove the rendered widget so the NEXT getVerifier()
// can render cleanly. Called after a failed send (the challenge may be consumed)
// and on unmount (LoginPage cleanup).
export function clearRecaptcha() {
  try {
    verifier?.clear();
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    const el = document.getElementById(CONTAINER_ID);
    if (el) el.innerHTML = "";
  }
  verifier = null;
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
