import React, { useEffect } from "react";
import { View, Dimensions } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Single orbital ring with one planet circling. Stack several at different
// radii + speeds to build the orbital system. Native-driven rotation.
const Orbit = React.memo(function Orbit({ size, dur, reverse, planetColor, planetSize = 8 }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(reverse ? -360 : 360, {
      duration: dur, easing: Easing.linear,
    }), -1, false);
  }, [rot, dur, reverse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: "absolute",
      width: size, height: size,
      top: (SCREEN_H - size) / 2, left: (SCREEN_W - size) / 2,
      borderRadius: size / 2,
      borderWidth: 1, borderColor: "rgba(167,139,250,0.18)",
      borderStyle: "dashed",
    }, style]}>
      <View style={{
        position: "absolute", top: -planetSize / 2,
        left: size / 2 - planetSize / 2,
        width: planetSize, height: planetSize, borderRadius: planetSize / 2,
        backgroundColor: planetColor,
        shadowColor: planetColor, shadowOpacity: 1, shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 }, elevation: 6,
      }} />
    </Animated.View>
  );
});

export default Orbit;
