import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

// Transparent solar-system loader (mobile twin of the web SolarSystemLoader):
// nine planets orbiting a glowing sun. Each lap time is derived from the REAL
// orbital period (Earth days) with a sqrt compression — dur = BASE·sqrt(period /
// Mercury) — so the true ordering and inner-fast/outer-slow feel survive, but
// the ~1029:1 Mercury:Pluto ratio is squeezed enough that every planet visibly
// drifts (true ratios would freeze the outer planets). Keep in sync with the web
// copy like the astrology engine.
//
// Geometry: each planet's rotating layer is a centered box of side 2·r; the
// planet sits at the top-centre of that box, so rotating the box (reanimated)
// carries it around a circle of radius r. The shared value starts at phase·360
// to stagger the start angles.

const BASE = 4000; // ms for Mercury's lap (the fastest)
const MERCURY = 88; // days — reference period

const PLANETS = [
  { name: "Mercury", period: 88, r: 30, size: 4, color: "#9a9a9a", phase: 0.1 },
  { name: "Venus", period: 225, r: 42, size: 6, color: "#e3b06b", phase: 0.62 },
  { name: "Earth", period: 365, r: 56, size: 6.5, color: "#4a90d9", phase: 0.28 },
  { name: "Mars", period: 687, r: 70, size: 5, color: "#d9603a", phase: 0.85 },
  { name: "Jupiter", period: 4333, r: 90, size: 11, color: "#d8a36b", phase: 0.42 },
  { name: "Saturn", period: 10759, r: 108, size: 9, color: "#e3c694", phase: 0.05, ring: true },
  { name: "Uranus", period: 30687, r: 124, size: 7, color: "#8fd0d8", phase: 0.7 },
  { name: "Neptune", period: 60190, r: 138, size: 7, color: "#5a6fd8", phase: 0.33 },
  { name: "Pluto", period: 90560, r: 150, size: 3, color: "#b9a08a", phase: 0.55 },
];

const durOf = (period) => BASE * Math.sqrt(period / MERCURY);

function Planet({ p, scale }) {
  const r = p.r * scale;
  const ps = p.size * scale;
  const box = 2 * r;
  const dur = durOf(p.period);
  const rot = useSharedValue(p.phase * 360);

  useEffect(() => {
    rot.value = withRepeat(
      withTiming(p.phase * 360 + 360, { duration: dur, easing: Easing.linear }),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  const centered = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: box,
    height: box,
    marginLeft: -r,
    marginTop: -r,
  };

  return (
    <>
      {/* Orbit ring */}
      <View
        pointerEvents="none"
        style={[
          centered,
          { borderRadius: r, borderWidth: 1, borderColor: "rgba(150,150,200,0.16)" },
        ]}
      />
      {/* Rotating layer carrying the planet */}
      <Animated.View pointerEvents="none" style={[centered, spin]}>
        {p.ring && (
          <View
            style={{
              position: "absolute",
              left: r - ps * 1.2,
              top: -ps * 0.45,
              width: ps * 2.4,
              height: ps * 0.9,
              borderRadius: ps * 1.2,
              borderWidth: Math.max(1, ps * 0.16),
              borderColor: "rgba(227,198,148,0.55)",
              transform: [{ rotate: "-20deg" }],
            }}
          />
        )}
        <View
          style={{
            position: "absolute",
            left: r - ps / 2,
            top: -ps / 2,
            width: ps,
            height: ps,
            borderRadius: ps / 2,
            backgroundColor: p.color,
          }}
        />
      </Animated.View>
    </>
  );
}

export default function SolarSystemLoader({ label = "Aligning all nine planets…", size = 330 }) {
  const scale = size / 330; // geometry authored at 330px, then scaled
  const sun = 26 * scale;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size, height: size }}>
        {/* Sun */}
        <View
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: sun,
            height: sun,
            marginLeft: -sun / 2,
            marginTop: -sun / 2,
            borderRadius: sun / 2,
            backgroundColor: "#ffb627",
            shadowColor: "#ff9a00",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.85,
            shadowRadius: 14 * scale,
            elevation: 12,
          }}
        />
        {PLANETS.map((p) => (
          <Planet key={p.name} p={p} scale={scale} />
        ))}
      </View>

      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: 24,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: "#a5b4fc",
  },
});
