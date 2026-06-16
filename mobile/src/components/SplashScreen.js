import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Animated, Easing, StyleSheet, Dimensions,
} from "react-native";
import Svg, {
  Defs, RadialGradient, LinearGradient, Stop,
  Circle, Ellipse, G, Path, Text as SvgText,
} from "react-native-svg";
import { useStyles } from "../theme/useStyles";
import { useColors } from "../theme/ThemeContext";
import { spacing } from "../theme/tokens";

import * as Location from "expo-location";
import { useForm } from "../context/ChartContext";

const LINES = [
  "Aligning the stars…",
  "Reading the ephemeris…",
  "Casting your celestial map…",
  "Tuning the cosmic frequencies…",
  "Channeling the planetary winds…",
];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const AnimatedG = Animated.createAnimatedComponent(G);

// 12 zodiac glyphs, Aries → Pisces, starting at the top and going clockwise.
const ZODIAC = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

// One twinkling background star.
function Star({ x, y, size, baseOpacity, dur, delay }) {
  const o = useRef(new Animated.Value(baseOpacity)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: baseOpacity * 0.2, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(o, { toValue: baseOpacity,        duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const t = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(t); loop.stop(); };
  }, [o, baseOpacity, dur, delay]);
  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", left: x, top: y,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: "#fff", opacity: o,
    }} />
  );
}

// The full Astro-AI logo drawn in SVG. ViewBox is centered on (0,0) so
// trigonometry is straightforward.
function AstroLogo({ size = 240, zodiacRotation, planetScale }) {
  // ViewBox spans -120..120 — drawn once, scaled by `size`.
  const R_OUTER = 110;   // outermost circle of zodiac ring
  const R_INNER = 78;    // inner circle of zodiac ring
  const R_GLYPH = 94;    // where glyphs sit
  const R_PLANET = 28;   // planet body
  const RING_RX = 70;    // saturn ring horizontal radius
  const RING_RY = 12;    // saturn ring vertical radius (flattens the ellipse)

  return (
    <Svg width={size} height={size} viewBox="-120 -120 240 240">
      <Defs>
        {/* Planet sphere — top-left light, bottom-right shadow */}
        <RadialGradient id="planetGrad" cx="-10" cy="-10" r="42" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor="#fef3c7" stopOpacity="1" />
          <Stop offset="40%"  stopColor="#c084fc" stopOpacity="1" />
          <Stop offset="100%" stopColor="#1e1b4b" stopOpacity="1" />
        </RadialGradient>
        {/* Zodiac wheel — vertical purple-pink-amber gradient (matches reference) */}
        <LinearGradient id="wheelGrad" x1="0" y1="-110" x2="0" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor="#fde68a" />
          <Stop offset="40%"  stopColor="#c4b5fd" />
          <Stop offset="100%" stopColor="#f9a8d4" />
        </LinearGradient>
        {/* Saturn ring gradient (subtle amber → purple) */}
        <LinearGradient id="ringGrad" x1="-70" y1="0" x2="70" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor="#a78bfa" stopOpacity="0.9" />
          <Stop offset="50%"  stopColor="#fbbf24" stopOpacity="1" />
          <Stop offset="100%" stopColor="#f9a8d4" stopOpacity="0.9" />
        </LinearGradient>
      </Defs>

      {/* === Outer zodiac wheel (rotates) === */}
      <AnimatedG style={{ transform: [{ rotate: zodiacRotation }] }}>
        {/* Outer + inner ring strokes */}
        <Circle cx="0" cy="0" r={R_OUTER} stroke="url(#wheelGrad)" strokeWidth="1.6" fill="none" opacity="0.95" />
        <Circle cx="0" cy="0" r={R_INNER} stroke="url(#wheelGrad)" strokeWidth="1.2" fill="none" opacity="0.85" />

        {/* 12 sector divider lines */}
        {[...Array(12)].map((_, i) => {
          const a = (i * 30 - 90) * Math.PI / 180;
          const x1 = Math.cos(a) * R_INNER;
          const y1 = Math.sin(a) * R_INNER;
          const x2 = Math.cos(a) * R_OUTER;
          const y2 = Math.sin(a) * R_OUTER;
          return (
            <Path key={`tick-${i}`} d={`M${x1} ${y1} L${x2} ${y2}`}
                  stroke="url(#wheelGrad)" strokeWidth="0.8" opacity="0.7" />
          );
        })}

        {/* 12 zodiac glyphs */}
        {ZODIAC.map((sym, i) => {
          // -90° offset places Aries at the top; +15° centers each glyph in its sector.
          const a = (i * 30 - 90 + 15) * Math.PI / 180;
          const x = Math.cos(a) * R_GLYPH;
          const y = Math.sin(a) * R_GLYPH;
          return (
            <SvgText key={`g-${i}`}
              x={x} y={y + 5}
              fill="#fef3c7"
              fontSize="13"
              fontWeight="600"
              textAnchor="middle">
              {sym}
            </SvgText>
          );
        })}
      </AnimatedG>

      {/* === Saturn-style flat rings around planet (static — they sit in front) === */}
      <Ellipse cx="0" cy="0" rx={RING_RX}     ry={RING_RY}     stroke="url(#ringGrad)" strokeWidth="2.2" fill="none" />
      <Ellipse cx="0" cy="0" rx={RING_RX + 6} ry={RING_RY + 2} stroke="url(#ringGrad)" strokeWidth="1.2" fill="none" opacity="0.55" />
      <Ellipse cx="0" cy="0" rx={RING_RX - 8} ry={RING_RY - 2} stroke="#fde68a"        strokeWidth="0.9" fill="none" opacity="0.5" />

      {/* === Planet body === */}
      <Circle cx="0" cy="0" r={R_PLANET} fill="url(#planetGrad)" />
      {/* tiny constellation specks on the planet */}
      <Circle cx="-6"  cy="-4" r="0.9" fill="#fff" opacity="0.9" />
      <Circle cx="5"   cy="2"  r="0.7" fill="#fff" opacity="0.8" />
      <Circle cx="-2"  cy="8"  r="0.6" fill="#fff" opacity="0.7" />
      <Circle cx="9"   cy="-7" r="0.5" fill="#fff" opacity="0.6" />

      {/* Front half of the inner ring overlapping the planet, for the "behind planet" illusion */}
      <Path d={`M${-RING_RX} 0 A${RING_RX} ${RING_RY} 0 0 0 ${RING_RX} 0`}
            stroke="url(#ringGrad)" strokeWidth="2.2" fill="none" />
    </Svg>
  );
}

/**
 * Splash screen with custom-drawn Astro-AI logo (planet + Saturn rings +
 * rotating zodiac wheel) over a twinkling starfield.
 */
export default function SplashScreen({ onDone, onReady, duration = 2800 }) {
  const { setCurrentLoc } = useForm();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [lineIdx, setLineIdx] = useState(0);
  const readyFired = useRef(false);

  const pulse = useRef(new Animated.Value(0)).current;
  const fade  = useRef(new Animated.Value(0)).current;
  const rot   = useRef(new Animated.Value(0)).current;

  // Request location permission and fetch current location.
  // This happens while the splash animation is running.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const { latitude: lat, longitude: lon } = loc.coords;
        const tz = -(new Date().getTimezoneOffset() / 60);

        // Initial minimal object
        setCurrentLoc({ n: "Current Location", lat, lon, tz, isGps: true });

        // Reverse geocode to get city name
        const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (addr) {
          const city = addr.city || addr.district || addr.subregion || "Current Location";
          setCurrentLoc({ n: city, lat, lon, tz, isGps: true });
        }
      } catch (err) {
        console.warn("Location permission/fetch failed in Splash:", err);
      }
    })();
  }, [setCurrentLoc]);

  const stars = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    x: ((i * 53) % 100) / 100 * SCREEN_W,
    y: ((i * 37) % 100) / 100 * SCREEN_H,
    size: ((i * 7) % 3) + 1.2,
    o: 0.25 + ((i * 11) % 7) / 14,
    dur: 1800 + (i % 5) * 700,
    delay: (i * 137) % 2400,
  })), []);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Slow zodiac wheel rotation
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    const lineTimer = setInterval(() => setLineIdx((i) => (i + 1) % LINES.length), 1400);

    const done = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone?.());
    }, duration);

    return () => {
      clearInterval(lineTimer);
      clearTimeout(done);
    };
  }, [duration, onDone, fade, pulse, rot]);

  const planetScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.04] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });
  const zodiacRotation = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={[styles.wrap, { opacity: fade }]}
      // First layout = our splash has painted. Hide the OS native splash now so
      // the handoff is seamless (same bg color, no flash). Fires once.
      onLayout={() => {
        if (readyFired.current) return;
        readyFired.current = true;
        onReady?.();
      }}
    >
      {/* Starfield */}
      {stars.map((s, i) => (
        <Star key={i} x={s.x} y={s.y} size={s.size}
              baseOpacity={s.o} dur={s.dur} delay={s.delay} />
      ))}

      {/* Logo block */}
      <Animated.View style={[styles.logoBox, { transform: [{ scale: planetScale }] }]}>
        {/* Pulsing purple halo behind the logo */}
        <Animated.View style={[styles.glow, {
          opacity: glowOpacity,
          shadowColor: colors.primary || "#a78bfa",
        }]} />

        <AstroLogo size={260} zodiacRotation={zodiacRotation} planetScale={planetScale} />
      </Animated.View>

      <Text style={styles.brand}>Astro AI</Text>
      <Text style={styles.tagline}>Precision Vedic astrology</Text>

      <View style={styles.lineWrap}>
        <Text style={styles.line} key={lineIdx}>
          {LINES[lineIdx]}
        </Text>
      </View>
    </Animated.View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    logoBox: {
      width: 280, height: 280,
      alignItems: "center", justifyContent: "center",
      marginBottom: spacing.xl,
    },
    glow: {
      position: "absolute",
      width: 220, height: 220, borderRadius: 110,
      backgroundColor: "rgba(139,92,246,0.18)",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1, shadowRadius: 40,
      elevation: 24,
    },
    brand: {
      color: c.text,
      fontSize: 32,
      lineHeight: 42,
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
      width: SCREEN_W - spacing.xl * 2,
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
