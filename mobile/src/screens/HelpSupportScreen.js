import React, { useState } from "react";
import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import CosmicCard from "../components/CosmicCard";
import MenuButton from "../components/MenuButton";
import { useStyles } from "../theme/useStyles";
import { radius, spacing, fontSize } from "../theme/tokens";

const FAQ = [
  {
    q: "How accurate is the kundali calculation?",
    a: "We use precision astronomy (astronomy-engine) to compute planet positions to the arc-minute, then apply the Lahiri ayanamsha for the sidereal (Vedic) zodiac. The math is identical to professional ephemerides.",
  },
  {
    q: "Where is my data stored?",
    a: "Your birth details are saved locally on your device. The AI reading is stored on our server tied to your birth details (no account needed). Palm photos are analyzed and immediately discarded — never stored.",
  },
  {
    q: "Why does the AI sometimes say 'busy right now'?",
    a: "Google Gemini occasionally rate-limits requests during peak load. Wait ~40 seconds and tap retry — your reading will come through.",
  },
  {
    q: "Can I change my birth details?",
    a: "Yes. Open the side menu → Profile → Update Birth Details. The new chart will replace the old one.",
  },
  {
    q: "How do I get the best palm reading?",
    a: "Use bright, even lighting. Hold your dominant hand flat with fingers slightly spread. The palm should fill most of the frame. Remove rings and mehndi if possible.",
  },
];

export default function HelpSupportScreen() {
  const [open, setOpen] = useState(-1);
  const s = useStyles(makeStyles);

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

      <CosmicCard>
        <Text style={s.cardTitle}>About</Text>
        <View style={s.detailRow}>
          <Text style={s.detailKey}>Version</Text>
          <Text style={s.detailVal}>1.0.0</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailKey}>Engine</Text>
          <Text style={s.detailVal}>Gemini 2.5 Pro</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailKey}>Astronomy</Text>
          <Text style={s.detailVal}>astronomy-engine</Text>
        </View>
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
