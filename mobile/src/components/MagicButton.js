import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { useStyles } from "../theme/useStyles";
import { useColors } from "../theme/ThemeContext";
import { radius, spacing, fontSize, shadow } from "../theme/tokens";
import { haptics } from "../utils/haptics";

export default function MagicButton({
  onPress, children, loading, disabled, variant = "primary", style,
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={(e) => { haptics.tap(); onPress?.(e); }}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.btn,
        isPrimary ? styles.primary : styles.ghost,
        (loading || disabled) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={isPrimary ? "#fff" : c.primaryLight}
            style={{ marginRight: spacing.sm }}
          />
        )}
        <Text style={[styles.label, !isPrimary && styles.labelGhost]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    btn: {
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
    },
    primary: {
      backgroundColor: c.primary,
      ...shadow.magic,
    },
    ghost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.primaryBorder,
    },
    disabled: { opacity: 0.55 },
    pressed:  { opacity: 0.85, transform: [{ scale: 0.98 }] },
    content:  { flexDirection: "row", alignItems: "center" },
    label: {
      color: "#fff",
      fontWeight: "700",
      fontSize: fontSize.sm,
      letterSpacing: 0.3,
    },
    labelGhost: { color: c.primaryLight },
  });
