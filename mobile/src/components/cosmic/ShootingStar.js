import React, { useEffect, useRef } from "react";
import { Dimensions } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const shootingStarStyle = {
  position: "absolute", top: 0, left: 0,
  width: 110, height: 2, borderRadius: 2,
  backgroundColor: "#fff",
  shadowColor: "#c7d2fe", shadowOpacity: 1, shadowRadius: 8,
  shadowOffset: { width: 0, height: 0 },
  elevation: 6,
};

// A meteor that streaks across every 7s, alternating from top-left and
// top-right toward mid-screen. Native-driven transform + opacity.
const ShootingStar = React.memo(function ShootingStar() {
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
      { rotate: `${rotation.value}deg` },
    ],
  }));
  return <Animated.View pointerEvents="none" style={[shootingStarStyle, style]} />;
});

export default ShootingStar;
