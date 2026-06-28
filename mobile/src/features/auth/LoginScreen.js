// Real Firebase Phone Auth login. "Send OTP" fires an actual SMS via
// signInWithPhoneNumber, and "Verify" confirms the code to get a Firebase ID
// token, which AuthContext trades for our session JWT.

import React, { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Dimensions, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence, Easing,
} from "react-native-reanimated";
import { useAuth } from "./AuthContext";
import { verifyPhone, confirmCode } from "./otp";
import { useForm } from "@/context/ChartContext";
import { defaultDialCode } from "@/utils/dialCode";
import CountrySelect from "./CountrySelect";
import { useTheme } from "@/theme/ThemeContext";
import { useStyles } from "@/theme/useStyles";
import { LoginBackdrop } from "@/components/cosmic";
import { EMOJIS } from "@/utils/emojis";
import { spacing } from "@/theme/tokens";

const { width: SCREEN_W } = Dimensions.get("window");

const RESEND_SECS = 30;

// Dev OTP bypass. When EXPO_PUBLIC_OTP_ENABLED='false', skip Firebase SMS and
// log in straight from the typed phone. Mirrors the backend OTP_ENABLED flag —
// the backend still rejects the bypass unless its own flag is 'false' too. Also
// dodges the native Firebase module, so this works in Expo Go.
const OTP_ENABLED = process.env.EXPO_PUBLIC_OTP_ENABLED !== "false";

// Map Firebase Auth error codes to friendly messages.
function otpError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-verification-code")) return "Incorrect code. Please try again.";
  if (code.includes("session-expired") || code.includes("code-expired"))
    return "Code expired. Tap Resend to get a new one.";
  if (code.includes("invalid-phone-number")) return "That phone number looks invalid.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait and try again.";
  if (code.includes("quota-exceeded")) return "SMS limit reached. Please try again later.";
  return err?.message || "Something went wrong. Please try again.";
}

export default function LoginScreen() {
  const { completeOtpLogin, completePhoneBypass } = useAuth();
  const { applySavedForm } = useForm();
  const { theme, colors: color } = useTheme();
  const s = useStyles(makeStyles);

  const floatAnim = useSharedValue(0);
  const shakeAnim = useSharedValue(0);

  useEffect(() => {
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value * -15 }],
  }));

  const animatedCheckboxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  function triggerShake() {
    shakeAnim.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10,  { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10,  { duration: 50 }),
      withTiming(0,   { duration: 50 })
    );
  }

  const [phone, setPhone] = useState("");
  // Country dialing code (digits, no "+"), pre-filled from the phone's region
  // (expo-localization — no permission/GPS). Editable, so a traveler whose phone
  // region differs from their number's country can correct it.
  const [dialCode, setDialCode] = useState(() => defaultDialCode());
  const [otp,   setOtp]   = useState("");
  const [step,  setStep]  = useState("phone");
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // True only while a resend SMS is in flight, so the primary button reads
  // "Sending…" instead of the misleading "Verifying…" (both share `busy`).
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState("");
  const [agreed, setAgreed] = useState(false);
  const phoneRef = useRef("");
  // verificationId (from onCodeSent) for the manual confirm path.
  const verificationIdRef = useRef(null);
  // Active verifyPhone listener — torn down on unmount / before a resend.
  const unsubRef = useRef(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // Stop the auto-retrieval listener when leaving the screen.
  useEffect(() => () => unsubRef.current?.(), []);

  // Shared: trade the Firebase ID token for our session + route the user.
  async function doLogin(idToken) {
    const { savedForm, commitSession } = await completeOtpLogin(idToken);
    // Hydrate ChartContext FIRST so the redirect flag + chart are in place
    // before the navigator switches (avoids a flash of the empty form).
    if (savedForm) await applySavedForm(savedForm);
    commitSession(); // switches the navigator → this screen unmounts
  }

  function sendOtp() {
    setError("");
    setNotice("");
    // Full E.164 number = country code (auto-detected, editable) + national digits.
    const code = dialCode.replace(/\D/g, "");
    const national = phone.replace(/\D/g, "");
    const full = `${code}${national}`;
    if (!code) return setError("Enter your country code");
    if (national.length < 6 || full.length > 15)
      return setError("Enter a valid phone number");
    const cleaned = full;
    if (!agreed) {
      triggerShake();
      return setError("Please agree to the Terms & Conditions");
    }

    // Dev bypass: no SMS / Firebase — trade the bare phone for a session.
    if (!OTP_ENABLED) {
      setBusy(true);
      phoneRef.current = cleaned;
      (async () => {
        try {
          const { savedForm, commitSession } = await completePhoneBypass(`+${cleaned}`);
          if (savedForm) await applySavedForm(savedForm);
          commitSession();
        } catch (err) {
          setError(otpError(err));
          setBusy(false);
        }
      })();
      return;
    }

    // Already on the code screen → this tap is a resend, not the first send.
    const isResend = step === "otp";
    setBusy(true);
    setResending(isResend);
    phoneRef.current = cleaned;

    // Wrap the whole start in try/catch: verifyPhone() runs the native
    // verifyPhoneNumber() synchronously, which can THROW (e.g. a pending
    // verification, reCAPTCHA/Play-Integrity hiccup, or rate-limit on a resend).
    // The async onError callback only catches async failures — without this, a
    // synchronous throw escapes the onPress handler and white-screens the app.
    try {
      // Tear down any previous listener before a new send / resend.
      unsubRef.current?.();
      // User enters the full number incl. country code; Firebase needs E.164 (+...).
      unsubRef.current = verifyPhone(`+${cleaned}`, {
        onCodeSent: (verificationId) => {
          verificationIdRef.current = verificationId;
          setOtp("");
          setStep("otp");
          setResendIn(RESEND_SECS);
          if (isResend) setNotice("New code sent.");
          setResending(false);
          setBusy(false);
        },
        // Android auto-read the SMS → fill the boxes + sign in with no typing.
        onAutoComplete: async (idToken, code) => {
          if (code) setOtp(code);
          setStep("otp");
          setBusy(true);
          try {
            await doLogin(idToken);
          } catch (err) {
            setError(otpError(err));
            setBusy(false);
          }
        },
        onError: (err) => {
          setError(otpError(err));
          setResending(false);
          setBusy(false);
        },
      });
    } catch (err) {
      setError(otpError(err));
      setResending(false);
      setBusy(false);
    }
  }

  // Go back to the phone step. Tear down the active auto-retrieval listener so a
  // late Android SMS auto-read for the OLD number can't fire onAutoComplete and
  // log the user in with a number they just chose to change. Also reset the
  // resend timer + stale verificationId so the next send starts clean.
  function changeNumber() {
    unsubRef.current?.();
    unsubRef.current = null;
    verificationIdRef.current = null;
    setStep("phone");
    setOtp("");
    setNotice("");
    setError("");
    setResendIn(0);
  }

  async function verifyOtp() {
    setError("");
    if (otp.length !== 6) return setError("Enter the 6-digit code");
    if (!verificationIdRef.current) return setError("Please request a code first");

    setBusy(true);
    try {
      const idToken = await confirmCode(verificationIdRef.current, otp);
      await doLogin(idToken);
    } catch (err) {
      setError(otpError(err));
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <LoginBackdrop color={color} theme={theme} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <View style={s.container}>
          <View style={s.content}>
            <Animated.View style={[s.logoContainer, animatedLogoStyle]}>
              <Image source={require("../../../assets/homescreen-logo.png")} style={s.logoImg} resizeMode="contain" />
            </Animated.View>
            <Text style={s.title}>Sign in to Selora</Text>
            <Text style={s.subtitle}>
              {step === "phone"
                ? "We'll send a one-time code over SMS."
                : `Code sent to +${phoneRef.current}. Enter it below.`}
            </Text>

            {step === "phone" && (
              <>
                <Text style={s.label}>Phone number</Text>
                <View style={s.inputContainer}>
                  <CountrySelect value={dialCode} onChange={setDialCode} disabled={busy} />
                  <View style={s.divider} />
                  <TextInput
                    value={phone}
                    onChangeText={(v) => setPhone(v.replace(/\D/g, ""))}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="mobile number"
                    placeholderTextColor={color.textMuted}
                    style={s.input}
                    editable={!busy}
                    maxLength={12}
                  />
                </View>

                <Pressable 
                  onPress={() => setAgreed(!agreed)} 
                  style={s.termsRow}
                >
                  <Animated.View style={[s.checkbox, agreed && s.checkboxChecked, animatedCheckboxStyle]}>
                    {agreed && <Text style={s.checkmark}>{EMOJIS.CHECK}</Text>}
                  </Animated.View>
                  <Text style={s.termsText}>
                    I agree to the <Text style={s.termsLink}>Terms & Conditions</Text> and <Text style={s.termsLink}>Privacy Policy</Text>
                  </Text>
                </Pressable>

                <Pressable onPress={sendOtp} disabled={busy} style={[s.primaryBtn, busy && { opacity: 0.6 }]}>
                  <Text style={s.primaryBtnText}>{busy ? "Sending…" : "Send OTP"}</Text>
                </Pressable>
              </>
            )}

            {step === "otp" && (
              <>
                <Text style={s.label}>6-digit code</Text>
                <View style={s.otpWrap}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View key={i} style={[s.otpBox, otp.length === i && s.otpBoxActive]}>
                      <Text style={s.otpText}>{otp[i] || ""}</Text>
                    </View>
                  ))}
                  <TextInput
                    value={otp}
                    onChangeText={(v) => setOtp(v.replace(/\D/g, ""))}
                    keyboardType="number-pad"
                    autoComplete="sms-otp"
                    textContentType="oneTimeCode"
                    style={s.hiddenInput}
                    editable={!busy}
                    maxLength={6}
                    autoFocus
                  />
                </View>
                <Pressable onPress={verifyOtp} disabled={busy} style={[s.primaryBtn, busy && { opacity: 0.6 }]}>
                  <Text style={s.primaryBtnText}>
                    {resending ? "Sending…" : busy ? "Verifying…" : "Verify & continue"}
                  </Text>
                </Pressable>
                <View style={s.rowBetween}>
                  <Pressable onPress={changeNumber}>
                    <Text style={s.link}>← Change number</Text>
                  </Pressable>
                  <Pressable onPress={sendOtp} disabled={resendIn > 0 || busy}>
                    <Text style={[s.link, (resendIn > 0 || busy) && { opacity: 0.4 }]}>
                      {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                    </Text>
                  </Pressable>
                </View>
                {notice ? <Text style={s.notice}>{notice}</Text> : null}
              </>
            )}

            {error ? <Text style={s.error}>{error}</Text> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: "center" },
  content: { width: "100%", marginBottom: 45 },

  logoContainer: {
    width: 90,
    height: 90,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    marginTop: 20, // Space for floating animation
    alignSelf: "center",
    overflow: "visible",
  },
  logoImg: {
    width: 88,
    height: 88,
  },

  title: { color: c.text, fontSize: 28, fontWeight: "800", textAlign: "center", letterSpacing: 0.5 },
  subtitle: { color: c.textDim, fontSize: 14, textAlign: "center", marginTop: 10, marginBottom: 40, lineHeight: 22 },
  label: { 
     color: c.text === "#ffffff" ? "#ffffff" : c.primary, 
     fontSize: 12, 
     letterSpacing: 1, 
     marginBottom: 10, 
     fontWeight: "700", 
     textTransform: "uppercase" 
   },
  
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.cardBorder,
    paddingHorizontal: 16,
  },
  plus: {
    color: c.text,
    fontSize: 17,
    fontWeight: "700",
    marginRight: 2,
  },
  codeInput: {
    color: c.text,
    fontSize: 17,
    fontWeight: "700",
    paddingVertical: 18,
    minWidth: 28,
    textAlign: "center",
  },
  divider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 12,
    marginHorizontal: 10,
    backgroundColor: c.cardBorder,
  },
  input: {
    flex: 1,
    paddingVertical: 18,
    color: c.text,
    fontSize: 17,
    fontWeight: "700",
  },
  
  otpWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 5,
  },
  otpBox: {
    width: (SCREEN_W - spacing.xl * 2 - 50) / 6,
    height: 60,
    backgroundColor: c.theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  otpBoxActive: {
    borderColor: c.primary,
    backgroundColor: c.theme === "dark" ? "rgba(168,85,247,0.1)" : "rgba(124,58,237,0.05)",
  },
  otpText: {
    color: c.text,
    fontSize: 24,
    fontWeight: "800",
  },
  hiddenInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
  },
  
  primaryBtn: {
    marginTop: 30,
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: c.primary,
    alignItems: "center",
    shadowColor: c.primary,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
  
  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  link: { color: c.primaryLight, fontSize: 13, fontWeight: "600" },
  error: { color: c.danger, fontSize: 13, marginTop: 20, textAlign: "center", fontWeight: "500" },
  notice: { color: c.success, fontSize: 13, marginTop: 12, textAlign: "center", fontWeight: "500" },

  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 20,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: c.primaryLight + "60",
    backgroundColor: c.inputBg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  termsText: {
    flex: 1,
    color: c.textDim,
    fontSize: 12,
    lineHeight: 20,
  },
  termsLink: {
    color: c.primaryLight,
    fontWeight: "700",
  },
});
