import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform, Pressable, Switch } from "react-native";
import Animated, { 
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, 
  withSequence, Easing, FadeIn, FadeOut 
} from "react-native-reanimated";
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MagicButton from "@/components/MagicButton";
import MenuButton from "@/components/MenuButton";
import { Label, PremiumInput, DateField } from "@/components/PremiumInput";
import Picker from "@/components/Picker";
import CitySearch from "@/features/location/CitySearch";
import { useChart } from "@/context/ChartContext";
import { useTheme } from "@/theme/ThemeContext";
import { computeChart } from "@/shared/astrology";
import { haptics } from "@/utils/haptics";
import { logEvent } from "@/features/notifications/analytics";
import { useStyles } from "@/theme/useStyles";
import { radius, spacing, fontSize } from "@/theme/tokens";

const GENDERS = [
  { label: "Male",   value: "Male" },
  { label: "Female", value: "Female" },
  { label: "Other",  value: "Other" },
];

export default function HomeScreen({ navigation }) {
  const {
    form, setForm, chart, setChart, resetReading,
    redirectToReading, consumeRedirect,
  } = useChart();
  const { colors: color } = useTheme();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  // Freeze the page scroll while the city dropdown is open so the list scrolls.
  const [suggestOpen, setSuggestOpen] = useState(false);
  const styles = useStyles(makeStyles);

  const progress = useSharedValue(0.5); // 0.5 for step 1, 1.0 for step 2

  useEffect(() => {
    progress.value = withTiming(step === 1 ? 0.5 : 1, { duration: 500 });
  }, [step]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

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
      logEvent("generate_kundali", {
        user_name: form.name,
        city: form.city,
        gender: form.gender
      });
      setChart(ch);
      resetReading();
      // Funnel through the optional palm-reading step before kundali.
      navigation.navigate("PalmStep");
    } catch (e) {
      setError(e.message || "Could not compute chart.");
    }
  }

  return (
    <ScreenContainer showMenu={false} scrollEnabled={!suggestOpen}>
      <View style={styles.headerRow}>
        {showMenu ? <MenuButton /> : <View style={{ width: 40 }} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Discover Your Stars</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            Step {step} of 2: {step === 1 ? "Basic Details" : "Birth Details"}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressBar, progressStyle]} />
      </View>

      {step === 1 ? (
        <CosmicCard>
          <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(400)}>
            <View style={styles.field}>
              <Label>Full Name</Label>
              <PremiumInput
                value={form.name}
                onChangeText={(v) => { set("name", v); setError(""); }}
                placeholder="Enter your name..."
                autoCapitalize="words"
                error={error.includes("name")}
              />
              {error.includes("name") && <Text style={styles.fieldErrorText}>{error}</Text>}
            </View>
            <View style={styles.field}>
              <Label>Gender</Label>
              <Picker
                value={form.gender}
                onChange={(v) => { set("gender", v); setError(""); }}
                options={GENDERS}
                placeholder="Select gender"
                error={error.includes("gender")}
              />
              {error.includes("gender") && <Text style={styles.fieldErrorText}>{error}</Text>}
            </View>

            <MagicButton onPress={nextStep} style={{ marginTop: spacing.md }}>
              Continue ➔
            </MagicButton>
          </Animated.View>
        </CosmicCard>
      ) : (
        <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(400)}>
          <Text style={styles.personalizedMsg}>
            {form.name.split(' ')[0]}, please enter your birth details so we can find your destiny.
          </Text>
          

          <CosmicCard>
            <View style={styles.row}>
              <View style={styles.col}>
                <Label>Birth Date</Label>
                <DateField 
                  value={form.date} 
                  onChange={(v) => { set("date", v); setError(""); }} 
                  mode="date" 
                  error={error.includes("date")}
                />
                {error.includes("date") && <Text style={styles.fieldErrorText}>{error}</Text>}
              </View>
              <View style={styles.col}>
                <Label>Birth Time</Label>
                <DateField 
                  value={form.time} 
                  onChange={(v) => { set("time", v); setError(""); }} 
                  mode="time" 
                  error={error.includes("time")}
                  disabled={form.unknownTime}
                />
                {error.includes("time") && <Text style={styles.fieldErrorText}>{error}</Text>}
              </View>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>I don't know my exact birth time</Text>
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

            <View style={styles.field}>
              <Label>Birth City</Label>
              <CitySearch
                value={form.city}
                birthTimestamp={birthTimestamp}
                onSelect={(picked, err) => { onCitySelected(picked, err); setError(""); }}
                onOpenChange={setSuggestOpen}
                error={error.includes("city")}
              />
              {error.includes("city") && <Text style={styles.fieldErrorText}>{error}</Text>}
            </View>

            <View style={styles.btnRow}>
              <MagicButton 
                onPress={() => setStep(1)} 
                variant="ghost" 
                style={{ flex: 1, marginRight: spacing.sm }}
              >
                Back
              </MagicButton>
              <MagicButton onPress={generate} style={{ flex: 2 }}>
                Reveal My Destiny ↗
              </MagicButton>
            </View>
          </CosmicCard>
        </Animated.View>
      )}
    </ScreenContainer>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.lg,
      marginTop: spacing.xl * 1.5,
    },
    headerTitle: { color: c.primaryLight, fontSize: 24, lineHeight: 32, fontWeight: "800", textAlign: "center" },
    headerSub:   { color: c.textMuted, fontSize: 14, marginTop: 4, textAlign: "center", paddingHorizontal: spacing.md },

    personalizedMsg: {
      color: c.primaryLight,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
      marginBottom: spacing.lg,
      lineHeight: 24,
      paddingHorizontal: spacing.md,
    },

    row:     { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
    col:     { flex: 1, minWidth: 0 },
    field:   { marginBottom: spacing.md },
    btnRow:  { flexDirection: "row", marginTop: spacing.md },

    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
      paddingHorizontal: 2,
    },
    toggleText: {
      color: c.textDim,
      fontSize: 14,
      fontWeight: "500",
    },

    progressTrack: {
      height: 4,
      backgroundColor: c.inputBg,
      borderRadius: 2,
      marginBottom: spacing.lg,
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
      fontSize: 12,
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
      fontSize: 10,
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
