import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from "react-native";
import { useColors } from "../theme/ThemeContext";
import { useStyles } from "../theme/useStyles";
import { radius, spacing, fontSize } from "../theme/tokens";
import CosmicDatePicker from "./picker/CosmicDatePicker";
import CosmicTimePicker from "./picker/CosmicTimePicker";

export function Label({ children }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.label}>{children}</Text>;
}

export function PremiumInput({ value, onChangeText, placeholder, error, ...rest }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.textMuted}
      style={[styles.input, error && styles.inputError]}
      {...rest}
    />
  );
}

export function DateField({ value, onChange, mode = "date", error, disabled, customStyle }) {
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
    
    // Format date as "January 1, 1995"
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  if (customStyle) {
    return (
      <>
        <Pressable 
          style={[styles.customField, disabled && { opacity: 0.5 }]} 
          onPress={() => !disabled && setShow(true)}
          disabled={disabled}
        >
          <View style={styles.customIconBox}>
            <Text style={styles.customIconText}>
              {mode === "date" ? "📅" : "🕒"}
            </Text>
          </View>
          <View style={styles.customValueBox}>
            <Text style={styles.customValueText}>{displayValue()}</Text>
          </View>
          <Text style={styles.customChevron}>›</Text>
        </Pressable>

        {mode === "date" ? (
          <CosmicDatePicker
            visible={show}
            value={value}
            onClose={() => setShow(false)}
            onSelect={onChange}
          />
        ) : (
          <CosmicTimePicker
            visible={show}
            value={value}
            onClose={() => setShow(false)}
            onSelect={onChange}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Pressable 
        style={[styles.input, error && styles.inputError, disabled && styles.inputDisabled]} 
        onPress={() => !disabled && setShow(true)}
        disabled={disabled}
      >
        <Text style={[value ? styles.inputText : styles.placeholderText, disabled && { color: c.textMuted }]} numberOfLines={1}>
          {displayValue()}
        </Text>
        <Text style={[styles.fieldIcon, disabled && { opacity: 0.3 }]} allowFontScaling={false}>
          {mode === "date" ? "📅" : "🕒"}
        </Text>
      </Pressable>

      {mode === "date" ? (
        <CosmicDatePicker
          visible={show}
          value={value}
          onClose={() => setShow(false)}
          onSelect={onChange}
        />
      ) : (
        <CosmicTimePicker
          visible={show}
          value={value}
          onClose={() => setShow(false)}
          onSelect={onChange}
        />
      )}
    </>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    label: { fontSize: fontSize.xs, color: c.textDim, marginBottom: spacing.xs },
    input: {
      backgroundColor: c.inputBg,
      color: c.text,                 // typed text — white in dark mode, dark in light
      borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 52,
    },
    inputError: {
      borderColor: c.danger,
      backgroundColor: "rgba(248,113,113,0.05)",
    },
    inputDisabled: {
      backgroundColor: "rgba(255,255,255,0.03)",
      borderColor: "rgba(255,255,255,0.05)",
      opacity: 0.6,
    },
    // flexShrink lets a long value truncate instead of shoving the trailing
    // icon out of the field; the icon keeps a fixed slot beside it.
    inputText:       { flexShrink: 1, color: c.text, fontSize: fontSize.sm },
    placeholderText: { flexShrink: 1, color: c.textMuted, fontSize: fontSize.sm },
    fieldIcon:       { marginLeft: spacing.sm, fontSize: 18, lineHeight: 24, color: c.textDim },
    doneBtn:         { alignSelf: "flex-end", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    doneText:        { fontWeight: "600" },

    customField: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      minHeight: 64,
    },
    customIconBox: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    customIconText: {
      fontSize: 22,
      includeFontPadding: false,
      textAlign: "center",
    },
    customValueBox: {
      flex: 1,
    },
    customValueText: {
      fontSize: 17,
      fontWeight: "600",
      color: c.text,
    },
    customChevron: {
      fontSize: 24,
      color: c.textMuted,
      marginLeft: spacing.sm,
    },
  });
