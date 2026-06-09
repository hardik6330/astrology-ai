import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles } from "../theme/useStyles";
import { radius } from "../theme/tokens";
import { haptics } from "../utils/haptics";

const TABS = [
  { key: "kundali",  label: "Birth Chart", icon: "🔯", route: "Reading", params: { tab: "kundali" } },
  { key: "planets",  label: "Planets",  icon: "🪐", route: "Reading", params: { tab: "planets" } },
  { key: "timeline", label: "Timeline", icon: "🕒", route: "Reading", params: { tab: "timeline" } },
  { key: "reading",  label: "Insights", icon: "✨", route: "Reading", params: { tab: "reading" } },
];

export default function BottomNav({ activeKey, navigation, onLocalTab }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);

  function go(tab) {
    haptics.select();
    if (onLocalTab) onLocalTab(tab.key);
    else navigation.navigate("Reading", tab.params);
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const active = activeKey === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => go(tab)} style={[styles.btn, active && styles.btnActive]}>
              <Text style={styles.icon}>{tab.icon}</Text>
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: { position: "absolute", left: 12, right: 12, alignItems: "center" },
    bar: {
      width: "100%", maxWidth: 480,
      flexDirection: "row", justifyContent: "space-between",
      padding: 6, borderRadius: radius.xl,
      backgroundColor: c.cardBgSolid,
      borderWidth: 1, borderColor: c.accentBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4, shadowRadius: 18,
      elevation: 12,
    },
    btn: {
      flex: 1, alignItems: "center",
      paddingVertical: 7, paddingHorizontal: 2,
      borderRadius: 13, borderWidth: 1, borderColor: "transparent",
    },
    btnActive: { backgroundColor: c.primarySoft, borderColor: c.primaryBorder },
    icon:        { fontSize: 17, lineHeight: 22 },
    label:       { fontSize: 10, color: c.textMuted, fontWeight: "600", marginTop: 2 },
    labelActive: { color: c.primaryLight },
  });
