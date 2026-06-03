import React from "react";
import { View, Text, StyleSheet } from "react-native";
import CosmicCard from "./CosmicCard";
import MagicButton from "./MagicButton";
import { useCredits } from "../hooks/useCredits";
import { useColors } from "../theme/ThemeContext";
import { useStyles } from "../theme/useStyles";
import { spacing } from "../theme/tokens";

// Prominent "not enough credits" card — shown whenever a charged AI action is
// rejected with INSUFFICIENT_CREDITS (palm / insights / daily / chat). Reads
// the live balance so the user sees exactly how short they are. `onTopUp`
// navigates to the Profile screen (where the balance + top-up live).
export default function LowCreditsCard({ cost, action = "This reading", onTopUp }) {
  const credits = useCredits();
  const c = useColors();
  const s = useStyles(makeStyles);
  return (
    <CosmicCard style={s.card}>
      <Text style={styles.icon}>✨</Text>
      <Text style={[s.title, { color: c.danger }]}>Not enough credits</Text>
      <Text style={s.body}>
        {action} costs {cost} credits
        {credits != null ? ` — you have ${credits}` : ""}. Top up to continue.
      </Text>
      <MagicButton style={{ width: "100%", marginTop: spacing.sm }} onPress={onTopUp}>
        View Credits
      </MagicButton>
    </CosmicCard>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 34, lineHeight: 44, textAlign: "center", marginBottom: 6 },
});

const makeStyles = (c) =>
  StyleSheet.create({
    card: {
      alignItems: "center",
      borderColor: "rgba(248,113,113,0.45)",
      backgroundColor: "rgba(248,113,113,0.08)",
    },
    title: { fontSize: 15, fontWeight: "700", marginBottom: 6, textAlign: "center" },
    body: {
      color: c.textBody,
      fontSize: 12.5,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: 4,
    },
  });
