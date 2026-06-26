import React, { useEffect } from "react";
import { View, Dimensions } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";

// React Native port of the web SolarSystemLoader: nine planets orbiting a
// glowing sun, each lap time derived from its REAL orbital period (Earth days)
// with a sqrt compression — dur = BASE * sqrt(period / Mercury) — so the true
// inner-fast / outer-slow ordering shows without the outer planets looking
// frozen. Native-driven rotation (reanimated, UI thread). Used as the login
// backdrop; twin of frontend/src/common/SolarSystemLoader.jsx — keep in sync.

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const BASE = 4;      // seconds for Mercury's lap (the fastest)
const MERCURY = 88;  // days — the reference period

const PLANETS = [
  { name: "Mercury", period: 88,    r: 30,  size: 4,    color: "#9a9a9a", phase: 0.10 },
  { name: "Venus",   period: 225,   r: 42,  size: 6,    color: "#e3b06b", phase: 0.62 },
  { name: "Earth",   period: 365,   r: 56,  size: 6.5,  color: "#4a90d9", phase: 0.28 },
  { name: "Mars",    period: 687,   r: 70,  size: 5,    color: "#d9603a", phase: 0.85 },
  { name: "Jupiter", period: 4333,  r: 90,  size: 11,   color: "#d8a36b", phase: 0.42 },
  { name: "Saturn",  period: 10759, r: 108, size: 9,    color: "#e3c694", phase: 0.05, ring: true },
  { name: "Uranus",  period: 30687, r: 124, size: 7,    color: "#8fd0d8", phase: 0.70 },
  { name: "Neptune", period: 60190, r: 138, size: 7,    color: "#5a6fd8", phase: 0.33 },
  { name: "Pluto",   period: 90560, r: 150, size: 3,    color: "#b9a08a", phase: 0.55 },
];

const durOf = (period) => BASE * Math.sqrt(period / MERCURY);

// Geometry is authored at 330px (outer orbit Ø300) like the web loader, then
// scaled so the outer orbit ≈ screen width — an immersive, screen-filling
// backdrop. The login card sits over the centre; the outer rings/planets
// remain visible around it.
const CX = SCREEN_W / 2;
const CY = SCREEN_H / 2;

// One planet: its orbit ring (static) + a rotating layer carrying the body.
const Planet = React.memo(function Planet({ p, scale }) {
  const r = p.r * scale;
  const ps = Math.max(2, p.size * scale);
  const box = 2 * r;
  const dur = durOf(p.period) * 1000; // → ms
  const start = p.phase * 360;

  const rot = useSharedValue(start);
  useEffect(() => {
    rot.value = start;
    rot.value = withRepeat(
      withTiming(start + 360, { duration: dur, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rot, dur, start]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  const centered = {
    position: "absolute",
    width: box, height: box,
    top: CY - r, left: CX - r,
  };

  return (
    <>
      {/* Orbit ring */}
      <View
        pointerEvents="none"
        style={[centered, {
          borderRadius: r,
          borderWidth: 1,
          borderColor: "rgba(150,150,200,0.16)",
        }]}
      />
      {/* Rotating layer — planet sits at the top-centre of the box */}
      <Animated.View pointerEvents="none" style={[centered, spin]}>
        {/* Saturn's ring, drawn behind the body */}
        {p.ring && (
          <View
            style={{
              position: "absolute",
              top: -ps * 0.45,
              left: box / 2 - ps * 1.2,
              width: ps * 2.4,
              height: ps * 0.9,
              borderRadius: ps * 0.45,
              borderWidth: Math.max(1, ps * 0.16),
              borderColor: "rgba(227,198,148,0.55)",
              transform: [{ rotate: "-20deg" }],
            }}
          />
        )}
        <View
          style={{
            position: "absolute",
            top: -ps / 2,
            left: box / 2 - ps / 2,
            width: ps, height: ps, borderRadius: ps / 2,
            backgroundColor: p.color,
            shadowColor: p.color, shadowOpacity: 0.6,
            shadowRadius: Math.max(3, ps), shadowOffset: { width: 0, height: 0 },
            elevation: 4,
          }}
        />
      </Animated.View>
    </>
  );
});

const SolarSystem = React.memo(function SolarSystem() {
  // outer orbit (Ø300 at scale 1) ≈ 1.1× screen width.
  const scale = (SCREEN_W * 1.1) / 300;
  const sunR = 14 * scale;
  const sunBox = sunR * 4; // padding for the glow

  // Gentle pulse on the sun's glow.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.25, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1, true,
    );
  }, [pulse]);
  const sunStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={{ position: "absolute", width: SCREEN_W, height: SCREEN_H }} pointerEvents="none">
      {PLANETS.map((p) => <Planet key={p.name} p={p} scale={scale} />)}

      {/* Glowing sun at centre */}
      <Animated.View
        pointerEvents="none"
        style={[{
          position: "absolute",
          top: CY - sunBox / 2, left: CX - sunBox / 2,
          width: sunBox, height: sunBox,
          alignItems: "center", justifyContent: "center",
          shadowColor: "#ffae00", shadowOpacity: 0.55,
          shadowRadius: 22, shadowOffset: { width: 0, height: 0 },
        }, sunStyle]}
      >
        <Svg width={sunR * 2} height={sunR * 2}>
          <Defs>
            <RadialGradient id="sunGrad" cx="35%" cy="35%" r="75%">
              <Stop offset="0%"  stopColor="#fff3b0" />
              <Stop offset="45%" stopColor="#ffb627" />
              <Stop offset="82%" stopColor="#ff7a00" />
            </RadialGradient>
          </Defs>
          <Circle cx={sunR} cy={sunR} r={sunR} fill="url(#sunGrad)" />
        </Svg>
      </Animated.View>
    </View>
  );
});

export default SolarSystem;
