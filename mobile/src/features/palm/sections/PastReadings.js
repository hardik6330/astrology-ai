import React from "react";
import { Text } from "react-native";
import CosmicCard from "../../../components/CosmicCard";
import PressableScale from "../../../components/PressableScale";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { makeStyles } from "../styles";

// List of past palm readings — tap to view without re-running the AI.
export default function PastReadings({ history, loadPast }) {
  const color = useColors();
  const s = useStyles(makeStyles);

  return (
    <CosmicCard>
      <Text style={s.cardTitle}>📂 Your Past Readings</Text>
      <Text style={s.cardSub}>Tap to view — no AI re-run.</Text>
      {history.map((h) => {
        const d = new Date(h.createdAt);
        const when =
          d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
          ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        const bad = h.imageQuality === "unusable";
        return (
          <PressableScale
            key={h.id}
            onPress={() => !bad && loadPast(h.id)}
            haptic={!bad}
            disabled={bad}
            style={[s.historyRow, bad && { opacity: 0.5 }]}
          >
            <Text style={s.historyTitle}>
              ✋ {h.handType || "Unclear"} Hand
              {bad ? <Text style={{ color: color.danger, fontSize: 10 }}>  · unreadable</Text> : null}
            </Text>
            <Text style={s.historyDate}>{when}</Text>
          </PressableScale>
        );
      })}
    </CosmicCard>
  );
}
