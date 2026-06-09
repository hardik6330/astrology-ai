import React, { useRef } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { TwinkleStar, ShootingStar } from "./cosmic";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Lightweight starfield used behind in-app screens (no gradient/orbits — that
// richer variant lives in components/cosmic/LoginBackdrop). Static, no props,
// so memo keeps parent re-renders from reconciling the 25-star tree.
const CosmicBackdrop = React.memo(function CosmicBackdrop() {
  const stars = useRef(Array.from({ length: 25 }, (_, i) => ({
    x: ((i * 53) % 100) / 100 * SCREEN_W,
    y: ((i * 37) % 100) / 100 * SCREEN_H,
    size: ((i * 7) % 3) + 1.2,
    o: 0.2 + ((i * 11) % 7) / 14,
    dur: 2000 + (i % 5) * 800,
    delay: (i * 157) % 2500,
  }))).current;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s, i) => (
        <TwinkleStar key={i} x={s.x} y={s.y} size={s.size}
                     baseOpacity={s.o} dur={s.dur} delay={s.delay} />
      ))}
      <ShootingStar />
    </View>
  );
});

export default CosmicBackdrop;
