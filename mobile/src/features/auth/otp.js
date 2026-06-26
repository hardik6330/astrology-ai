// Firebase Phone Auth (mobile) via @react-native-firebase/auth, using
// verifyPhoneNumber() so Android can AUTO-RETRIEVE the SMS code: the OS reads
// the incoming SMS, we fill the field and sign in automatically (no typing).
// iOS / failed auto-retrieval fall back to manual entry via confirmCode().
//
// NOTE: native module — requires an EAS dev/preview build (no-op/throws in
// Expo Go). Android verification uses Play Integrity (with a reCAPTCHA fallback
// on non-Play-Store builds); ensure SHA-1/SHA-256 are registered in Firebase.

// Lazy require so a static import doesn't crash at load when the native module
// isn't compiled in (Expo Go / pre-auth builds).
function rnAuth() {
  return require("@react-native-firebase/auth").default;
}

// Start phone verification. `e164` must be full international format, e.g.
// "+919876543210". Callbacks:
//   onCodeSent(verificationId) — SMS sent; show the code screen (always fires)
//   onAutoComplete(idToken, code) — Android auto-read the SMS, already signed in;
//                                   `code` lets the UI visually fill the boxes
//   onError(error) — verification failed
// Returns an unsubscribe function — call it on unmount / before a resend.
// NOTE: PhoneAuthListener.on() returns the LISTENER object (`this`), not an
// unsubscribe function. Calling that object as a function (e.g. on a resend)
// throws ("object not found"). So we capture the listener and return a real
// cleanup closure that tears down its observers — safe to call any number of
// times, and it stops a stale listener from firing after a resend.
export function verifyPhone(e164, { onCodeSent, onAutoComplete, onError } = {}) {
  const auth = rnAuth();
  const listener = auth()
    .verifyPhoneNumber(e164)
    .on("state_changed", async (snapshot) => {
      switch (snapshot.state) {
        case auth.PhoneAuthState.CODE_SENT:
          onCodeSent?.(snapshot.verificationId);
          break;
        case auth.PhoneAuthState.AUTO_VERIFIED:
          // Android auto-retrieval succeeded — build the credential, sign in,
          // and hand back the ID token for our backend.
          try {
            const credential = auth.PhoneAuthProvider.credential(
              snapshot.verificationId,
              snapshot.code,
            );
            const userCred = await auth().signInWithCredential(credential);
            const idToken = await userCred.user.getIdToken();
            onAutoComplete?.(idToken, snapshot.code || "");
          } catch (err) {
            onError?.(err);
          }
          break;
        case auth.PhoneAuthState.ERROR:
          onError?.(snapshot.error || new Error("verification failed"));
          break;
        // AUTO_VERIFY_TIMEOUT: no auto-retrieval — user types the code manually.
        default:
          break;
      }
    });

  return () => {
    // _removeAllListeners is the listener's own teardown (it also self-removes
    // on terminal states); guarded so a version change or double-call is a no-op.
    try {
      listener?._removeAllListeners?.();
    } catch {
      /* already torn down */
    }
  };
}

// Manual path: verify the typed code against the verificationId from onCodeSent.
// Resolves to the Firebase ID token. Throws on a wrong/expired code.
export async function confirmCode(verificationId, code) {
  const auth = rnAuth();
  const credential = auth.PhoneAuthProvider.credential(verificationId, code);
  const userCred = await auth().signInWithCredential(credential);
  return userCred.user.getIdToken();
}
