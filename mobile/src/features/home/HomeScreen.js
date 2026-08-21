import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Platform, Pressable, Switch, TextInput, BackHandler } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import Animated, { 
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, 
  withSequence, Easing, FadeIn, FadeOut, LinearTransition 
} from "react-native-reanimated";
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MagicButton from "@/components/MagicButton";
import MenuButton from "@/components/MenuButton";
import { Label, PremiumInput, DateField } from "@/components/PremiumInput";
import Picker from "@/components/Picker";
import { SkeletonHome } from "@/components/Skeleton";
import CitySearch from "@/features/location/CitySearch";
import { useForm } from "@/context/ChartContext";
import { useTheme } from "@/theme/ThemeContext";
import { computeChart } from "@/shared/astrology";
import { saveProfile } from "@/services/api";
import { haptics } from "@/utils/haptics";
import { logEvent } from "@/features/notifications/analytics";
import { useStyles } from "@/theme/useStyles";
import { radius, spacing, fontSize } from "@/theme/tokens";

const GENDERS = [
  { label: "Male",   value: "Male",   sub: "He / Him",   icon: "male-outline" },
  { label: "Female", value: "Female", sub: "She / Her",  icon: "female-outline" },
  { label: "Non-binary / Other",  value: "Other", sub: "They / Them", icon: "transgender-outline" },
];

export default function HomeScreen({ navigation, route }) {
  const {
    form, setForm, chart, setChart, resetReading,
    redirectToReading, consumeRedirect,
  } = useForm();
  const { colors: color, mode } = useTheme();
  const [step, setStep] = useState(route.params?.step || 1);
  const [error, setError] = useState("");
  // Brief settle-in shimmer before the form fades in (no real data fetch).
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 450);
    return () => clearTimeout(t);
  }, []);

  // Update step if route params change (e.g. coming back from PalmStep)
  useEffect(() => {
    if (route.params?.step) {
      setStep(route.params.step);
    }
  }, [route.params?.step]);

  // Android hardware back button logic
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (step === 2) {
          setStep(1);
          return true; // handled
        }
        // If step is 1 and no chart exists, let the app exit (default behavior or RootNavigator handles)
        if (!chart) {
          return false; // let it bubble up to exit
        }
        return false;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [step, chart])
  );
  // Freeze the page scroll while the city dropdown is open so the list scrolls.
  const [suggestOpen, setSuggestOpen] = useState(false);
  const styles = useStyles(makeStyles);

  // In the screenshots, there are 2 segments now as per user request.
  const progress1 = useSharedValue(step >= 1 ? 1 : 0);
  const progress2 = useSharedValue(step >= 2 ? 1 : 0);

  useEffect(() => {
    progress1.value = withTiming(step >= 1 ? 1 : 0, { duration: 400 });
    progress2.value = withTiming(step >= 2 ? 1 : 0, { duration: 400 });
  }, [step]);

  const p1Style = useAnimatedStyle(() => ({ width: `${progress1.value * 100}%` }));
  const p2Style = useAnimatedStyle(() => ({ width: `${progress2.value * 100}%` }));

  // Hide the side-menu trigger on first visit (before any chart exists)
  // so a freshly logged-in user is funnelled into filling the form.
  // Once they have a chart, the menu reappears for navigation.
  const showMenu = !!chart;

  // Returning-user shortcut: if login (or cold-start hydration) reported
  // saved birth details, ChartContext sets a one-shot flag. Bounce straight
  // to the Kundali tab and clear the flag so later visits to Home stay here.
  useEffect(() => {
    if (redirectToReading && chart) {
      consumeRedirect();
      navigation.navigate("Reading", { tab: "kundali" });
    }
  }, [redirectToReading, chart, consumeRedirect, navigation]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Seconds-since-epoch at the user's local birth instant — passed to the
  // Time Zone API so the offset is correct for that historical date.
  const birthTimestamp = (() => {
    if (!form.date || !form.time) return null;
    const [y, m, d] = form.date.split("-").map(Number);
    const [hh, mm] = form.time.split(":").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d, hh || 0, mm || 0) / 1000);
  })();

  function onCitySelected(picked, errMsg) {
    if (errMsg) { setError(errMsg); return; }
    if (!picked) return;
    setError("");
    setForm((f) => ({
      ...f,
      city:    picked.city,
      lat:     picked.lat,
      lon:     picked.lon,
      tz:      picked.tz,
      tzId:    picked.tzId,
      placeId: picked.placeId,
    }));
  }

  function nextStep() {
    if (step === 1) {
      if (!form.name?.trim()) {
        haptics.warning();
        setError("Please enter your name.");
        return;
      }
      if (!form.gender) {
        haptics.warning();
        setError("Please select your gender.");
        return;
      }
      setError("");
      setStep(2);
    }
  }

  function generate() {
    const fail = (msg) => { haptics.warning(); setError(msg); };
    if (!form.date)  return fail("Please select your birth date.");
    if (!form.time)  return fail("Please select your birth time.");
    if (!form.city)  return fail("Please select your birth city.");
    if (form.lat == null || form.lon == null || form.tz == null) {
      return fail("Please pick your city from the suggestions list.");
    }
    setError("");
    try {
      const ch = computeChart(form.date, form.time, {
        n: form.city, lat: form.lat, lon: form.lon, tz: form.tz,
      });
      logEvent("generate_kundali", { city: form.city, gender: form.gender });
      setChart(ch);
      resetReading();
      // Persist birth details onto the user row now, the moment they're
      // entered — don't wait for a reading to be generated. Fire-and-forget:
      // a failure here must never block the user's flow.
      saveProfile(form);
      // Funnel through the optional palm-reading step before kundali.
      navigation.navigate("PalmStep");
    } catch (e) {
      setError(e.message || "Could not compute chart.");
    }
  }

  return (
    <ScreenContainer showMenu={false} scrollEnabled={!suggestOpen}>
      {booting ? <SkeletonHome /> : (
      <Animated.View entering={FadeIn.duration(300)}>
      <View style={styles.headerArea}>
        <View style={styles.progressRow}>
          <View style={styles.progressSegment}>
            <Animated.View style={[styles.progressFill, p1Style]} />
          </View>
          <View style={styles.progressSegment}>
            <Animated.View style={[styles.progressFill, p2Style]} />
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.mainTitle}>
            {step === 1 ? "Tell us about you" : "Your birth moment"}
          </Text>
          <Text style={styles.subTitle}>
            {step === 1 
              ? "So we can personalize your experience."
              : `The moment the stars aligned for you, ${form.name.split(' ')[0]}.`}
          </Text>
        </View>
      </View>

      {step === 1 ? (
        <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(400)}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>What should we call you?</Text>
            <TextInput
              value={form.name}
              onChangeText={(v) => { set("name", v); setError(""); }}
              placeholder="Enter your name"
              placeholderTextColor={color.textMuted}
              style={[styles.bigInput, error.includes("name") && styles.inputError]}
              autoCapitalize="words"
            />
            {error.includes("name") && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>How do you identify?</Text>
            <View style={styles.genderList}>
              {GENDERS.map((g) => {
                const isSelected = form.gender === g.value;
                return (
                  <Pressable
                    key={g.value}
                    onPress={() => { set("gender", g.value); setError(""); haptics.select(); }}
                    style={[
                      styles.genderCard,
                      isSelected && styles.genderCardActive,
                      error.includes("gender") && styles.inputError,
                    ]}
                  >
                    <View style={styles.genderIconContainer}>
                      <Ionicons
                        name={g.icon}
                        size={20}
                        color={isSelected ? color.primary : color.textDim}
                      />
                    </View>
                    <View style={styles.genderTextContainer}>
                      <Text style={[styles.genderLabel, isSelected && styles.genderLabelActive]}>{g.label}</Text>
                      <Text style={styles.genderSub}>{g.sub}</Text>
                    </View>
                    <View style={[styles.radio, isSelected && styles.radioActive]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {error.includes("gender") && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <MagicButton 
            onPress={nextStep} 
            style={styles.continueBtn}
            disabled={!form.name || !form.gender}
          >
            Continue
          </MagicButton>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(400)}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>What's your birth date?</Text>
            <Pressable 
              style={[styles.selectionCard, error.includes("date") && styles.inputError]}
              onPress={() => setStep(2)} // DateField will handle its own modal
            >
              <DateField 
                value={form.date} 
                onChange={(v) => { set("date", v); setError(""); }} 
                mode="date" 
                customStyle
              />
            </Pressable>
            {error.includes("date") && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Birth time (if known)</Text>
            <Pressable 
              style={[
                styles.selectionCard, 
                error.includes("time") && styles.inputError,
                form.unknownTime && { opacity: 0.5 }
              ]}
            >
              <DateField 
                value={form.time} 
                onChange={(v) => { set("time", v); setError(""); }} 
                mode="time" 
                disabled={form.unknownTime}
                customStyle
              />
            </Pressable>
            {error.includes("time") && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>I don't know my exact birth time</Text>
            <Switch
              value={form.unknownTime || false}
              onValueChange={(v) => {
                set("unknownTime", v);
                if (v) {
                  set("time", "12:00");
                  setError("");
                }
              }}
              trackColor={{ false: color.cardBorder, true: color.primary }}
              thumbColor={Platform.OS === "ios" ? undefined : (form.unknownTime ? "#fff" : "#f4f3f4")}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Where were you born?</Text>
            <CitySearch
              value={form.city}
              birthTimestamp={birthTimestamp}
              onSelect={(picked, err) => { onCitySelected(picked, err); setError(""); }}
              onOpenChange={setSuggestOpen}
              error={error.includes("city")}
              customStyle
            />
            {error.includes("city") && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <View style={styles.btnRow}>
            <MagicButton 
              onPress={() => setStep(1)} 
              variant="ghost" 
              style={styles.backBtn}
            >
              Back
            </MagicButton>
            <MagicButton 
              onPress={generate} 
              style={styles.flexBtn}
            >
              Continue
            </MagicButton>
          </View>
        </Animated.View>
      )}
      </Animated.View>
      )}
    </ScreenContainer>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    headerArea: {
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    progressRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    progressSegment: {
      flex: 1,
      height: 6,
      backgroundColor: c.cardBorder, // More visible track in both modes
      borderRadius: 3,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: c.primary, // Using theme primary color instead of hardcoded hex
    },

    titleRow: {
      marginBottom: spacing.md,
    },
    mainTitle: {
      fontSize: 30,
      fontWeight: "900",
      color: c.text,
      marginBottom: spacing.xs,
    },
    subTitle: {
      fontSize: 15,
      color: c.textDim,
      lineHeight: 22,
    },

    fieldGroup: {
      marginBottom: spacing.lg,
    },
    fieldLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: c.text,
      marginBottom: spacing.sm,
    },
    bigInput: {
      backgroundColor: c.cardBgSolid,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 17,
      color: c.text,
    },
    
    genderList: {
      gap: spacing.md,
    },
    genderCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.cardBgSolid,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    genderCardActive: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    genderIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.inputBg,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    genderTextContainer: {
      flex: 1,
    },
    genderLabel: {
      fontSize: 17,
      fontWeight: "700",
      color: c.text,
    },
    genderLabelActive: {
      color: c.primary,
    },
    genderSub: {
      fontSize: 14,
      color: c.textMuted,
      marginTop: 2,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: {
      borderColor: c.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.primary,
    },

    selectionCard: {
      backgroundColor: c.cardBgSolid,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: radius.lg,
      overflow: "hidden",
    },

    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xl,
    },
    toggleLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: c.text,
    },

    btnRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    backBtn: {
      flex: 1,
    },
    flexBtn: {
      flex: 2,
    },
    continueBtn: {
      marginTop: spacing.xl,
    },

    inputError: {
      borderColor: c.danger,
    },
    errorText: {
      color: c.danger,
      fontSize: 14,
      marginTop: 4,
      marginLeft: spacing.sm,
    },
    toggleText: {
      color: c.textDim,
      fontSize: 16,
      fontWeight: "500",
    },

    progressTrack: {
      height: 6,
      backgroundColor: c.inputBg,
      borderRadius: 3,
      marginBottom: spacing.md,
      overflow: "hidden",
      marginHorizontal: spacing.xl,
    },
    progressBar: {
      height: "100%",
      backgroundColor: c.primary,
    },

    // Inline validation error, shown right above the submit button so it's
    // visible the moment the user taps (the old card rendered below the fold).
    errorBox: {
      flexDirection: "row",
      backgroundColor: "rgba(248,113,113,0.10)",
      borderWidth: 1, borderColor: c.danger,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    errText: { color: c.danger, fontSize: fontSize.sm, flex: 1 },
    fieldErrorText: {
      color: c.danger,
      fontSize: 14,
      marginTop: 4,
      fontWeight: "500",
    },

    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.xs,
    },
    summaryLabel: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      marginBottom: 2,
    },
    summaryValue: {
      color: c.primaryLight,
      fontSize: 15,
      fontWeight: "700",
    },
    editBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: c.theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    editBtnText: {
      color: c.text,
      fontSize: 12,
      fontWeight: "600",
    },
  });
