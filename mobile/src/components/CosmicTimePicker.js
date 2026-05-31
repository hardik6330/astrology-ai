import React, { useState } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal, ScrollView,
} from "react-native";
import { useColors } from "../theme/ThemeContext";
import { useStyles } from "../theme/useStyles";
import { radius, spacing, fontSize } from "../theme/tokens";

export default function CosmicTimePicker({ visible, value, onClose, onSelect }) {
  const styles = useStyles(makeStyles);
  const c = useColors();

  // Parse HH:mm to {h, m, ampm}
  const getInitial = () => {
    if (!value) return { h: 12, m: 0, ampm: "AM" };
    const [h24, m] = value.split(":").map(Number);
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    return { h: h12, m, ampm };
  };

  const [time, setTime] = useState(getInitial());

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleNow = () => {
    const now = new Date();
    const h24 = now.getHours();
    const m = now.getMinutes();
    const formatted = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    onSelect(formatted);
    onClose();
  };

  const handleConfirm = () => {
    let h24 = time.h % 12;
    if (time.ampm === "PM") h24 += 12;
    const formatted = `${String(h24).padStart(2, "0")}:${String(time.m).padStart(2, "0")}`;
    onSelect(formatted);
    onClose();
  };

  const Column = ({ items, current, onPick, type }) => (
    <View style={styles.column}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const isSelected = current === item;
          return (
            <Pressable
              key={String(item)}
              onPress={() => onPick(item)}
              style={[styles.item, isSelected && styles.itemSelected]}
            >
              <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                {type === "min" ? String(item).padStart(2, "0") : item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal}>
          <Text style={styles.title}>Birth Time</Text>
          
          <View style={styles.pickerRow}>
            <Column items={hours} current={time.h} onPick={(h) => setTime(prev => ({ ...prev, h }))} />
            <View style={styles.divider} />
            <Column items={minutes} current={time.m} onPick={(m) => setTime(prev => ({ ...prev, m }))} type="min" />
            <View style={styles.divider} />
            <Column items={["AM", "PM"]} current={time.ampm} onPick={(ampm) => setTime(prev => ({ ...prev, ampm }))} />
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.nowBtn} onPress={handleNow}>
              <Text style={styles.nowText}>✨ Now</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirm</Text>
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
      marginBottom: spacing.lg,
    },
    pickerRow: {
      flexDirection: "row",
      height: 200,
      marginBottom: spacing.xl,
    },
    column: {
      flex: 1,
    },
    divider: {
      width: 1,
      backgroundColor: c.cardBorder,
      marginHorizontal: spacing.xs,
    },
    item: {
      paddingVertical: spacing.sm,
      alignItems: "center",
      borderRadius: radius.sm,
    },
    itemSelected: {
      backgroundColor: c.primarySoft,
    },
    itemText: {
      color: c.textDim,
      fontSize: fontSize.md,
    },
    itemTextSelected: {
      color: c.primaryLight,
      fontWeight: "700",
    },
    footer: {
      flexDirection: "row",
      width: "100%",
      gap: spacing.md,
    },
    nowBtn: {
      flex: 1,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.primaryBorder,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      alignItems: "center",
    },
    nowText: {
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
