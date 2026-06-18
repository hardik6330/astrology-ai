// Searchable country-code selector for the login screen. Shows the selected
// country's flag + "+<dial>"; tapping opens a modal with a search box that
// filters by country name or dial code (e.g. "india" → 🇮🇳 +91). Twin of the
// web CountrySelect.jsx — both read the shared COUNTRIES list from dialCode.
// NOTE: Android lacks flag-emoji glyphs, so the flag renders as the ISO letters
// there (e.g. "IN") — still a useful, recognizable fallback.

import React, { useMemo, useState } from "react";
import {
  View, Text, TextInput, Pressable, Modal, FlatList, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COUNTRIES } from "@/utils/dialCode";
import { useTheme } from "@/theme/ThemeContext";
import { useStyles } from "@/theme/useStyles";
import { spacing } from "@/theme/tokens";

export default function CountrySelect({ value, onChange, disabled }) {
  const { colors: color } = useTheme();
  const s = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // The country whose dial code matches the current value (alphabetical first
  // match, so shared codes like "1" resolve deterministically).
  const selected = useMemo(() => {
    const code = String(value || "").replace(/\D/g, "");
    if (!code) return null;
    return COUNTRIES.filter((c) => c.dial === code)[0] || null;
  }, [value]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const digits = q.replace(/\D/g, "");
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase() === q ||
        (digits && c.dial.startsWith(digits)),
    );
  }, [query]);

  function pick(c) {
    onChange(c.dial);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={s.trigger}
        disabled={disabled}
      >
        <Text style={s.flag}>{selected ? selected.flag : "🌐"}</Text>
        <Text style={s.dial}>+{value || "?"}</Text>
        <Text style={s.caret}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
        <SafeAreaView style={s.sheet} edges={["bottom"]}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Select country</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search country…"
            placeholderTextColor={color.textMuted}
            style={s.search}
            autoFocus
          />
          <FlatList
            data={results}
            keyExtractor={(c) => c.iso}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            ListEmptyComponent={<Text style={s.empty}>No matches</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item)}
                style={[s.row, selected?.iso === item.iso && s.rowActive]}
              >
                <Text style={s.rowFlag}>{item.flag}</Text>
                <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.rowDial}>+{item.dial}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const makeStyles = (c) => StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", paddingVertical: 18, paddingRight: 4 },
  // Generous lineHeight + no font padding so the flag/glyph isn't clipped on Android.
  flag: { fontSize: 18, lineHeight: 24, includeFontPadding: false, marginRight: 6 },
  dial: { color: c.text, fontSize: 17, fontWeight: "700" },
  caret: { color: c.textDim, fontSize: 12, marginLeft: 4 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    maxHeight: "75%",
    backgroundColor: c.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: c.cardBorder,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.cardBorder, alignSelf: "center", marginBottom: 12,
  },
  sheetTitle: { color: c.text, fontSize: 18, fontWeight: "800", marginBottom: 12 },
  search: {
    backgroundColor: c.inputBg,
    borderWidth: 1.5,
    borderColor: c.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: c.text,
    fontSize: 15,
    marginBottom: 8,
  },
  empty: { color: c.textDim, textAlign: "center", paddingVertical: 24, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.cardBorder,
  },
  rowActive: { backgroundColor: c.theme === "dark" ? "rgba(168,85,247,0.12)" : "rgba(124,58,237,0.06)" },
  rowFlag: { fontSize: 20, lineHeight: 26, includeFontPadding: false, marginRight: 12 },
  rowName: { flex: 1, color: c.text, fontSize: 15, fontWeight: "600" },
  rowDial: { color: c.textDim, fontSize: 14, fontWeight: "700" },
});
