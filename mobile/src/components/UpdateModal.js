import React from "react";
import { Text, StyleSheet, Modal, Pressable } from "react-native";
import CosmicCard from "./CosmicCard";
import MagicButton from "./MagicButton";
import { useColors } from "../theme/ThemeContext";
import { spacing } from "../theme/tokens";

// Update prompt, rendered at the app root when a newer version exists. Two modes:
//   mandatory=true  → "Update Required": non-dismissible (no Later; backdrop tap
//                     and Android back do nothing). Only way out is Update.
//   mandatory=false → "Update Available": dismissible — a Later button, backdrop
//                     tap, and Android back all call onLater.
export default function UpdateModal({ visible, mandatory = true, latestVersion, onUpdate, onLater }) {
  const c = useColors();
  const dismiss = mandatory ? () => {} : onLater;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340 }}>
          <CosmicCard style={styles.card}>
            <Text style={styles.icon}>🚀</Text>
            <Text style={[styles.title, { color: c.text }]}>
              {mandatory ? "Update Required" : "Update Available"}
            </Text>
            <Text style={[styles.body, { color: c.textDim }]}>
              A newer version of the app is available
              {latestVersion ? ` (v${latestVersion})` : ""}.
              {mandatory
                ? " Please update to keep using the app."
                : " Update now for the latest features and fixes."}
            </Text>
            <MagicButton style={{ width: "100%", marginTop: spacing.md }} onPress={onUpdate}>
              Update Now
            </MagicButton>
            {!mandatory && (
              <MagicButton variant="ghost" style={{ width: "100%", marginTop: spacing.sm }} onPress={onLater}>
                Later
              </MagicButton>
            )}
          </CosmicCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: { width: "100%", alignItems: "center", marginBottom: 0 },
  icon: { fontSize: 40, lineHeight: 52, marginBottom: 4, includeFontPadding: false },
  title: { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: spacing.sm },
  body: { fontSize: 13.5, lineHeight: 20, textAlign: "center" },
});
