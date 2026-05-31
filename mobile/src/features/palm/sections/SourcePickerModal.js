import React from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useStyles } from "../../../theme/useStyles";
import { makeStyles } from "../styles";

// Bottom-sheet modal that appears after the user taps a hand card — lets them
// choose camera vs gallery. `pick(source)` runs the gate + analysis.
export default function SourcePickerModal({ visible, activeHand, onClose, pick }) {
  const s = useStyles(makeStyles);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} style={s.modalBackdrop}>
        <Pressable onPress={(e) => e.stopPropagation()} style={s.modalSheet}>
          <Text style={s.modalTitle}>
            {activeHand} Hand · How would you like to add the photo?
          </Text>
          <Pressable
            onPress={() => pick("camera")}
            style={({ pressed }) => [s.sourceBtn, s.sourceBtnPrimary, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.sourceIcon}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.sourceLabel}>Take a Photo</Text>
              <Text style={s.sourceSub}>Use your camera</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => pick("library")}
            style={({ pressed }) => [s.sourceBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.sourceIcon}>🖼️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.sourceLabel}>Upload from Device</Text>
              <Text style={s.sourceSub}>Pick a photo from your gallery</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [s.modalCancel, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.modalCancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
