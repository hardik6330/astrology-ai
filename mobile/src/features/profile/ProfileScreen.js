import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MagicButton from "@/components/MagicButton";
import MenuButton from "@/components/MenuButton";
import { useColors } from "@/theme/ThemeContext";
import { useChart } from "@/context/ChartContext";
import { useAuth } from "@/features/auth/AuthContext";
import { signOf, ZE } from "@/shared/astrology";
import { useStyles } from "@/theme/useStyles";
import { radius, spacing, fontSize } from "@/theme/tokens";
import { useBackToKundali } from "@/utils/useBackToKundali";
import { useCredits } from "@/hooks/useCredits";
import { useCosts } from "@/hooks/useCosts";
import { getCredits } from "@/services/api";

const LOW = 20;

export default function ProfileScreen({ navigation }) {
  const { form, chart } = useChart();
  const { logout } = useAuth();
  const color = useColors();
  const s = useStyles(makeStyles);
  useBackToKundali(navigation);

  // Cosmic Credits — fetched fresh each time Profile opens, and kept live by
  // the shared store as AI actions spend them elsewhere.
  const credits = useCredits();
  const costs = useCosts();
  useEffect(() => { getCredits(); }, []);
  const low = credits != null && credits < LOW;
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

      {/* Cosmic Credits — the only place the balance is shown. */}
      <CosmicCard style={[s.creditsCard, low && s.creditsCardLow]}>
        <View style={s.creditsTopRow}>
          <View style={s.creditsLabelWrap}>
            <Text style={s.creditsSpark}>✨</Text>
            <Text style={s.creditsLabel}>Cosmic Credits</Text>
          </View>
          <Text style={[s.creditsValue, { color: low ? color.danger : color.primaryLight }]}>
            {credits == null ? "—" : credits}
          </Text>
        </View>
        <Text style={s.creditsSub}>
          {low
            ? "Low balance — top up to keep using AI features."
            : "Spent on AI readings, daily guidance, chat and palm."}
        </Text>
        {costs && (
          <View style={s.costsRow}>
            {[
              ["Insights", costs.insights],
              ["Daily", costs.daily],
              ["Chat", costs.chat],
              ["Palm", costs.palm],
            ].map(([l, v]) => (
              <View key={l} style={s.costChip}>
                <Text style={s.costChipLabel}>{l}</Text>
                <Text style={s.costChipValue}>{v}</Text>
              </View>
            ))}
          </View>
        )}
      </CosmicCard>

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

      <Pressable onPress={logout} style={s.logoutBtn}>
        <Text style={s.logoutText}>🚪  Logout</Text>
      </Pressable>
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

    creditsCard: { borderColor: c.primaryBorder },
    creditsCardLow: { borderColor: "rgba(248,113,113,0.45)", backgroundColor: "rgba(248,113,113,0.06)" },
    creditsTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    creditsLabelWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
    creditsSpark: { fontSize: 16 },
    creditsLabel: { color: c.text, fontSize: fontSize.md, fontWeight: "700" },
    creditsValue: { fontSize: 26, fontWeight: "800" },
    creditsSub: { color: c.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
    costsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    costChip: {
      flex: 1, alignItems: "center",
      backgroundColor: c.inputBg,
      borderRadius: radius.md, paddingVertical: 8,
    },
    costChipLabel: { color: c.textMuted, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5 },
    costChipValue: { color: c.primaryLight, fontSize: 14, fontWeight: "700", marginTop: 2 },

    cardTitle: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: spacing.md },
    detailRow: {
      flexDirection: "row", justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
    },
    detailKey: { color: c.textMuted, fontSize: 12 },
    detailVal: { color: c.text, fontSize: 13, fontWeight: "600" },

    logoutBtn: {
      marginTop: spacing.xl,
      paddingVertical: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.danger + "40",
      backgroundColor: c.danger + "10",
    },
    logoutText: { color: c.danger, fontSize: 14, fontWeight: "600" },
  });
