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

  // elevation:0 — the card's translucent amber bg + Android elevation would
  // otherwise render a dark fill behind it (the grey "border" bleed).
  return (
    <CosmicCard style={{ borderColor: "rgba(251,191,36,0.4)", backgroundColor: "rgba(251,191,36,0.06)", alignItems: "center", elevation: 0 }}>
      {preview?.uri ? (
        <View style={[s.rejectThumb, { borderColor: "rgba(251,191,36,0.3)" }]}>
          <Image source={{ uri: preview.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
        </View>
      ) : null}
      <Text style={{ fontSize: 44, lineHeight: 58 }}>{info.icon}</Text>
      <Text style={[s.rejectTitle, { color: "#fbbf24" }]}>{info.title}</Text>
      <Text style={s.rejectTip}>{info.tip}</Text>
      {palm.retakeReason ? (
        <Text style={s.rejectReason}>{palm.retakeReason}</Text>
      ) : null}

      <View style={{ marginVertical: spacing.sm, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(251,191,36,0.1)" }}>
        <Text style={{ fontSize: 11, fontWeight: "bold", color: "#fbbf24", textTransform: "uppercase", letterSpacing: 0.5 }}>
          🛡️ No credits spent
        </Text>
      </View>

      <MagicButton style={{ width: "100%", marginTop: spacing.sm }} onPress={reset}>
        {EMOJIS.CAMERA_LENS} Try a Clearer Photo
      </MagicButton>
    </CosmicCard>
  );
}
