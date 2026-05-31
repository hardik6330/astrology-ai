// Dummy phone-OTP login. UI mirrors the real flow we'll wire up later —
// for now, "Send OTP" advances to the OTP step (no SMS) and the OTP field
// is pre-filled with 123456. Any 6-digit code is accepted.

import React, { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withDelay, withSequence, Easing,
} from "react-native-reanimated";
import { useAuth } from "./AuthContext";
import { useChart } from "@/context/ChartContext";
import { useTheme } from "@/theme/ThemeContext";
import { useStyles } from "@/theme/useStyles";
import { radius, spacing } from "@/theme/tokens";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Cheap twinkling star — uses a plain Animated.View with native-driven
// opacity. No SVG re-render, no per-frame JS work. Each star only animates
// opacity (not radius) so the compositor can run on the GPU.
function TwinkleStar({ x, y, size, baseOpacity, dur, delay }) {
  const opacity = useSharedValue(baseOpacity);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(baseOpacity * 0.25, { duration: dur, easing: Easing.inOut(Easing.quad) }),
        withTiming(baseOpacity,        { duration: dur, easing: Easing.inOut(Easing.quad) }),
      ), -1, false));
  }, [opacity, baseOpacity, dur, delay]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: "absolute", left: x, top: y,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: "#fff",
    }, style]} />
  );
}

function ShootingStar() {
  const x = useSharedValue(-200);
  const y = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(20);
  const sideRef = useRef(0); // 0 = left, 1 = right

  useEffect(() => {
    const loop = () => {
      if (sideRef.current === 0) {
        // From Top-Left to Middle-Right
        x.value = -200;
        y.value = -100;
        rotation.value = 20;
        x.value = withTiming(SCREEN_W * 0.7, { duration: 1800, easing: Easing.out(Easing.quad) });
        y.value = withTiming(SCREEN_H * 0.5, { duration: 1800, easing: Easing.out(Easing.quad) });
      } else {
        // From Top-Right to Middle-Left
        x.value = SCREEN_W + 100;
        y.value = -100;
        rotation.value = -20;
        x.value = withTiming(SCREEN_W * 0.3, { duration: 1800, easing: Easing.out(Easing.quad) });
        y.value = withTiming(SCREEN_H * 0.5, { duration: 1800, easing: Easing.out(Easing.quad) });
      }

      opacity.value = 0;
      opacity.value = withSequence(
        withTiming(0,   { duration: 200 }),
        withTiming(0.9, { duration: 200 }),
        withTiming(0,   { duration: 1400 }),
      );

      sideRef.current = 1 - sideRef.current;
    };
    loop();
    const id = setInterval(loop, 7000);
    return () => clearInterval(id);
  }, [x, y, opacity, rotation]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rotation.value}deg` }
    ],
  }));
  return <Animated.View style={[shootingStarStyle, style]} />;
}

// Single orbital ring with one planet circling. Stacked at different radii
// + speeds to build the orbital system.
function Orbit({ size, dur, reverse, planetColor, planetSize = 8 }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(reverse ? -360 : 360, {
      duration: dur, easing: Easing.linear,
    }), -1, false);
  }, [rot, dur, reverse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: "absolute",
      width: size, height: size,
      top: (SCREEN_H - size) / 2, left: (SCREEN_W - size) / 2,
      borderRadius: size / 2,
      borderWidth: 1, borderColor: "rgba(167,139,250,0.18)",
      borderStyle: "dashed",
    }, style]}>
      <View style={{
        position: "absolute", top: -planetSize / 2,
        left: size / 2 - planetSize / 2,
        width: planetSize, height: planetSize, borderRadius: planetSize / 2,
        backgroundColor: planetColor,
        shadowColor: planetColor, shadowOpacity: 1, shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 }, elevation: 6,
      }} />
    </Animated.View>
  );
}

function CenterSun() {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(1.3, { duration: 2000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: "absolute",
      top: SCREEN_H / 2 - 8, left: SCREEN_W / 2 - 8,
      width: 16, height: 16, borderRadius: 8,
      backgroundColor: "#fff",
      shadowColor: "#c7d2fe", shadowOpacity: 1, shadowRadius: 20,
      shadowOffset: { width: 0, height: 0 }, elevation: 10,
    }, style]} />
  );
}

function CosmicBackdrop({ color }) {
  // ~30 stars instead of 70, opacity-only animation. Plenty for a starry
  // feel without the GPU cost of dozens of overlapping animated SVG nodes.
  const stars = Array.from({ length: 30 }, (_, i) => ({
    x: ((i * 53) % 100) / 100 * SCREEN_W,
    y: ((i * 37) % 100) / 100 * SCREEN_H,
    size: ((i * 7) % 3) + 1.4,
    o: 0.3 + ((i * 11) % 7) / 14,
    dur: 1800 + (i % 5) * 700,
    delay: (i * 137) % 2400,
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Solid radial gradient — drawn once, never animated. */}
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="bgGrad" cx="20%" cy="20%" r="80%">
            <Stop offset="0%"   stopColor={color.primarySoft || "#1e1b4b"} stopOpacity="1" />
            <Stop offset="100%" stopColor={color.bg} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={SCREEN_W} height={SCREEN_H} fill="url(#bgGrad)" />
      </Svg>

      {stars.map((s, i) => (
        <TwinkleStar key={i} x={s.x} y={s.y} size={s.size}
                     baseOpacity={s.o} dur={s.dur} delay={s.delay} />
      ))}

      <Orbit size={SCREEN_W * 1.0} dur={80000} planetColor="#fbbf24" planetSize={9} />
      <Orbit size={SCREEN_W * 0.7} dur={50000} reverse planetColor="#a78bfa" planetSize={8} />
      <Orbit size={SCREEN_W * 0.42} dur={30000} planetColor="#34d399" planetSize={6} />
      <CenterSun />

      <ShootingStar />
    </View>
  );
}

const glyphStyle = {
  position: "absolute",
  color: "rgba(167,139,250,0.12)",
  fontWeight: "300",
};

const shootingStarStyle = {
  position: "absolute", top: 0, left: 0,
  width: 110, height: 2, borderRadius: 2,
  backgroundColor: "#fff",
  shadowColor: "#c7d2fe", shadowOpacity: 1, shadowRadius: 8,
  shadowOffset: { width: 0, height: 0 },
  elevation: 6,
};

const DEFAULT_OTP = "123456";
const RESEND_SECS = 30;

export default function LoginScreen() {
  const { login } = useAuth();
  const { applySavedForm } = useChart();
  const { theme, colors: color } = useTheme();
  const s = useStyles(makeStyles);

  const [phone, setPhone] = useState("");
  const [otp,   setOtp]   = useState("");
  const [step,  setStep]  = useState("phone");
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const phoneRef = useRef("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function sendOtp() {
    setError("");
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) return setError("Enter a valid 10-digit phone number");

    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    // Persist only the 10-digit number — the +91 prefix is a display
    // detail in the UI, not part of the canonical identifier we store.
    phoneRef.current = cleaned.slice(-10);
    setOtp(DEFAULT_OTP);
    setStep("otp");
    setResendIn(RESEND_SECS);
    setBusy(false);
  }

  async function verifyOtp() {
    setError("");
    if (otp.length !== 6) return setError("Enter the 6-digit code");

    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    const { savedForm, commitSession } = await login({ phone: phoneRef.current });
    // If the backend recognised this number, hydrate ChartContext FIRST so
    // the redirect flag + chart are in place before the navigator switches.
    // Otherwise HomeScreen briefly flashes the empty form on returning login.
    if (savedForm) await applySavedForm(savedForm);
    commitSession();
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <CosmicBackdrop color={color} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <View style={s.wrap}>
          <BlurView intensity={60} tint={theme === "light" ? "light" : "dark"} style={s.card}>
            <Text style={s.emoji}>🪐</Text>
            <Text style={s.title}>Sign in to Astrology AI</Text>
            <Text style={s.subtitle}>
              {step === "phone"
                ? "We'll send a one-time code over SMS."
                : `Code sent to ${phoneRef.current}. Enter it below.`}
            </Text>

            {step === "phone" && (
              <>
                <Text style={s.label}>Phone number</Text>
                <TextInput
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/\D/g, ""))}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  placeholderTextColor={color.textMuted}
                  style={s.input}
                  editable={!busy}
                  maxLength={10}
                />
                <Pressable onPress={sendOtp} disabled={busy} style={[s.primaryBtn, busy && { opacity: 0.6 }]}>
                  <Text style={s.primaryBtnText}>{busy ? "Sending…" : "Send OTP"}</Text>
                </Pressable>
              </>
            )}

            {step === "otp" && (
              <>
                <Text style={s.label}>6-digit code</Text>
                <TextInput
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  placeholder="••••••"
                  placeholderTextColor={color.textMuted}
                  style={[s.input, s.otpInput]}
                  editable={!busy}
                  maxLength={6}
                />
                <Pressable onPress={verifyOtp} disabled={busy} style={[s.primaryBtn, busy && { opacity: 0.6 }]}>
                  <Text style={s.primaryBtnText}>{busy ? "Verifying…" : "Verify & continue"}</Text>
                </Pressable>
                <View style={s.rowBetween}>
                  <Pressable onPress={() => { setStep("phone"); setOtp(""); }}>
                    <Text style={s.link}>← Change number</Text>
                  </Pressable>
                  <Pressable onPress={sendOtp} disabled={resendIn > 0 || busy}>
                    <Text style={[s.link, (resendIn > 0 || busy) && { opacity: 0.4 }]}>
                      {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {error ? <Text style={s.error}>{error}</Text> : null}
          </BlurView>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: spacing.lg },
  card: {
    borderWidth: 1.5, borderColor: "rgba(167,139,250,0.45)",
    borderRadius: radius.xl + 4,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.xl + 8,
    // overflow:hidden is required so BlurView is clipped to the rounded
    // corners — otherwise the blur leaks past the border radius on Android.
    overflow: "hidden",
  },
  emoji: { fontSize: 52, textAlign: "center", marginBottom: 14, lineHeight: 60 },
  title: { color: c.text, fontSize: 22, fontWeight: "800", textAlign: "center", letterSpacing: 0.3 },
  subtitle: { color: c.textBody, fontSize: 13, textAlign: "center", marginTop: 8, marginBottom: 26, lineHeight: 19, paddingHorizontal: 8 },
  label: { color: c.textDim, fontSize: 11, letterSpacing: 1.5, marginBottom: 8, fontWeight: "600", textTransform: "uppercase" },
  input: {
    width: "100%", paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12,
    backgroundColor: c.inputBg,
    borderWidth: 1, borderColor: c.cardBorder,
    color: c.text, fontSize: 15,
  },
  // Standalone OTP input — drop the row's flex:1 (was eating vertical
  // space + breaking centered text on Android), use real width + tracking.
  otpInput: {
    flex: 0, width: "100%",
    fontSize: 22, fontWeight: "700",
    textAlign: "center", letterSpacing: 8,
    paddingVertical: 14,
  },
  primaryBtn: {
    marginTop: 22, paddingVertical: 15, borderRadius: 14,
    backgroundColor: "#8b5cf6", alignItems: "center",
    shadowColor: "#8b5cf6", shadowOpacity: 0.5, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  link: { color: c.primaryLight, fontSize: 12.5, fontWeight: "600" },
  error: { color: c.danger, fontSize: 12.5, marginTop: 14, textAlign: "center" },
});
