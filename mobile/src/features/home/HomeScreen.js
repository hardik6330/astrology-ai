import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MagicButton from "@/components/MagicButton";
import MenuButton from "@/components/MenuButton";
import { Label, PremiumInput, DateField } from "@/components/PremiumInput";
import Picker from "@/components/Picker";
import CitySearch from "@/features/location/CitySearch";
import { useChart } from "@/context/ChartContext";
import { computeChart } from "@/shared/astrology";
import { useStyles } from "@/theme/useStyles";
import { spacing, fontSize } from "@/theme/tokens";

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
  const [error, setError] = useState("");
  // Freeze the page scroll while the city dropdown is open so the list scrolls.
  const [suggestOpen, setSuggestOpen] = useState(false);
  const styles = useStyles(makeStyles);

  // Hide the side-menu trigger on first visit (before any chart exists)
  // so a freshly logged-in user is funnelled into filling the form.
  // Once they have a chart, the menu reappears for navigation.
  const showMenu = !!chart;

  // Returning-user shortcut: if login (or cold-start hydration) reported
  // saved birth details, ChartContext sets a one-shot flag. Bounce straight
  // to the Kundali tab and clear the flag so later visits to Home stay here.
  React.useEffect(() => {
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

  function generate() {
    if (!form.date || !form.time || !form.city) {
      setError("All fields are required!");
      return;
    }
    if (form.lat == null || form.lon == null || form.tz == null) {
      setError("Please pick your city from the suggestions.");
      return;
    }
    setError("");
    try {
      const ch = computeChart(form.date, form.time, {
        n: form.city, lat: form.lat, lon: form.lon, tz: form.tz,
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
              placeholder="Enter name..."
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
          <CitySearch
            value={form.city}
            birthTimestamp={birthTimestamp}
            onSelect={onCitySelected}
            onOpenChange={setSuggestOpen}
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
