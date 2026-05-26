import React, { useState } from "react";
import {
  View, Text, Pressable, Modal, FlatList, StyleSheet, SafeAreaView,
} from "react-native";
import { useStyles } from "../theme/useStyles";
import { radius, spacing, fontSize } from "../theme/tokens";

export default function Picker({ value, onChange, options, placeholder }) {
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder || "— Select —"}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal animationType="slide" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <SafeAreaView>
              <View style={styles.handle} />
              <FlatList
                data={options}
                keyExtractor={(o) => String(o.value)}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.rowPressed,
                      item.value === value && styles.rowActive,
                    ]}
                    onPress={() => { onChange(item.value); setOpen(false); }}
                  >
                    <Text style={[styles.rowText, item.value === value && styles.rowTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                )}
                style={{ maxHeight: 420 }}
              />
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    field: {
      backgroundColor: c.inputBg,
      borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      minHeight: 48,
    },
    value:       { color: c.text, fontSize: fontSize.md },
    placeholder: { color: c.textMuted, fontSize: fontSize.md },
    chevron:     { color: c.textDim, marginLeft: spacing.sm },

    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.cardBgSolid,
      borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      paddingBottom: spacing.lg,
    },
    handle: { width: 40, height: 4, backgroundColor: c.textFaint, borderRadius: 2, alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.sm },
    row: {
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
    },
    rowPressed:    { backgroundColor: c.primarySoft },
    rowActive:     { backgroundColor: c.primarySoft },
    rowText:       { color: c.textBody, fontSize: fontSize.md },
    rowTextActive: { color: c.primaryLight, fontWeight: "700" },
  });
