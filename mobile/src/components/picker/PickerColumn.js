import React, { useRef } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useStyles } from "../../theme/useStyles";
import { radius, fontSize } from "../../theme/tokens";

// Fixed row height lets us deterministically center the selected value when the
// picker opens. VISIBLE_HEIGHT must match PickerModal's pickerRow height.
export const ITEM_HEIGHT = 40;
export const VISIBLE_HEIGHT = 200;

// One scrollable wheel column, shared by the date + time pickers. Defined as a
// stable module-level component so React reconciles in place on every pick —
// inlining it would remount the ScrollView and snap the wheel back to the top.
export function PickerColumn({ items, current, onPick, flex = 1, format }) {
  const s = useStyles(makeStyles);
  const ref = useRef(null);
  const didInit = useRef(false);
  const centerSelected = (animated) => {
    const idx = items.indexOf(current);
    if (idx < 0 || !ref.current) return;
    const y = Math.max(0, idx * ITEM_HEIGHT - (VISIBLE_HEIGHT - ITEM_HEIGHT) / 2);
    ref.current.scrollTo({ y, animated });
  };
  return (
    <View style={[s.column, { flex }]}>
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
              style={[s.item, isSelected && s.itemSelected]}
            >
              <Text style={[s.itemText, isSelected && s.itemTextSelected]}>
                {format ? format(item) : item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Thin vertical rule rendered between columns.
export function Divider() {
  const s = useStyles(makeStyles);
  return <View style={s.divider} />;
}

const makeStyles = (c) =>
  StyleSheet.create({
    column: {
      paddingHorizontal: 2,
    },
    divider: {
      width: 1,
      backgroundColor: c.cardBorder,
      marginHorizontal: 4,
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
  });
