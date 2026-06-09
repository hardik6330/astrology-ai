import React, { useEffect } from "react";
import { Dimensions } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Pulsing star at the center of the orbital system.
const CenterSun = React.memo(function CenterSun() {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(1.3, { duration: 2000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: "absolute",
      top: SCREEN_H / 2 - 8, left: SCREEN_W / 2 - 8,
      width: 16, height: 16, borderRadius: 8,
      backgroundColor: "#fff",
      shadowColor: "#c7d2fe", shadowOpacity: 1, shadowRadius: 20,
      shadowOffset: { width: 0, height: 0 }, elevation: 10,
    }, style]} />
  );
});

export default CenterSun;
