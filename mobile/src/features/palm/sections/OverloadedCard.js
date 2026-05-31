import React from "react";
import { Text } from "react-native";
import CosmicCard from "../../../components/CosmicCard";
import MagicButton from "../../../components/MagicButton";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { makeStyles } from "../styles";

// Shown when the single-hand analysis came back AI_OVERLOADED. Offers a retry
// with the same photo (when one exists) or a fresh upload, gated by cooldown.
export default function OverloadedCard({ cooldown, preview, runAnalyze, setOverloaded }) {
  const color = useColors();
  const s = useStyles(makeStyles);

  return (
    <CosmicCard style={[s.aiBusyCard, { alignItems: "center" }]}>
      <Text style={{ fontSize: 36, lineHeight: 48 }}>⏳</Text>
      <Text style={[s.errTitle, { color: color.warning }]}>AI is busy right now</Text>
      <Text style={s.errBody}>
        Our reader couldn't analyze your palm after several tries.
        {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
      </Text>
      {preview ? (
        <MagicButton style={{ width: "100%" }} disabled={cooldown > 0} onPress={() => runAnalyze(preview)}>
          {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again with Same Photo"}
        </MagicButton>
      ) : (
        <MagicButton style={{ width: "100%" }} disabled={cooldown > 0} onPress={() => setOverloaded(false)}>
          {cooldown > 0 ? `🕒 Wait ${cooldown}s` : "Upload a New Photo"}
        </MagicButton>
      )}
    </CosmicCard>
  );
}
