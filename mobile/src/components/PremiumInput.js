import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColors } from "../theme/ThemeContext";
import { useStyles } from "../theme/useStyles";
import { radius, spacing, fontSize } from "../theme/tokens";

export function Label({ children }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.label}>{children}</Text>;
}

export function PremiumInput({ value, onChangeText, placeholder, ...rest }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.textMuted}
      style={styles.input}
      {...rest}
    />
  );
}

export function DateField({ value, onChange, mode = "date" }) {
  const styles = useStyles(makeStyles);
  const c = useColors();
  const [show, setShow] = useState(false);

  function toDate() {
    if (mode === "date") {
      if (!value) return new Date(2000, 0, 1);
      const [y, m, d] = value.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date();
    if (value) {
      const [h, m] = value.split(":").map(Number);
      d.setHours(h, m, 0, 0);
    }
    return d;
  }
  function format(d) {
    if (mode === "date") {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  function onPick(event, picked) {
    if (Platform.OS !== "ios") setShow(false);
    if (event?.type === "dismissed" || !picked) return;
    onChange(format(picked));
  }

  function displayValue() {
    if (!value) return mode === "date" ? "Select date" : "Select time";
    if (mode === "time") {
      const [h24, m] = value.split(":").map((x, i) => (i === 0 ? Number(x) : String(x).padStart(2, "0")));
      const ap = h24 >= 12 ? "PM" : "AM";
      const h12 = ((h24 + 11) % 12) + 1;
      return `${h12}:${m} ${ap}`;
    }
    return value;
  }

  return (
    <>
      <Pressable style={styles.input} onPress={() => setShow(true)}>
        <Text style={value ? styles.inputText : styles.placeholderText}>
          {displayValue()}
        </Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={toDate()}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPick}
          maximumDate={mode === "date" ? new Date() : undefined}
        />
      )}
      {Platform.OS === "ios" && show && (
        <Pressable onPress={() => setShow(false)} style={styles.doneBtn}>
          <Text style={[styles.doneText, { color: c.primaryLight }]}>Done</Text>
        </Pressable>
      )}
    </>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    label: { fontSize: fontSize.xs, color: c.textDim, marginBottom: spacing.xs },
    input: {
      backgroundColor: c.inputBg,
      borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      color: c.text, fontSize: fontSize.md, minHeight: 48,
    },
    inputText:       { color: c.text, fontSize: fontSize.md },
    placeholderText: { color: c.textMuted, fontSize: fontSize.md },
    doneBtn:         { alignSelf: "flex-end", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    doneText:        { fontWeight: "600" },
  });
