import React, { useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal, ScrollView,
} from "react-native";
import { useColors } from "../theme/ThemeContext";
import { useStyles } from "../theme/useStyles";
import { radius, spacing, fontSize } from "../theme/tokens";

// Fixed row height lets us deterministically center the selected value when the
// picker opens.
const ITEM_HEIGHT = 40;
const VISIBLE_HEIGHT = 200; // must match styles.pickerRow height

// Defined at MODULE scope (not inside the component) so its identity is stable
// across re-renders. Inlining it made React remount the ScrollView on every
// selection, snapping the wheel back to the top instead of holding position.
function PickerColumn({ items, current, onPick, styles, flex = 1, format }) {
  const ref = useRef(null);
  const didInit = useRef(false);
  const centerSelected = (animated) => {
    const idx = items.indexOf(current);
    if (idx < 0 || !ref.current) return;
    const y = Math.max(0, idx * ITEM_HEIGHT - (VISIBLE_HEIGHT - ITEM_HEIGHT) / 2);
    ref.current.scrollTo({ y, animated });
  };
  return (
    <View style={[styles.column, { flex }]}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (didInit.current) return;
          didInit.current = true;       // one-shot: only on open, not on every pick
          centerSelected(false);
        }}
      >
        {items.map((item) => {
          const isSelected = current === item;
          return (
            <Pressable
              key={String(item)}
              onPress={() => onPick(item)}
              style={[styles.item, isSelected && styles.itemSelected]}
            >
              <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                {format ? format(item) : item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal}>
          <Text style={styles.title}>Birth Time</Text>
          
          <View style={styles.pickerRow}>
            <PickerColumn items={hours} current={time.h} onPick={(h) => setTime(prev => ({ ...prev, h }))} styles={styles} />
            <View style={styles.divider} />
            <PickerColumn items={minutes} current={time.m} onPick={(m) => setTime(prev => ({ ...prev, m }))} format={(i) => String(i).padStart(2, "0")} styles={styles} />
            <View style={styles.divider} />
            <PickerColumn items={["AM", "PM"]} current={time.ampm} onPick={(ampm) => setTime(prev => ({ ...prev, ampm }))} styles={styles} />
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
      height: ITEM_HEIGHT,
      justifyContent: "center",
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
