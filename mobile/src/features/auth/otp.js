// Firebase Phone Auth (mobile) via @react-native-firebase/auth. Sends the SMS
// code, then confirms it to get a Firebase ID token for /api/auth/verify-otp.
// Mirrors the web flow in frontend/src/features/auth/webOtp.js.
//
// NOTE: native module — requires an EAS dev/preview build (no-op/throws in
// Expo Go). Android verification uses Play Integrity (no reCAPTCHA UI); ensure
// the app's SHA-1/SHA-256 are registered in the Firebase project.

// Lazy require so a static import doesn't crash at load when the native module
// isn't compiled in (Expo Go / pre-auth builds).
function getAuth() {
  return require("@react-native-firebase/auth").default;
}

// Send the OTP SMS. `e164` must be full international format, e.g. "+919876543210".
// Returns a confirmation object whose .confirm(code) completes verification.
export function sendOtp(e164) {
  return getAuth()().signInWithPhoneNumber(e164);
}

// Verify the typed code; resolves to the Firebase ID token to hand the backend.
// Throws on a wrong/expired code (caller shows the message).
export async function confirmOtp(confirmation, code) {
  const cred = await confirmation.confirm(code);
  return cred.user.getIdToken();
}
