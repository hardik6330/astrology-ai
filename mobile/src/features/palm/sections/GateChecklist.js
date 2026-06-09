import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useColors } from "../../../theme/ThemeContext";
import { spacing } from "../../../theme/tokens";
import { EMOJIS } from "../../../utils/emojis";

// Live gate diagnostic panel shown under the palm photo while it's analyzed —
// the mobile twin of the web's PalmGateChecklist. Each check is a pill carrying
// its measured value + ✓/✗. When `analyzing` is true a final spinner pill sits
// below the checks. Colors are matched to the web (green pass / red fail /
// purple analyzing) intentionally, so the two clients look identical.
function Pill({ ok, children, tone }) {
  const border = tone === "analyzing" ? "rgba(168,85,247,0.35)" : ok ? "rgba(34,197,94,0.35)" : "rgba(248,113,113,0.4)";
  const bg     = tone === "analyzing" ? "rgba(168,85,247,0.10)" : ok ? "rgba(34,197,94,0.08)" : "rgba(248,113,113,0.08)";
  const fg     = tone === "analyzing" ? "#c084fc" : ok ? "#86efac" : "#fca5a5";
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 10,
        borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
        borderColor: border, backgroundColor: bg,
      }}
    >
      {tone === "analyzing" ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: 13, fontWeight: "700", includeFontPadding: false }}>{ok ? EMOJIS.CHECK : EMOJIS.CROSS}</Text>
      )}
      <Text style={{ color: fg, fontSize: 13, fontWeight: "600", flex: 1 }}>{children}</Text>
    </View>
  );
}

export default function GateChecklist({ checks = [], analyzing = false, analyzingLabel = "Analyzing palm lines with AI…" }) {
  useColors(); // re-render on theme change (pill colors are fixed brand tones)
  if (!checks.length && !analyzing) return null;
  return (
    <View style={{ width: "100%", gap: 8, marginTop: spacing.md }}>
      {checks.map((check) => (
        <Pill key={check.key} ok={check.ok}>{check.label}</Pill>
      ))}
      {analyzing && <Pill tone="analyzing">{analyzingLabel}</Pill>}
    </View>
  );
}
