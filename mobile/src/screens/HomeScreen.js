import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import CosmicCard from "../components/CosmicCard";
import MagicButton from "../components/MagicButton";
import MenuButton from "../components/MenuButton";
import { Label, PremiumInput, DateField } from "../components/PremiumInput";
import Picker from "../components/Picker";
import { useChart } from "../context/ChartContext";
import { computeChart, CITIES } from "../shared/astrology";
import { useStyles } from "../theme/useStyles";
import { spacing, fontSize } from "../theme/tokens";

const GENDERS = [
  { label: "— optional —", value: "" },
  { label: "Male",   value: "Male" },
  { label: "Female", value: "Female" },
  { label: "Other",  value: "Other" },
];

const CITY_OPTIONS = CITIES.map((c) => ({ label: c.n, value: c.n }));

export default function HomeScreen({ navigation }) {
  const {
    form, setForm, chart, setChart, resetReading,
    redirectToReading, consumeRedirect,
  } = useChart();
  const [error, setError] = useState("");
  const styles = useStyles(makeStyles);

  // Hide the side-menu trigger on first visit (before any chart exists)
  // so a freshly logged-in user is funnelled into filling the form.
  // Once they have a chart, the menu reappears for navigation.
  const showMenu = !!chart;

  // Returning-user shortcut: if login just reported saved birth details,
  // ChartContext sets a one-shot flag. Bounce straight to Reading and
  // clear the flag so further visits to Home stay on Home.
  React.useEffect(() => {
    if (redirectToReading && chart) {
      consumeRedirect();
      navigation.navigate("Reading", { tab: "reading" });
    }
  }, [redirectToReading, chart, consumeRedirect, navigation]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function generate() {
    if (!form.date || !form.time || !form.city) {
      setError("All fields are required!");
      return;
    }
    setError("");
    const city = CITIES.find((c) => c.n === form.city);
    try {
      const ch = computeChart(form.date, form.time, city);
      setChart(ch);
      resetReading();
      // Funnel through the optional palm-reading step before kundali.
      navigation.navigate("PalmStep");
    } catch (e) {
      setError(e.message || "Could not compute chart.");
    }
  }

  return (
    <ScreenContainer showMenu={false}>
      <View style={styles.headerRow}>
        {showMenu ? <MenuButton /> : <View style={{ width: 40 }} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Discover Your Stars</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            Precision Vedic astrology, powered by AI
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <CosmicCard>
        <View style={styles.row}>
          <View style={styles.col}>
            <Label>Full Name</Label>
            <PremiumInput
              value={form.name}
              onChangeText={(v) => set("name", v)}
              placeholder="Enter your name..."
              autoCapitalize="words"
            />
          </View>
          <View style={styles.col}>
            <Label>Gender</Label>
            <Picker
              value={form.gender}
              onChange={(v) => set("gender", v)}
              options={GENDERS}
              placeholder="— optional —"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Label>Birth Date</Label>
            <DateField value={form.date} onChange={(v) => set("date", v)} mode="date" />
          </View>
          <View style={styles.col}>
            <Label>Birth Time</Label>
            <DateField value={form.time} onChange={(v) => set("time", v)} mode="time" />
          </View>
        </View>

        <View style={styles.field}>
          <Label>Birth City</Label>
          <Picker
            value={form.city}
            onChange={(v) => set("city", v)}
            options={CITY_OPTIONS}
            placeholder="— Select your city —"
          />
        </View>

        <MagicButton onPress={generate} style={{ marginTop: spacing.md }}>
          Reveal My Destiny ↗
        </MagicButton>
      </CosmicCard>

      {error ? (
        <CosmicCard error>
          <Text style={styles.errText}>⚠️ {error}</Text>
        </CosmicCard>
      ) : null}
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
    },
    headerTitle: { color: c.primaryLight, fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" },
    headerSub:   { color: c.textMuted, fontSize: 11, marginTop: 2, textAlign: "center" },

    row:     { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
    col:     { flex: 1, minWidth: 0 },
    field:   { marginBottom: spacing.md },
    errText: { color: c.danger, fontSize: fontSize.sm },
  });
