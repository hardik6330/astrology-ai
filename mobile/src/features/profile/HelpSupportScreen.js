import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Constants from "expo-constants";
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MenuButton from "@/components/MenuButton";
import { SkeletonHelp } from "@/components/Skeleton";
import { EMOJIS } from "@/utils/emojis";
import { useStyles } from "@/theme/useStyles";
import { radius, spacing, fontSize } from "@/theme/tokens";
import { useBackToKundali } from "@/utils/useBackToKundali";

// Short settle-in shimmer before content fades in (no real data fetch).
const BOOT_MS = 450;

const FAQ = [
  {
    q: "How is my birth chart calculated?",
    a: "When you enter your name, date, time, and place of birth, the app calculates the exact position of the Sun, Moon, and planets in the sky at that moment. It then maps those positions onto the twelve houses of the Vedic zodiac — giving you a personal sky-snapshot from the instant you were born.",
  },
  {
    q: "How does the AI personalise my reading?",
    a: "Your unique chart is summarised into a fact sheet — your ascendant, planetary placements, ruling periods, and key patterns. The AI reads this fact sheet and writes a reading specifically about you, in your own context. Two different people never get the same reading.",
  },
  {
    q: "How do I get the best palm reading?",
    a: "Use bright, even lighting and hold your dominant hand flat with fingers slightly spread. Make sure the palm fills most of the frame, and remove rings if possible.",
  },
];

// App name + version pulled live from app.json (expo config) — single source.
const APP_NAME = Constants.expoConfig?.name || "Astro AI";
const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

export default function HelpSupportScreen({ navigation }) {
  const [open, setOpen] = useState(-1);
  const [booting, setBooting] = useState(true);
  const s = useStyles(makeStyles);
  useBackToKundali(navigation);

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), BOOT_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <ScreenContainer showMenu={false}>
      <View style={s.headerRow}>
        <MenuButton />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.title} numberOfLines={1}>Help Center</Text>
          <Text style={s.sub} numberOfLines={1}>We're here to guide you</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {booting ? <SkeletonHelp /> : (
      <Animated.View entering={FadeIn.duration(300)}>
      <CosmicCard>
        <Text style={s.cardTitle}>Quick Contact</Text>
        <ContactRow
          icon={EMOJIS.ENVELOPE}
          label="Email"
          value="support@astrologyai.app"
          onPress={() => Linking.openURL("mailto:support@astrologyai.app?subject=Astrology AI Support")}
        />
        <ContactRow
          icon={EMOJIS.CHAT}
          label="WhatsApp"
          value="+91 00000 00000"
          onPress={() => Linking.openURL("https://wa.me/910000000000")}
        />
        <ContactRow
          icon={EMOJIS.GLOBE}
          label="Website"
          value="astrologyai.app"
          onPress={() => Linking.openURL("https://astrologyai.app")}
        />
      </CosmicCard>

      <CosmicCard>
        <Text style={s.cardTitle}>Frequently Asked</Text>
        {FAQ.map((item, i) => (
          <View key={i} style={s.faqItem}>
            <Pressable onPress={() => setOpen(open === i ? -1 : i)} style={s.faqRow}>
              <Text style={s.faqQ}>{item.q}</Text>
              <Text style={s.chev}>{open === i ? "−" : "+"}</Text>
            </Pressable>
            {open === i && <Text style={s.faqA}>{item.a}</Text>}
          </View>
        ))}
      </CosmicCard>

      <Text style={s.disclaimer}>
        Astrology is a tool for self-reflection. Insights here are interpretive, not predictive — always trust your own judgment.
      </Text>

      <Text style={s.version}>{APP_NAME} · v{APP_VERSION}</Text>
      </Animated.View>
      )}
    </ScreenContainer>
  );
}

function ContactRow({ icon, label, value, onPress }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.contactRow, pressed && { opacity: 0.6 }]}>
      <Text style={{ fontSize: 22, lineHeight: 30, marginRight: 12 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.contactLabel}>{label}</Text>
        <Text style={s.contactValue}>{value}</Text>
      </View>
      <Text style={s.chev}>→</Text>
    </Pressable>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title: { color: c.primaryLight, fontSize: 18, lineHeight: 24, fontWeight: "700", textAlign: "center" },
    sub:   { color: c.textMuted, fontSize: 13, marginTop: 2, textAlign: "center" },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    cardTitle: { color: c.text, fontSize: fontSize.md, lineHeight: 24, fontWeight: "700", marginBottom: spacing.md },

    contactRow: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
    },
    contactLabel: { color: c.textMuted, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 },
    contactValue: { color: c.text, fontSize: 16, fontWeight: "600", marginTop: 2 },

    faqItem: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder, paddingVertical: spacing.sm },
    faqRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
    faqQ:    { flex: 1, color: c.textBody, fontSize: 16, fontWeight: "600" },
    faqA:    { color: c.textDim, fontSize: 15, lineHeight: 23, marginTop: 8, paddingRight: spacing.md },
    chev:    { color: c.primaryLight, fontSize: 20, fontWeight: "700", paddingLeft: 8 },

    detailRow: {
      flexDirection: "row", justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
    },
    detailKey: { color: c.textMuted, fontSize: 14 },
    detailVal: { color: c.text, fontSize: 15, fontWeight: "600" },

    disclaimer: {
      fontSize: 13, color: c.textFaint, textAlign: "center",
      marginTop: spacing.lg, lineHeight: 18,
    },
    version: {
      fontSize: 12, color: c.textFaint, textAlign: "center",
      marginTop: spacing.md,
    },
  });
