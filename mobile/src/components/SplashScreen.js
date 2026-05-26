import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Animated, Easing, StyleSheet, Dimensions,
} from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle, G, Path } from "react-native-svg";
import { useStyles } from "../theme/useStyles";
import { useColors } from "../theme/ThemeContext";
import { spacing } from "../theme/tokens";

const LINES = [
  "Aligning the stars…",
  "Reading the ephemeris…",
  "Casting your celestial map…",
  "Tuning the cosmic frequencies…",
  "Channeling the planetary winds…",
];

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * Animated splash screen.
 * - Logo pulses and rotates slowly
 * - Tagline cycles every ~1.4s
 * - Auto-dismisses after `duration` ms via `onDone`
 */
export default function SplashScreen({ onDone, duration = 2400 }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [lineIdx, setLineIdx] = useState(0);

  const pulse  = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const fade   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade-in
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();

    // Pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Slow rotation (orbital)
    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Cycle taglines
    const lineTimer = setInterval(() => setLineIdx((i) => (i + 1) % LINES.length), 1400);

    // Auto-dismiss
    const done = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone?.());
    }, duration);

    return () => {
      clearInterval(lineTimer);
      clearTimeout(done);
    };
  }, [duration, onDone, fade, pulse, rotate]);

  const scale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const glow    = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const rotateZ = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View style={[styles.wrap, { opacity: fade }]}>
      <Animated.View style={[styles.logoWrap, { transform: [{ scale }] }]}>
        {/* Glow ring */}
        <Animated.View
          style={[
            styles.glow,
            {
              opacity: glow,
              shadowColor: colors.primary,
            },
          ]}
        />

        {/* Rotating SVG logo */}
        <Animated.View style={{ transform: [{ rotate: rotateZ }] }}>
          <Svg width={120} height={120} viewBox="0 0 120 120">
            <Defs>
              <RadialGradient id="g" cx="60" cy="60" r="60" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0.9" />
                <Stop offset="1" stopColor={colors.accent}  stopOpacity="0.2" />
              </RadialGradient>
            </Defs>
            <Circle cx="60" cy="60" r="44" fill="url(#g)" />
            {/* 12-pointed star ring */}
            <G stroke={colors.primaryLight} strokeWidth="1.4" opacity="0.9">
              {[...Array(12)].map((_, i) => {
                const a = (i * Math.PI) / 6;
                return (
                  <Path
                    key={i}
                    d={`M${60 + Math.cos(a) * 48} ${60 + Math.sin(a) * 48} L${60 + Math.cos(a) * 56} ${60 + Math.sin(a) * 56}`}
                  />
                );
              })}
            </G>
            {/* Inner sparkle */}
            <Path
              d="M60 38 L63 55 L80 60 L63 65 L60 82 L57 65 L40 60 L57 55 Z"
              fill="#ffffff"
              opacity="0.95"
            />
          </Svg>
        </Animated.View>
      </Animated.View>

      <Text style={styles.brand}>Astrology AI</Text>
      <Text style={styles.tagline}>Precision Vedic astrology</Text>

      <View style={styles.lineWrap}>
        <Text style={styles.line} key={lineIdx}>
          {LINES[lineIdx]}
        </Text>
      </View>
    </Animated.View>
  );
}

const { width } = Dimensions.get("window");

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    logoWrap: {
      width: 140, height: 140,
      alignItems: "center", justifyContent: "center",
      marginBottom: spacing.xl,
    },
    glow: {
      position: "absolute",
      width: 140, height: 140, borderRadius: 70,
      backgroundColor: c.primarySoft,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1, shadowRadius: 30,
      elevation: 20,
    },
    brand: {
      color: c.text,
      fontSize: 28,
      lineHeight: 38,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    tagline: {
      color: c.textDim,
      fontSize: 13,
      marginTop: 6,
      letterSpacing: 0.5,
    },
    lineWrap: {
      marginTop: spacing.xxl,
      height: 22,
      width: width - spacing.xl * 2,
      alignItems: "center",
      justifyContent: "center",
    },
    line: {
      color: c.primaryLight,
      fontSize: 13,
      letterSpacing: 0.3,
      textAlign: "center",
    },
  });
