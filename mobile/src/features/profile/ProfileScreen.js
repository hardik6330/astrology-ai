import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MagicButton from "@/components/MagicButton";
import MenuButton from "@/components/MenuButton";
import { useColors } from "@/theme/ThemeContext";
import { useChart } from "@/context/ChartContext";
import { signOf, ZE } from "@/shared/astrology";
import { useStyles } from "@/theme/useStyles";
import { radius, spacing, fontSize } from "@/theme/tokens";
import { useBackToKundali } from "@/utils/useBackToKundali";

export default function ProfileScreen({ navigation }) {
  const { form, chart } = useChart();
  const color = useColors();
  const s = useStyles(makeStyles);
  useBackToKundali(navigation);
  const initial = (form.name || "?").trim().charAt(0).toUpperCase();

  function fmtTime(t) {
    if (!t) return "—";
    const [hStr, mStr] = t.split(":");
    const h24 = Number(hStr);
    const m = String(mStr).padStart(2, "0");
    const ap = h24 >= 12 ? "PM" : "AM";
    const h12 = ((h24 + 11) % 12) + 1;
    return `${t} (${h12}:${m} ${ap})`;
  }

  const rows = [
    ["Full Name",   form.name   || "—"],
    ["Gender",      form.gender || "—"],
    ["Birth Date",  form.date   || "—"],
    ["Birth Time",  fmtTime(form.time)],
    ["Birth Place", form.city   || "—"],
  ];

  const ascV  = chart ? signOf(chart.angles.ascSid) : null;
  const sunV  = chart ? signOf(chart.planets[0].sid) : null;
  const moonV = chart ? signOf(chart.planets[1].sid) : null;

  return (
    <ScreenContainer showMenu={false}>
      <View style={s.headerRow}>
        <MenuButton />
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>Your Profile</Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {chart?.nakshatra ? `${chart.nakshatra} Nakshatra` : "Your cosmic identity"}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.hero}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <Text style={s.name}>{form.name || "Seeker"}</Text>
        <Text style={s.tagline}>{form.city || "Birth place not set"}</Text>
      </View>

      {chart && (
        <View style={s.row3}>
          {[
            ["Sun",   sunV,  "☀️", null],
            ["Moon",  moonV, "🌙", null],
            ["Lagna", ascV,  "⬆",  color.primaryLight],
          ].map(([l, v, ic, tint]) => (
            <View key={l} style={s.miniCard}>
              <Text style={{ fontSize: 22, lineHeight: 30, color: tint || undefined }}>{ic}</Text>
              <Text style={s.miniLabel}>{l}</Text>
              <Text style={s.miniValue}>{ZE[v] || ""} {v}</Text>
            </View>
          ))}
        </View>
      )}

      <CosmicCard>
        <Text style={s.cardTitle}>Birth Details</Text>
        {rows.map(([k, v]) => (
          <View key={k} style={s.detailRow}>
            <Text style={s.detailKey}>{k}</Text>
            <Text style={s.detailVal}>{v}</Text>
          </View>
        ))}
      </CosmicCard>

      {chart && (
        <CosmicCard>
          <Text style={s.cardTitle}>Vedic Highlights</Text>
          <View style={s.detailRow}>
            <Text style={s.detailKey}>Nakshatra</Text>
            <Text style={s.detailVal}>{chart.nakshatra}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailKey}>Current Mahadasha</Text>
            <Text style={s.detailVal}>{chart.curMaha.lord}</Text>
          </View>
          {chart.curAntar && (
            <View style={s.detailRow}>
              <Text style={s.detailKey}>Antardasha</Text>
              <Text style={s.detailVal}>{chart.curAntar.lord}</Text>
            </View>
          )}
          <View style={s.detailRow}>
            <Text style={s.detailKey}>Ayanamsha</Text>
            <Text style={s.detailVal}>{chart.ayanamsha.toFixed(2)}°</Text>
          </View>
        </CosmicCard>
      )}

      <MagicButton onPress={() => navigation.navigate("Home")}>
        ✏️  Update Birth Details
      </MagicButton>
    </ScreenContainer>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    headerTitle: { color: c.primaryLight, fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" },
    headerSub:   { color: c.textMuted, fontSize: 11, marginTop: 2, textAlign: "center" },

    hero: { alignItems: "center", marginBottom: spacing.xl, marginTop: spacing.sm },
    avatar: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: c.primarySoft,
      borderWidth: 2, borderColor: c.primaryBorder,
      alignItems: "center", justifyContent: "center",
      marginBottom: spacing.md,
    },
    avatarText: { color: c.primaryLight, fontSize: 38, fontWeight: "800" },
    name:       { color: c.primaryLight, fontSize: 22, fontWeight: "700" },
    tagline:    { color: c.textMuted, fontSize: 12, marginTop: 4 },

    row3:    { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
    miniCard: {
      flex: 1,
      backgroundColor: c.cardBgSolid,
      borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: radius.lg, paddingVertical: spacing.md,
      alignItems: "center",
    },
    miniLabel: { color: c.textMuted, fontSize: 10, marginTop: 6, textTransform: "uppercase" },
    miniValue: { color: c.text, fontSize: 12, lineHeight: 20, fontWeight: "700", marginTop: 4 },

    cardTitle: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: spacing.md },
    detailRow: {
      flexDirection: "row", justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
    },
    detailKey: { color: c.textMuted, fontSize: 12 },
    detailVal: { color: c.text, fontSize: 13, fontWeight: "600" },
  });
