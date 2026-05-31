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

export default function CosmicDatePicker({ visible, value, onClose, onSelect, maxDate }) {
  const styles = useStyles(makeStyles);
  const c = useColors();

  const getInitial = () => {
    if (!value) return { y: new Date().getFullYear(), m: new Date().getMonth() + 1, d: new Date().getDate() };
    const [y, m, d] = value.split("-").map(Number);
    return { y, m, d };
  };

  const [date, setDate] = useState(getInitial());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  
  const getDaysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const days = Array.from({ length: getDaysInMonth(date.y, date.m) }, (_, i) => i + 1);

  const handleToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    const formatted = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onSelect(formatted);
    onClose();
  };

  const handleConfirm = () => {
    const formatted = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    onSelect(formatted);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal}>
          <Text style={styles.title}>Birth Date</Text>
          
          <View style={styles.pickerRow}>
            <PickerColumn items={days} current={date.d} onPick={(d) => setDate(prev => ({ ...prev, d }))} flex={0.8} styles={styles} />
            <View style={styles.divider} />
            <PickerColumn items={months} current={date.m} onPick={(m) => setDate(prev => ({ ...prev, m }))} flex={0.8} styles={styles} />
            <View style={styles.divider} />
            <PickerColumn items={years} current={date.y} onPick={(y) => setDate(prev => ({ ...prev, y }))} flex={1.2} styles={styles} />
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.todayBtn} onPress={handleToday}>
              <Text style={styles.todayText}>✨ Today</Text>
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
      paddingHorizontal: 2,
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
    todayBtn: {
      flex: 1,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.primaryBorder,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      alignItems: "center",
    },
    todayText: {
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
