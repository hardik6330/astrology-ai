import React, { useEffect } from "react";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withDelay, withSequence, Easing,
} from "react-native-reanimated";

// Cheap twinkling star — a plain Animated.View with native-driven opacity.
// No SVG re-render, no per-frame JS work; only opacity animates (not radius)
// so the compositor runs on the GPU. Memoized: props are stable per star.
const TwinkleStar = React.memo(function TwinkleStar({ x, y, size, baseOpacity, dur, delay }) {
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
});

export default TwinkleStar;
