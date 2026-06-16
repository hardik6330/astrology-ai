import React from "react";
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import MenuButton from "./MenuButton";
import CosmicBackdrop from "./CosmicBackdrop";
import { useColors } from "../theme/ThemeContext";
import { spacing } from "../theme/tokens";

export default function ScreenContainer({ children, scroll = true, scrollEnabled = true, padded = true, showMenu = true, padH }) {
  const colors = useColors();
  const inner = (
    <Animated.View
      entering={FadeInDown.duration(400).springify()}
      style={[padded && styles.padded, padded && padH != null && { paddingHorizontal: padH }, { paddingBottom: spacing.xl }]}
    >
      {showMenu && (
        <View style={styles.headerRow}>
          <MenuButton />
        </View>
      )}
      {children}
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <CosmicBackdrop />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={scrollEnabled}
          >
            {inner}
          </ScrollView>
        ) : (
          inner
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  padded:    { paddingHorizontal: spacing.sm, paddingTop: spacing.md },
  headerRow: { marginBottom: spacing.md },
});
