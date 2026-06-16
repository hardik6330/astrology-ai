import React from "react";
import { View, StyleSheet } from "react-native";
import { useStyles } from "../theme/useStyles";
import { radius, shadow, spacing } from "../theme/tokens";

export default function CosmicCard({ style, children, error }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.card, error && styles.errorCard, style]}>
      {children}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.cardBgSolid,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadow.card,
    },
    errorCard: {
      borderColor: c.dangerStrong,
      backgroundColor: "rgba(239, 68, 68, 0.1)",
    },
  });
