import { useCallback } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

// Top-level drawer screens (Palm, Chat, PalmStep, PalmCompare, Profile, Help)
// should send the user to the Reading screen's Kundali tab on Android
// hardware back, instead of exiting the app or popping the drawer history.
// Drop this hook into any such screen — it's a no-op on iOS where there is
// no hardware back, and it only activates while the screen is focused.
export function useBackToKundali(navigation) {
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        navigation.navigate("Reading", { tab: "kundali" });
        return true;  // signal we handled it — don't let RN/Android exit the app
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [navigation]),
  );
}
