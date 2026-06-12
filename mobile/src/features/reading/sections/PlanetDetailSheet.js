import React from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { signOf, ZE } from "../../../shared/astrology";
import { EMOJIS } from "../../../utils/emojis";
import { makeStyles } from "../styles";
import { planetInfoFor } from "../planetInfo";

// Bottom-sheet detail for a tapped planet. RN Modal (slide-up) — works in Expo
// Go, no native module. Meaning is static (planetInfo.js); the placement line is
// pulled live from the chart so it's specific to this user without inventing.
export default function PlanetDetailSheet({ planet, onClose }) {
  const color = useColors();
  const s = useStyles(makeStyles);
  const info = planetInfoFor(planet);
  const visible = !!planet;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={onClose}>
        {/* Inner press is swallowed so taps on the card don't dismiss. */}
        <Pressable style={s.sheetCard} onPress={() => {}}>
          {planet && info && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.sheetHandle} />

              <View style={s.sheetHeader}>
                <Text style={s.sheetGlyph}>{info.glyph}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetTitle}>{planet.base || planet.name} · {info.vedic}</Text>
                  <Text style={s.sheetEpithet}>{info.epithet}</Text>
                </View>
              </View>

              {/* Live placement for THIS chart. */}
              <View style={s.sheetPlacement}>
                <Text style={s.sheetPlacementText}>
                  {ZE[signOf(planet.sid)]} {signOf(planet.sid)}
                  {planet.houseSid ? ` · House ${planet.houseSid}` : ""}
                  {planet.retro ? " · Retrograde ℞" : ""}
                </Text>
              </View>

              <Text style={s.sheetLabel}>WHAT IT GOVERNS</Text>
              <Text style={s.sheetBody}>{info.represents}</Text>

              <View style={s.sheetSplit}>
                <View style={[s.sheetHalf, { borderColor: "rgba(34,197,94,0.25)", backgroundColor: "rgba(34,197,94,0.06)" }]}>
                  <Text style={[s.sheetHalfTitle, { color: color.success }]}>{EMOJIS.CHECK} When strong</Text>
                  <Text style={s.sheetHalfBody}>{info.strong}</Text>
                </View>
                <View style={[s.sheetHalf, { borderColor: "rgba(251,191,36,0.25)", backgroundColor: "rgba(251,191,36,0.06)" }]}>
                  <Text style={[s.sheetHalfTitle, { color: color.warning }]}>⚠ When challenged</Text>
                  <Text style={s.sheetHalfBody}>{info.weak}</Text>
                </View>
              </View>

              <Pressable onPress={onClose} style={s.sheetClose}>
                <Text style={s.sheetCloseText}>Close</Text>
              </Pressable>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
