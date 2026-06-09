import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, Easing } from "react-native";
import { useStyles } from "../theme/useStyles";
import { useColors } from "../theme/ThemeContext";
import { radius, spacing } from "../theme/tokens";

export default function Skeleton({ width = "100%", height = 14, style, radius: r = 6 }) {
  const c = useColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  // Block color picks up a subtle shade of the current text-faint hue.
  const blockColor = c.text === "#ffffff"
    ? "rgba(255,255,255,0.06)"
    : "rgba(15,23,42,0.07)";

  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, backgroundColor: blockColor, opacity }, style]}
    />
  );
}

export function SkeletonReading() {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View>
      <View style={{ alignItems: "center", marginBottom: spacing.md }}>
        <Skeleton width={180} height={14} />
        <Skeleton width={220} height={11} style={{ marginTop: 6 }} />
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.card, { flex: 1, alignItems: "center", marginBottom: 0, paddingVertical: spacing.lg }]}>
            <Skeleton width={32} height={32} r={16} />
            <Skeleton width={60} height={10} style={{ marginTop: 10 }} />
            <Skeleton width={80} height={12} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Skeleton width={160} height={14} />
        <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.md }}>
          {[0, 1, 2, 3, 4].map((i) => (<Skeleton key={i} width={50} height={56} r={12} />))}
        </View>
        <Skeleton width={140} height={28} style={{ marginTop: spacing.md }} />
        <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
        <Skeleton width="60%" height={12} style={{ marginTop: 6 }} />
      </View>
      <View style={styles.card}>
        <Skeleton width={140} height={14} />
        <Skeleton width="100%" height={280} r={radius.md} style={{ marginTop: spacing.md }} />
      </View>
      <View style={styles.card}>
        <Skeleton width={140} height={14} style={{ marginBottom: spacing.md }} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Skeleton width={120} height={10} />
              <Skeleton width={40} height={10} />
            </View>
            <Skeleton width="100%" height={6} r={radius.pill} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SkeletonAIReading() {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View>
      <View style={[styles.blueprintPlaceholder]}>
        <Skeleton width={150} height={12} />
        <Skeleton width="90%" height={18} style={{ marginTop: 14 }} />
        <Skeleton width="70%" height={18} style={{ marginTop: 8 }} />
      </View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Skeleton width={28} height={28} r={14} />
            <Skeleton width={160} height={14} style={{ marginLeft: 10 }} />
          </View>
          <Skeleton width="100%" height={12} />
          <Skeleton width="95%" height={12} style={{ marginTop: 6 }} />
          <Skeleton width="80%" height={12} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonChat() {
  return (
    <View style={{ padding: spacing.lg, gap: 14 }}>
      {[
        { right: false, w: "75%" }, { right: true,  w: "55%" },
        { right: false, w: "85%" }, { right: true,  w: "40%" },
        { right: false, w: "70%" },
      ].map((m, i) => (
        <View key={i} style={{ flexDirection: m.right ? "row-reverse" : "row", alignItems: "flex-start", gap: 8 }}>
          <Skeleton width={32} height={32} r={16} />
          <Skeleton width={m.w} height={40} r={14} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonPalm() {
  const styles = useStyles(makeStyles);
  return (
    <View>
      <View style={{ alignItems: "center", marginBottom: spacing.md }}>
        <Skeleton width={180} height={14} />
        <Skeleton width={240} height={11} style={{ marginTop: 6 }} />
      </View>
      <View style={[styles.card, { alignItems: "center", padding: spacing.xl }]}>
        <Skeleton width={70} height={70} r={35} />
        <Skeleton width={140} height={16} style={{ marginTop: 14 }} />
        <Skeleton width="90%" height={11} style={{ marginTop: 10 }} />
        <Skeleton width="70%" height={11} style={{ marginTop: 6 }} />
        <Skeleton width="100%" height={48} r={radius.md} style={{ marginTop: spacing.lg }} />
        <Skeleton width="100%" height={48} r={radius.md} style={{ marginTop: spacing.sm }} />
      </View>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.cardBgSolid,
      borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md,
    },
    blueprintPlaceholder: {
      backgroundColor: c.primarySoft,
      borderWidth: 1, borderColor: c.primaryBorder,
      borderRadius: radius.xl, padding: spacing.xl,
      marginBottom: spacing.md, alignItems: "center",
    },
  });
