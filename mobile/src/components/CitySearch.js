import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { PremiumInput } from "./PremiumInput";
import { useColors } from "../theme/ThemeContext";
import { useStyles } from "../theme/useStyles";
import { spacing, fontSize, radius } from "../theme/tokens";
import { searchCities, getCityDetails } from "../services/api";

// Lightweight UUID — RN runtime doesn't ship crypto.randomUUID on all
// versions, so use a deterministic fallback.
function makeSessionToken() {
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Mobile mirror of frontend/src/components/CitySearch.jsx. Debounced
// autocomplete → backend proxy → select → onSelect({city, lat, lon, tz, ...}).
export default function CitySearch({ value, onSelect, birthTimestamp, placeholder = "Search your birth city..." }) {
  const [input, setInput] = useState(value || "");
  const [predictions, setPredictions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionTokenRef = useRef(makeSessionToken());
  const styles = useStyles(makeStyles);

  useEffect(() => {
    setInput(value || "");
  }, [value]);

  useEffect(() => {
    const q = input.trim();
    if (q.length < 2) { setPredictions([]); return; }
    if (q === (value || "").trim()) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchCities(q, sessionTokenRef.current);
        setPredictions(res);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [input, value]);

  async function pick(prediction) {
    setOpen(false);
    setInput(prediction.description);
    try {
      const details = await getCityDetails(
        prediction.placeId,
        sessionTokenRef.current,
        birthTimestamp,
      );
      sessionTokenRef.current = makeSessionToken();
      onSelect({
        city:    details.searchName,
        lat:     details.coordinates.lat,
        lon:     details.coordinates.lng,
        tz:      details.timezone.offset,
        tzId:    details.timezone.id,
        placeId: details.placeId,
      });
    } catch (err) {
      onSelect(null, err.message || "Location lookup failed");
    }
  }

  return (
    <View style={{ position: "relative" }}>
      <PremiumInput
        value={input}
        onChangeText={setInput}
        placeholder={placeholder}
        autoCapitalize="words"
        autoCorrect={false}
      />
      {open && (loading || predictions.length > 0) && (
        <View style={styles.dropdown}>
          {loading && (
            <View style={styles.hintRow}>
              <ActivityIndicator size="small" />
              <Text style={styles.hint}>Searching…</Text>
            </View>
          )}
          <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
            {predictions.map((item) => (
              <Pressable key={item.placeId} style={styles.item} onPress={() => pick(item)}>
                <Text style={styles.mainText} numberOfLines={1}>
                  {item.mainText || item.description}
                </Text>
                {item.secondaryText ? (
                  <Text style={styles.subText} numberOfLines={1}>
                    {item.secondaryText}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    dropdown: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      marginTop: 4,
      backgroundColor: c.cardBgSolid || "#0f0f18",
      borderWidth: 1,
      borderColor: c.cardBorder || "#333",
      borderRadius: radius.md,
      maxHeight: 240,
      zIndex: 100,
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    item: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.cardBorder || "#2a2a3e",
    },
    mainText: { color: c.text || "#fff", fontSize: fontSize.md },
    subText:  { color: c.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    hintRow:  { flexDirection: "row", alignItems: "center", padding: spacing.sm, gap: spacing.sm },
    hint:     { color: c.textMuted, fontSize: fontSize.sm },
  });
