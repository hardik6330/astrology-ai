import React from "react";
import { View, Text } from "react-native";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { radius } from "../../../theme/tokens";
import { makeStyles } from "../styles";

export default function ProgressBar({ label, s: start, e: end, now, col }) {
  const color = useColors();
  const s = useStyles(makeStyles);
  const pct = Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 11, color: color.textDim }}>{label}</Text>
        <Text style={{ fontSize: 11, color: color.textDim }}>{pct}% complete</Text>
      </View>
      <View style={s.barTrack}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: col, borderRadius: radius.pill }} />
      </View>
    </View>
  );
}
