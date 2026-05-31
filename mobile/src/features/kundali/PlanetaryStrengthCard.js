import React from "react";
import { View, Text, StyleSheet } from "react-native";
import CosmicCard from "./CosmicCard";
import { useStyles } from "../theme/useStyles";
import { useColors } from "../theme/ThemeContext";
import { radius, spacing, fontSize } from "../theme/tokens";

function barColor(score, c) {
  if (score >= 75) return c.success;
  if (score >= 50) return c.primaryLight;
  if (score >= 30) return c.warning;
  return c.danger;
}

export default function PlanetaryStrengthCard({ strengths }) {
  const styles = useStyles(makeStyles);
  const c = useColors();
  if (!strengths || !strengths.length) return null;

  return (
    <CosmicCard>
      <Text style={styles.title}>Planetary Strength Meter</Text>
      <Text style={styles.sub}>Each planet rated 0–100 from dignity, house and motion.</Text>

      {strengths.map((s) => {
        const col = barColor(s.score, c);
        return (
          <View key={s.planet} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.planet}>
                {s.planet}{s.retro ? <Text style={styles.retro}>  ℞</Text> : null}
              </Text>
              <Text style={styles.meta}>
                {s.label}{s.house ? ` · H${s.house}` : ""}
              </Text>
              <Text style={[styles.score, { color: col }]}>{s.score}</Text>
            </View>
            <View style={styles.track}>
              <View style={{ width: `${s.score}%`, height: "100%", backgroundColor: col, borderRadius: radius.pill }} />
            </View>
          </View>
        );
      })}
    </CosmicCard>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
    sub:   { color: c.textMuted, fontSize: 11, marginBottom: spacing.md },

    row:     { marginBottom: 12 },
    rowHead: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
    planet:  { color: c.textBody, fontSize: 12.5, fontWeight: "600", width: 80 },
    retro:   { color: c.danger, fontSize: 11 },
    meta:    { flex: 1, color: c.textMuted, fontSize: 10.5 },
    score:   { fontSize: 12, fontWeight: "700" },
    track:   { height: 7, backgroundColor: c.inputBg, borderRadius: radius.pill, overflow: "hidden" },
  });
