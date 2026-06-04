// Buy Cosmic Credits. Lists the admin-defined plans and runs a MOCK checkout
// (no real payment yet) — the confirm modal simulates success and the backend
// grants the credits. The modal is isolated so a real Razorpay flow can drop in
// later without touching the plan list.

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MagicButton from "@/components/MagicButton";
import { useColors } from "@/theme/ThemeContext";
import { useStyles } from "@/theme/useStyles";
import { spacing, fontSize } from "@/theme/tokens";
import { useCredits } from "@/hooks/useCredits";
import { fetchCreditPlans, purchasePlan, getCredits } from "@/services/api";

// paise → "₹49" (drops the .00 when whole rupees).
const formatInr = (paise) => {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
};

export default function CreditsScreen() {
  const c = useColors();
  const s = useStyles(makeStyles);
  const credits = useCredits();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // plan in the checkout modal
  const [error, setError] = useState("");

  // Refresh the balance whenever the screen is focused (drawer screens persist).
  useFocusEffect(useCallback(() => { getCredits(); }, []));

  useEffect(() => {
    fetchCreditPlans()
      .then(setPlans)
      .catch(() => setError("Couldn't load plans. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScreenContainer>
      <Text style={s.title}>Cosmic Credits</Text>
      <Text style={s.subtitle}>Top up to keep unlocking readings, daily guidance, palm & chat.</Text>

      {/* Current balance */}
      <CosmicCard style={s.balanceCard}>
        <Text style={s.balanceLabel}>Your balance</Text>
        <Text style={[s.balanceValue, { color: c.primaryLight }]}>✨ {credits ?? "—"}</Text>
      </CosmicCard>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={c.primaryLight} style={{ marginTop: spacing.lg }} />
      ) : plans.length === 0 ? (
        <Text style={s.empty}>No plans available right now.</Text>
      ) : (
        plans.map((p) => (
          <CosmicCard key={p.id} style={s.planCard}>
            <View style={s.planRow}>
              <View style={{ flex: 1 }}>
                <View style={s.planTitleRow}>
                  <Text style={s.planName}>{p.name}</Text>
                  {p.bonusLabel ? <Text style={s.badge}>{p.bonusLabel}</Text> : null}
                </View>
                <Text style={s.planCredits}>✨ {p.credits} credits</Text>
              </View>
              <Text style={[s.planPrice, { color: c.primaryLight }]}>{formatInr(p.priceInr)}</Text>
            </View>
            <MagicButton
              style={{ marginTop: spacing.md }}
              onPress={() => { setError(""); setSelected(p); }}
            >
              Buy
            </MagicButton>
          </CosmicCard>
        ))
      )}

      <CheckoutModal
        plan={selected}
        onClose={() => setSelected(null)}
        onError={(msg) => { setError(msg); setSelected(null); }}
      />
    </ScreenContainer>
  );
}

// Mock checkout modal. Clearly labelled test-only. Swap the pay() body for a
// Razorpay handler later — the success path just calls purchasePlan(plan.id).
function CheckoutModal({ plan, onClose, onError }) {
  const c = useColors();
  const s = useStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Reset the success flash whenever a new plan opens the modal.
  useEffect(() => { setDone(false); }, [plan?.id]);

  async function pay() {
    setBusy(true);
    try {
      await purchasePlan(plan.id);
      setDone(true);
      setTimeout(onClose, 1100);
    } catch (err) {
      onError(err.message || "Purchase failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={!!plan} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={s.modalBackdrop}>
        <CosmicCard style={s.modalCard}>
          {done ? (
            <>
              <Text style={s.modalIcon}>🎉</Text>
              <Text style={[s.modalTitle, { color: c.success }]}>{plan?.credits} credits added!</Text>
            </>
          ) : (
            <>
              <Text style={s.modalIcon}>✨</Text>
              <Text style={s.modalTitle}>{plan?.name}</Text>
              <Text style={s.modalSub}>
                {plan?.credits} credits for {plan ? formatInr(plan.priceInr) : ""}
              </Text>
              <MagicButton style={{ width: "100%", marginTop: spacing.sm }} loading={busy} onPress={pay}>
                Pay (test)
              </MagicButton>
              <MagicButton variant="ghost" style={{ width: "100%", marginTop: spacing.sm }} disabled={busy} onPress={onClose}>
                Cancel
              </MagicButton>
              <Text style={s.modalNote}>Test payment — no real charge. Credits are granted instantly.</Text>
            </>
          )}
        </CosmicCard>
      </View>
    </Modal>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title:    { color: c.text, fontSize: 22, fontWeight: "800", marginBottom: 4 },
    subtitle: { color: c.textDim, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
    error:    { color: c.danger, fontSize: 12.5, marginBottom: spacing.md },
    empty:    { color: c.textDim, fontSize: 13, marginTop: spacing.md },

    balanceCard:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    balanceLabel: { color: c.textBody, fontSize: fontSize.md },
    balanceValue: { fontSize: 22, fontWeight: "800" },

    planCard:     {},
    planRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    planTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    planName:     { color: c.text, fontSize: fontSize.md, fontWeight: "700" },
    planCredits:  { color: c.textBody, fontSize: 13, marginTop: 3 },
    planPrice:    { fontSize: 20, fontWeight: "800", marginLeft: spacing.md },
    badge: {
      color: c.primaryLight,
      fontSize: 9.5,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      borderWidth: 1,
      borderColor: c.primaryBorder,
      backgroundColor: "rgba(168,85,247,0.15)",
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      overflow: "hidden",
    },

    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
    modalCard:     { width: "100%", maxWidth: 340, alignItems: "center", marginBottom: 0 },
    modalIcon:     { fontSize: 34, lineHeight: 44, marginBottom: 4 },
    modalTitle:    { color: c.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
    modalSub:      { color: c.textBody, fontSize: 13, textAlign: "center", marginTop: 4, marginBottom: spacing.sm },
    modalNote:     { color: c.textDim, fontSize: 10.5, lineHeight: 15, textAlign: "center", marginTop: 10 },
  });
