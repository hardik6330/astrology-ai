import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import PressableScale from "./PressableScale";
import { useForm } from "../context/ChartContext";
import { useAuth } from "../features/auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { useStyles } from "../theme/useStyles";
import { radius, spacing, fontSize } from "../theme/tokens";
import { EMOJIS } from "../utils/emojis";

const ITEMS = [
  // Home goes straight into the Kundali tab; Reading lands on the Insights
  // (AI synthesis) tab. Both target the Reading screen with a tab param.
  { key: "Home",    label: "Birth Chart",    icon: EMOJIS.HOUSE,     route: "Reading", params: { tab: "kundali" }, desc: "Your kundali chart" },
  { key: "Reading", label: "Insights",       icon: EMOJIS.SPARKLES,  route: "Reading", params: { tab: "reading" }, desc: "Your AI cosmic reading" },
  { key: "Palm",    label: "Palm Reading",   icon: EMOJIS.HAND,      route: "Palm",    desc: "Hand-line insights" },
  { key: "Chat",    label: "AI Astrologer",  icon: EMOJIS.CHAT,      route: "Chat",    desc: "Ask the stars anything" },
  { key: "Profile", label: "Profile",        icon: EMOJIS.USER,      route: "Profile", desc: "Birth details & identity" },
  { key: "Help",    label: "Help & Support", icon: EMOJIS.HELP_DESK, route: "Help",    desc: "FAQ, contact, about" },
];

function fmtTime(t) {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h24 = Number(hStr);
  const m = String(mStr).padStart(2, "0");
  const ap = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${m} ${ap}`;
}

export default function DrawerContent({ navigation, state }) {
  const { form } = useForm();
  const { account, logout } = useAuth();
  const { theme, toggleTheme, colors } = useTheme();
  const styles = useStyles(makeStyles);

  const initial = (form.name || "?").trim().charAt(0).toUpperCase();
  const activeRoute = state?.routeNames?.[state.index];
  // Pull the active route's current params so we can distinguish two drawer
  // items that share the same screen (Home vs Reading both → Reading).
  const activeParams = state?.routes?.[state.index]?.params;
  const isDark = theme === "dark";

  const birthLine = [form.date, fmtTime(form.time)].filter(Boolean).join(" • ");

  function go(route, params) {
    navigation.closeDrawer();
    navigation.navigate(route, params);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "bottom"]}>
      {/* Top section — scrolls if menu is too tall */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.sm }}>
        <Pressable onPress={() => go("Profile")} style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{form.name || `Welcome ${EMOJIS.SPARKLES}`}</Text>
            {birthLine ? (
              <Text style={styles.birthLine} numberOfLines={1}>{birthLine}</Text>
            ) : null}
            {form.city ? (
              <Text style={styles.tagline} numberOfLines={1}>{form.city}</Text>
            ) : (
              <Text style={styles.tagline} numberOfLines={1}>Tap to set birth details</Text>
            )}
          </View>
        </Pressable>

        <View style={styles.divider} />

        <View style={{ paddingVertical: spacing.sm }}>
          {ITEMS.map((item) => {
            // When two items share a route (Home + Reading → "Reading"),
            // also compare the tab param so only one lights up at a time.
            const routeMatches = activeRoute === item.route;
            const tabMatches = item.params?.tab
              ? activeParams?.tab === item.params.tab
              : true;
            const active = routeMatches && tabMatches;
            return (
              <PressableScale
                key={item.key}
                onPress={() => go(item.route, item.params)}
                style={({ pressed }) => [
                  styles.item,
                  active && styles.itemActive,
                  pressed && !active && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.icon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
                  <Text style={styles.itemDesc} numberOfLines={1}>{item.desc}</Text>
                </View>
              </PressableScale>
            );
          })}
        </View>

      </ScrollView>

      {/* Bottom-pinned section */}
      <View>
        <View style={styles.divider} />

        {/* Theme toggle */}
        <Pressable onPress={toggleTheme} style={styles.themeRow}>
          <Text style={styles.icon}>{isDark ? EMOJIS.MOON : EMOJIS.SUN_FACE}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.themeLabel}>{isDark ? "Dark Mode" : "Light Mode"}</Text>
            <Text style={styles.themeSub}>Tap to switch</Text>
          </View>
          <Switch
            value={!isDark}
            onValueChange={toggleTheme}
            thumbColor={isDark ? "#e5e7eb" : colors.primaryLight}
            trackColor={{ false: "#444", true: colors.primaryBorder }}
          />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={async () => {
            navigation.closeDrawer();
            await logout();
          }}
          style={({ pressed }) => [styles.logoutRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.icon, styles.logoutIcon]}>↩</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.logoutLabel}>Log out</Text>
            <Text style={styles.themeSub} numberOfLines={1}>
              {account?.phone ? `Signed in as ${account.phone}` : "End this session"}
            </Text>
          </View>
        </Pressable>

        <View style={styles.divider} />

        <View style={{ padding: spacing.lg }}>
          <Text style={styles.footerTitle}>{Constants.expoConfig?.name || "Astro AI"}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    profile: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      padding: spacing.lg,
    },
    avatar: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: c.primarySoft,
      borderWidth: 2, borderColor: c.primaryBorder,
      alignItems: "center", justifyContent: "center",
    },
    avatarText: { color: c.primaryLight, fontSize: 24, fontWeight: "800" },
    name:       { color: c.text, fontSize: 18, fontWeight: "700" },
    birthLine:  { color: c.textBody, fontSize: 13, marginTop: 3 },
    tagline:    { color: c.textMuted, fontSize: 13, marginTop: 2 },

    divider: { height: 1, backgroundColor: c.cardBorder },

    item: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: 12,
      borderRadius: radius.md, marginHorizontal: spacing.sm, marginVertical: 2,
    },
    itemActive: {
      backgroundColor: c.primarySoft,
      borderWidth: 1, borderColor: c.primaryBorder,
    },
    icon: { fontSize: 22, lineHeight: 32, width: 32, textAlign: "center", textAlignVertical: "center" },
    label:       { color: c.textBody, fontSize: 16, fontWeight: "600" },
    labelActive: { color: c.primaryLight },
    itemDesc:    { color: c.textMuted, fontSize: 12.5, marginTop: 2 },

    themeRow: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: 12,
    },
    themeLabel: { color: c.text, fontSize: 16, fontWeight: "600" },
    themeSub:   { color: c.textMuted, fontSize: 12.5, marginTop: 2 },

    logoutRow: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: 12,
    },
    // dangerStrong reads brighter in dark mode (#ef4444 vs the softer #f87171);
    // icon shares the same red so the row isn't half-white, half-red.
    logoutIcon:  { color: c.dangerStrong },
    logoutLabel: { color: c.dangerStrong, fontSize: 16, fontWeight: "700" },

    footerTitle:   { color: c.textDim, fontSize: 12, fontWeight: "600" },
    footerVersion: { color: c.textFaint, fontSize: 11, marginTop: 4 },
  });
