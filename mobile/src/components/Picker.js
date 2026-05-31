import React, { useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet,
} from "react-native";
import { useStyles } from "../theme/useStyles";
import { radius, spacing, fontSize } from "../theme/tokens";

export default function Picker({ value, onChange, options, placeholder }) {
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={{ zIndex: 50 }}>
      <Pressable style={styles.field} onPress={() => setOpen(!open)}>
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder || "— Select —"}
        </Text>
        <Text style={[styles.chevron, open && { transform: [{ rotate: "180deg" }] }]}>▾</Text>
      </Pressable>

      {open && (
        <View style={styles.dropdown}>
          <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
            {options.map((item) => (
              <Pressable
                key={String(item.value)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                  item.value === value && styles.rowActive,
                ]}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.rowText, item.value === value && styles.rowTextActive]}>
                  {item.label}
                </Text>
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
    field: {
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 48,
    },
    value: { color: c.text, fontSize: fontSize.md },
    placeholder: { color: c.textMuted, fontSize: fontSize.md },
    chevron: { color: c.textDim, marginLeft: spacing.sm },

    dropdown: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      marginTop: 8,
      backgroundColor: c.cardBgSolid || "#0f0f18",
      borderWidth: 1,
      borderColor: c.primaryBorder || "#333",
      borderRadius: radius.lg,
      zIndex: 100,
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      overflow: "hidden",
    },
    row: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.cardBorder || "#2a2a3e",
    },
    rowPressed: { backgroundColor: c.primarySoft },
    rowActive: { backgroundColor: c.primarySoft },
    rowText: { color: c.textBody, fontSize: fontSize.md },
    rowTextActive: { color: c.primaryLight, fontWeight: "700" },
  });
