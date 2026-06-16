import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import CosmicCard from "../../../components/CosmicCard";
import MagicButton from "../../../components/MagicButton";
import { useStyles } from "../../../theme/useStyles";
import { spacing } from "../../../theme/tokens";
import { REJECT_INFO } from "../constants";
import { EMOJIS } from "../../../utils/emojis";
import { makeStyles } from "../styles";

// Shown when a single-hand reading came back imageQuality === "unusable".
export default function RejectView({ palm, preview, reset }) {
  const s = useStyles(makeStyles);
  const info = REJECT_INFO[palm.rejectReason] || REJECT_INFO.default;

  // elevation:0 — the card's translucent red bg + Android elevation would
  // otherwise render a dark fill behind it (the grey "border" bleed).
  return (
    <CosmicCard style={{ borderColor: "rgba(248,113,113,0.4)", backgroundColor: "rgba(248,113,113,0.06)", alignItems: "center", elevation: 0 }}>
      {preview?.uri ? (
        <View style={s.rejectThumb}>
          <Image source={{ uri: preview.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
        </View>
      ) : null}
      <Text style={{ fontSize: 44, lineHeight: 58 }}>{info.icon}</Text>
      <Text style={s.rejectTitle}>{info.title}</Text>
      <Text style={s.rejectTip}>{info.tip}</Text>
      {palm.retakeReason ? (
        <Text style={s.rejectReason}>{palm.retakeReason}</Text>
      ) : null}
      <MagicButton style={{ width: "100%", marginTop: spacing.md }} onPress={reset}>
        {EMOJIS.CAMERA_LENS} Upload Another Photo
      </MagicButton>
    </CosmicCard>
  );
}
