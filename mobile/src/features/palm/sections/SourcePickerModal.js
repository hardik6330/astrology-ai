import React from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import { useStyles } from "../../../theme/useStyles";
import { useColors } from "../../../theme/ThemeContext";
import { EMOJIS } from "../../../utils/emojis";
import { makeStyles } from "../styles";

// Bottom-sheet modal that appears after the user taps a hand card. Camera only
// — gallery upload is intentionally not offered so users can't submit a photo
// of a screen/another picture (which breaks reading accuracy and trust).
// `pick("camera")` runs the gate + analysis. While `launching` is true the
// camera is being opened — show a spinner and lock the sheet so a second tap
// can't fire a duplicate launch.
export default function SourcePickerModal({ visible, activeHand, onClose, pick, launching = false }) {
  const s = useStyles(makeStyles);
  const c = useColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={launching ? undefined : onClose}
    >
      <Pressable onPress={launching ? undefined : onClose} style={s.modalBackdrop}>
        <Pressable onPress={(e) => e.stopPropagation()} style={s.modalSheet}>
          <Text style={s.modalTitle}>
            {activeHand} Hand · Take a live photo of your palm
          </Text>
          <Pressable
            onPress={() => pick("camera")}
            disabled={launching}
            style={({ pressed }) => [s.sourceBtn, s.sourceBtnPrimary, (pressed || launching) && { opacity: 0.85 }]}
          >
            {launching ? (
              <>
                <ActivityIndicator color={c.primaryLight} style={s.sourceIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={s.sourceLabel}>Opening camera…</Text>
                  <Text style={s.sourceSub}>Hold on a moment</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={s.sourceIcon}>{EMOJIS.CAMERA_LENS}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.sourceLabel}>Take a Photo</Text>
                  <Text style={s.sourceSub}>For an accurate reading we use a live camera shot, not gallery uploads</Text>
                </View>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={onClose}
            disabled={launching}
            style={({ pressed }) => [s.modalCancel, (pressed || launching) && { opacity: 0.7 }]}
          >
            <Text style={s.modalCancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
