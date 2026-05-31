import React, { useState } from "react";
import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MenuButton from "@/components/MenuButton";
import { useStyles } from "@/theme/useStyles";
import { radius, spacing, fontSize } from "@/theme/tokens";
import { useBackToKundali } from "@/utils/useBackToKundali";

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

export default function HelpSupportScreen({ navigation }) {
  const [open, setOpen] = useState(-1);
  const s = useStyles(makeStyles);
  useBackToKundali(navigation);

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

      <CosmicCard>
        <Text style={s.cardTitle}>Quick Contact</Text>
        <ContactRow
          icon="✉️"
          label="Email"
          value="support@astrologyai.app"
          onPress={() => Linking.openURL("mailto:support@astrologyai.app?subject=Astrology AI Support")}
        />
        <ContactRow
          icon="💬"
          label="WhatsApp"
          value="+91 00000 00000"
          onPress={() => Linking.openURL("https://wa.me/910000000000")}
        />
        <ContactRow
          icon="🌐"
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
    title: { color: c.primaryLight, fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" },
    sub:   { color: c.textMuted, fontSize: 11, marginTop: 2, textAlign: "center" },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },

    cardTitle: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: spacing.md },

    contactRow: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
    },
    contactLabel: { color: c.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
    contactValue: { color: c.text, fontSize: 14, fontWeight: "600", marginTop: 2 },

    faqItem: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder, paddingVertical: spacing.sm },
    faqRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
    faqQ:    { flex: 1, color: c.textBody, fontSize: 13.5, fontWeight: "600" },
    faqA:    { color: c.textDim, fontSize: 13, lineHeight: 21, marginTop: 8, paddingRight: spacing.md },
    chev:    { color: c.primaryLight, fontSize: 18, fontWeight: "700", paddingLeft: 8 },

    detailRow: {
      flexDirection: "row", justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
    },
    detailKey: { color: c.textMuted, fontSize: 12 },
    detailVal: { color: c.text, fontSize: 13, fontWeight: "600" },

    disclaimer: {
      fontSize: 11, color: c.textFaint, textAlign: "center",
      marginTop: spacing.lg, lineHeight: 18,
    },
  });
