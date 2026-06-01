import React from "react";
import { Pressable, Platform } from "react-native";
import { haptics } from "../utils/haptics";

// Drop-in replacement for Pressable that gives consistent tactile feedback:
//   • a subtle scale/dim on press (iOS, where there's no ripple)
//   • a native ripple on Android
//   • an optional light haptic on press
// `style` accepts the same value or ({ pressed }) => style function as Pressable.
export default function PressableScale({
  onPress,
  haptic = true,
  rippleColor = "rgba(168,85,247,0.18)",
  style,
  children,
  ...rest
}) {
  return (
    <Pressable
      onPress={(e) => {
        if (haptic) haptics.tap();
        onPress?.(e);
      }}
      android_ripple={{ color: rippleColor }}
      style={(state) => {
        const base = typeof style === "function" ? style(state) : style;
        // Ripple already conveys the press on Android; only add the scale/dim
        // on iOS so we don't double up.
        if (state.pressed && Platform.OS === "ios") {
          return [base, { opacity: 0.85, transform: [{ scale: 0.98 }] }];
        }
        return base;
      }}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
