import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withDelay, withSequence, Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function TwinkleStar({ x, y, size, baseOpacity, dur, delay }) {
  const opacity = useSharedValue(baseOpacity);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(baseOpacity * 0.25, { duration: dur, easing: Easing.inOut(Easing.quad) }),
        withTiming(baseOpacity,        { duration: dur, easing: Easing.inOut(Easing.quad) }),
      ), -1, false));
  }, [opacity, baseOpacity, dur, delay]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: "absolute", left: x, top: y,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: "#fff",
    }, style]} />
  );
}

const shootingStarStyle = {
  position: "absolute", top: 0, left: 0,
  width: 110, height: 2, borderRadius: 2,
  backgroundColor: "#fff",
  shadowColor: "#c7d2fe", shadowOpacity: 1, shadowRadius: 8,
  shadowOffset: { width: 0, height: 0 },
  elevation: 6,
};

function ShootingStar() {
  const x = useSharedValue(-200);
  const y = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(20);
  const sideRef = useRef(0); // 0 = left, 1 = right

  useEffect(() => {
    const loop = () => {
      if (sideRef.current === 0) {
        // From Top-Left to Middle-Right
        x.value = -200;
        y.value = -100;
        rotation.value = 20;
        x.value = withTiming(SCREEN_W * 0.7, { duration: 1800, easing: Easing.out(Easing.quad) });
        y.value = withTiming(SCREEN_H * 0.5, { duration: 1800, easing: Easing.out(Easing.quad) });
      } else {
        // From Top-Right to Middle-Left
        x.value = SCREEN_W + 100;
        y.value = -100;
        rotation.value = -20;
        x.value = withTiming(SCREEN_W * 0.3, { duration: 1800, easing: Easing.out(Easing.quad) });
        y.value = withTiming(SCREEN_H * 0.5, { duration: 1800, easing: Easing.out(Easing.quad) });
      }

      opacity.value = 0;
      opacity.value = withSequence(
        withTiming(0,   { duration: 200 }),
        withTiming(0.9, { duration: 200 }),
        withTiming(0,   { duration: 1400 }),
      );

      sideRef.current = 1 - sideRef.current;
    };
    loop();
    const id = setInterval(loop, 7000);
    return () => clearInterval(id);
  }, [x, y, opacity, rotation]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rotation.value}deg` }
    ],
  }));
  return <Animated.View pointerEvents="none" style={[shootingStarStyle, style]} />;
}

export default function CosmicBackdrop() {
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
}
