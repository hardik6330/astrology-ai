// Firebase Phone Auth (web). Sends the SMS code via signInWithPhoneNumber using
// an INVISIBLE reCAPTCHA, then verifies the code client-side to get a Firebase
// ID token. The token is POSTed to /api/auth/verify-otp, where the backend
// verifies it and issues our own JWT. See AuthContext.jsx + LoginPage.jsx.

import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "./firebaseConfig";

let verifier = null;

// The invisible reCAPTCHA binds to a DOM node (#recaptcha-container, rendered by
// LoginPage). Recreated per send so a consumed/expired challenge can't block a
// resend ("reCAPTCHA already rendered" errors).
function freshVerifier() {
  try {
    verifier?.clear();
  } catch {
    /* ignore */
  }
  verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
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
  verifier = null;
}
