import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MenuButton from "./MenuButton";
import CosmicBackdrop from "./CosmicBackdrop";
import { useColors } from "../theme/ThemeContext";
import { spacing } from "../theme/tokens";

export default function ScreenContainer({ children, scroll = true, padded = true, showMenu = true }) {
  const colors = useColors();
  const inner = (
    <View style={[padded && styles.padded, { paddingBottom: spacing.xl }]}>
      {showMenu && (
        <View style={styles.headerRow}>
          <MenuButton />
        </View>
      )}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <CosmicBackdrop />
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  padded:    { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  headerRow: { marginBottom: spacing.md },
});
