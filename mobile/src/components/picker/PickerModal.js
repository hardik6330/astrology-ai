import React from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { useStyles } from "../../theme/useStyles";
import { radius, spacing, fontSize } from "../../theme/tokens";

// Shared modal shell for the date + time pickers: dimmed overlay, titled card,
// a row of wheel columns (passed as children), and a footer with a secondary
// action (Today / Now) plus Confirm. Tapping the overlay closes; taps inside
// the card are swallowed by the inner Pressable.
export default function PickerModal({
  visible, title, onClose, secondaryLabel, onSecondary, onConfirm, children,
}) {
  const s = useStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.modal}>
          <Text style={s.title}>{title}</Text>

          <View style={s.pickerRow}>{children}</View>

          <View style={s.footer}>
            <Pressable style={s.secondaryBtn} onPress={onSecondary}>
              <Text style={s.secondaryText}>{secondaryLabel}</Text>
            </Pressable>
            <Pressable style={s.confirmBtn} onPress={onConfirm}>
              <Text style={s.confirmText}>Confirm</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    modal: {
      backgroundColor: c.cardBgSolid,
      width: "100%",
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: c.primaryBorder,
      alignItems: "center",
    },
    title: {
      color: c.primaryLight,
      fontSize: fontSize.lg,
      fontWeight: "700",
      marginBottom: spacing.md,
    },
    pickerRow: {
      flexDirection: "row",
      height: 200, // must match PickerColumn's VISIBLE_HEIGHT
      marginBottom: spacing.xl,
    },
    footer: {
      flexDirection: "row",
      width: "100%",
      gap: spacing.md,
    },
    secondaryBtn: {
      flex: 1,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.primaryBorder,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      alignItems: "center",
    },
    secondaryText: {
      color: c.primaryLight,
      fontSize: fontSize.md,
      fontWeight: "700",
    },
    confirmBtn: {
      flex: 1,
      backgroundColor: c.primary,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      alignItems: "center",
    },
    confirmText: {
      color: "#fff",
      fontSize: fontSize.md,
      fontWeight: "700",
    },
  });
