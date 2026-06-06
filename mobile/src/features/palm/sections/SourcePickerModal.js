import React from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useStyles } from "../../../theme/useStyles";
import { makeStyles } from "../styles";

// Bottom-sheet modal that appears after the user taps a hand card. Camera only
// — gallery upload is intentionally not offered so users can't submit a photo
// of a screen/another picture (which breaks reading accuracy and trust).
// `pick("camera")` runs the gate + analysis.
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
            {activeHand} Hand · Take a live photo of your palm
          </Text>
          <Pressable
            onPress={() => pick("camera")}
            style={({ pressed }) => [s.sourceBtn, s.sourceBtnPrimary, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.sourceIcon}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.sourceLabel}>Take a Photo</Text>
              <Text style={s.sourceSub}>For an accurate reading we use a live camera shot, not gallery uploads</Text>
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
