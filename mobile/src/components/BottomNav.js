import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStyles } from "../theme/useStyles";
import { radius } from "../theme/tokens";
import { haptics } from "../utils/haptics";
import { EMOJIS } from "../utils/emojis";

const TABS = [
  { key: "kundali",  label: "Birth Chart", icon: EMOJIS.KUNDLI,       route: "Reading", params: { tab: "kundali" } },
  { key: "planets",  label: "Planets",     icon: EMOJIS.SATURN,       route: "Reading", params: { tab: "planets" } },
  { key: "timeline", label: "Timeline",    icon: EMOJIS.CLOCK,        route: "Reading", params: { tab: "timeline" } },
  { key: "reading",  label: "Insights",    icon: EMOJIS.SPARKLES,     route: "Reading", params: { tab: "reading" } },
];

export default function BottomNav({ activeKey, navigation, onLocalTab }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);

  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === activeKey));
  const [rowW, setRowW] = useState(0);
  const tabW = rowW / TABS.length;
  const tx = useSharedValue(0);
  const ready = useRef(false);

  // Slide the highlight pill to the active tab. The first placement (once the
  // row width is measured) jumps without animating; subsequent tab changes glide.
  useEffect(() => {
    if (!tabW) return;
    const target = activeIndex * tabW;
    if (!ready.current) {
      tx.value = target;
      ready.current = true;
    } else {
      // Snappy spring glide — quick, smooth settle without overshoot wobble.
      tx.value = withSpring(target, { damping: 26, stiffness: 320, mass: 0.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, tabW]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  function go(tab) {
    haptics.select();
    if (onLocalTab) onLocalTab(tab.key);
    else navigation.navigate("Reading", tab.params);
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        <View style={styles.row} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
          {tabW > 0 && <Animated.View style={[styles.pill, pillStyle, { width: tabW }]} />}
          {TABS.map((tab) => {
            const active = activeKey === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => go(tab)} style={styles.btn}>
                <Text style={styles.icon}>{tab.icon}</Text>
                <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: { position: "absolute", left: 12, right: 12, alignItems: "center" },
    bar: {
      width: "100%", maxWidth: 480,
      padding: 6, borderRadius: radius.xl,
      backgroundColor: c.cardBgSolid,
      borderWidth: 1, borderColor: c.accentBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4, shadowRadius: 18,
      elevation: 12,
    },
    row: { flexDirection: "row", position: "relative" },
    // The sliding highlight — absolute so it never affects layout; stretches to
    // the row height and one tab wide, glided into place by translateX.
    pill: {
      position: "absolute", top: 0, bottom: 0, left: 0,
      borderRadius: 13, borderWidth: 1,
      backgroundColor: c.primarySoft, borderColor: c.primaryBorder,
    },
    btn: {
      flex: 1, alignItems: "center",
      paddingVertical: 7, paddingHorizontal: 2,
      borderRadius: 13, borderWidth: 1, borderColor: "transparent",
    },
    icon:        { fontSize: 17, lineHeight: 22 },
    label:       { fontSize: 10, color: c.textMuted, fontWeight: "600", marginTop: 2 },
    labelActive: { color: c.primaryLight },
  });
