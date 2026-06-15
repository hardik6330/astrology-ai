import React from "react";
import { View, Text, StyleSheet } from "react-native";
import CosmicCard from "../../components/CosmicCard";
import { useStyles } from "../../theme/useStyles";
import { radius, spacing, fontSize } from "../../theme/tokens";

// Pill colour by dosha state.
function pillTone(state, colors) {
  switch (state) {
    case "good":     return { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.45)",  fg: colors.success };
    case "warn":     return { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.45)", fg: colors.warning };
    case "bad":      return { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.45)",  fg: colors.danger };
    default:         return { bg: colors.inputBg,           border: colors.cardBorder,       fg: colors.textDim };
  }
}

function Row({ title, badge, state, detail, styles, colors }) {
  const tone = pillTone(state, colors);
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowTitle}>{title}</Text>
        <View style={[styles.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text style={[styles.pillText, { color: tone.fg }]}>{badge}</Text>
        </View>
      </View>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
    </View>
  );
}

export default function DoshaCard({ doshas, colors }) {
  const styles = useStyles(makeStyles);
  if (!doshas) return null;

  const mangalState =
    doshas.mangal.level === "None" || doshas.mangal.level === "Cancelled" ? "good"
    : doshas.mangal.level === "Mild" ? "warn"
    : "bad";

  const kaalSarpState = doshas.kaalSarp.present ? "bad" : "good";
  const pitraState    = doshas.pitra.present    ? "warn" : "good";
  const sadeState     = doshas.sadeSati.active  ? "warn" : "good";

  return (
    <CosmicCard>
      <Text style={styles.title}>Afflictions & Combinations</Text>
      <Text style={styles.sub}>Live readings of major astrological conditions.</Text>

      <Row title="Mars Affliction"  badge={doshas.mangal.level}                state={mangalState}   detail={doshas.mangal.detail}    styles={styles} colors={colors} />
      <Row title="Nodal Affliction" badge={doshas.kaalSarp.present ? "Active" : "Free"} state={kaalSarpState} detail={doshas.kaalSarp.detail} styles={styles} colors={colors} />
      <Row title="Ancestral Affliction" badge={doshas.pitra.present    ? "Active" : "Free"} state={pitraState}    detail={doshas.pitra.detail}    styles={styles} colors={colors} />
      <Row title="Saturn Cycle"     badge={doshas.sadeSati.active  ? doshas.sadeSati.phase.split(" ")[0] : "Free"} state={sadeState} detail={doshas.sadeSati.detail} styles={styles} colors={colors} />
    </CosmicCard>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
    sub:   { color: c.textMuted, fontSize: 11, marginBottom: spacing.md },

    row: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.cardBorder,
    },
    rowHead:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    rowTitle:  { color: c.textBody, fontSize: 13, fontWeight: "600" },
    rowDetail: { color: c.textDim, fontSize: 11.5, lineHeight: 17, marginTop: 4 },

    pill: {
      borderWidth: 1, borderRadius: radius.pill,
      paddingHorizontal: 10, paddingVertical: 3,
    },
    pillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  });
