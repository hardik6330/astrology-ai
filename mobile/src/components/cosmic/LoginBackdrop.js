import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import TwinkleStar from "./TwinkleStar";
import ShootingStar from "./ShootingStar";
import SolarSystem from "./SolarSystem";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Full-screen login backdrop: a once-drawn radial gradient, ~30 twinkling
// stars, three orbits + a pulsing center sun, and a periodic shooting star.
// Memoized — only re-renders when the theme (color/theme) actually changes.
const LoginBackdrop = React.memo(function LoginBackdrop({ color, theme }) {
  // ~30 stars, opacity-only animation. Plenty for a starry feel without the
  // GPU cost of dozens of overlapping animated SVG nodes.
  const stars = Array.from({ length: 30 }, (_, i) => ({
    x: ((i * 53) % 100) / 100 * SCREEN_W,
    y: ((i * 37) % 100) / 100 * SCREEN_H,
    size: ((i * 7) % 3) + 1.4,
    o: 0.3 + ((i * 11) % 7) / 14,
    dur: 1800 + (i % 5) * 700,
    delay: (i * 137) % 2400,
  }));

  const isLight = theme === "light";
  const stop1 = isLight ? "#e0e7ff" : (color.primarySoft || "#1e1b4b");
  const stop2 = color.bg;

  return (
    // Slightly dimmed so the cosmic backdrop sits quietly behind the login form.
    <View style={[StyleSheet.absoluteFill, { opacity: 0.8 }]} pointerEvents="none">
      {/* Solid radial gradient — drawn once, never animated. */}
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="bgGrad" cx="20%" cy="20%" r="80%">
            <Stop offset="0%"   stopColor={stop1} stopOpacity="1" />
            <Stop offset="100%" stopColor={stop2} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={SCREEN_W} height={SCREEN_H} fill="url(#bgGrad)" />
      </Svg>

      {stars.map((s, i) => (
        <TwinkleStar key={i} x={s.x} y={s.y} size={s.size}
                     baseOpacity={isLight ? s.o * 0.4 : s.o} dur={s.dur} delay={s.delay} />
      ))}

      {/* Nine-planet solar system (real orbital periods) — twin of the web
          SolarSystemLoader. Replaces the old 3-ring orbit set. */}
      <SolarSystem />

      <ShootingStar />
    </View>
  );
});

export default LoginBackdrop;
