import React from "react";
import { View, Text, StyleSheet } from "react-native";
import CosmicCard from "../../components/CosmicCard";
import { useStyles } from "../../theme/useStyles";
import { radius, spacing, fontSize } from "../../theme/tokens";
import { STRINGS } from "../../shared/uiStrings";
import { tithiEnglish } from "../../shared/panchangText";

export default function PanchangCard({ panchang }) {
  const styles = useStyles(makeStyles);
  if (!panchang) return null;

  const items = [
    [STRINGS.PANCHANG.TITHI,     tithiEnglish(panchang.tithi)],
    [STRINGS.PANCHANG.NAKSHATRA, `${panchang.nakshatra} · Quarter ${panchang.pada}`],
    [STRINGS.PANCHANG.YOGA,      panchang.yoga],
    [STRINGS.PANCHANG.KARANA,    panchang.karana],
    [STRINGS.PANCHANG.VAARA,     panchang.vaara],
  ];

  return (
    <CosmicCard>
      <Text style={styles.title}>{STRINGS.PANCHANG.TITLE}</Text>
      <Text style={styles.sub}>{STRINGS.PANCHANG.SUBTITLE}</Text>

      <View style={styles.grid}>
        {items.map(([k, v]) => (
          <View key={k} style={styles.cell}>
            <Text style={styles.label}>{k}</Text>
            <Text style={styles.value} numberOfLines={2}>{v}</Text>
          </View>
        ))}
      </View>
    </CosmicCard>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
    sub:   { color: c.textMuted, fontSize: 11, marginBottom: spacing.md },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    cell: {
      flexBasis: "47%", flexGrow: 1,
      backgroundColor: c.inputBg,
      borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: 10,
    },
    label: { color: c.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
    value: { color: c.text, fontSize: 13, fontWeight: "700", marginTop: 3 },
  });
