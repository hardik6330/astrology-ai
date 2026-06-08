// Buy Cosmic Credits. Lists the admin-defined plans and runs a MOCK checkout
// (no real payment yet) — the confirm modal simulates success and the backend
// grants the credits. The modal is isolated so a real Razorpay flow can drop in
// later without touching the plan list.

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Modal, ActivityIndicator, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  requestPurchase,
  useIAP,
  getProducts,
  finishTransaction,
  ErrorCode,
} from "react-native-iap";
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MagicButton from "@/components/MagicButton";
import MenuButton from "@/components/MenuButton";
import { useColors } from "@/theme/ThemeContext";
import { useStyles } from "@/theme/useStyles";
import { spacing, fontSize } from "@/theme/tokens";
import { useCredits } from "@/hooks/useCredits";
import { useBackToKundali } from "@/utils/useBackToKundali";
import { fetchCreditPlans, purchasePlan, getCredits, verifyIapPayment } from "@/services/api";
import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// paise → "₹49" (drops the .00 when whole rupees).
const formatInr = (paise) => {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
};

export default function CreditsScreen({ navigation }) {
  const c = useColors();
  const s = useStyles(makeStyles);
  const credits = useCredits();

  // Consistent with every other top-level screen: Android hardware back
  // returns to the Reading/Kundali home base, not the previous drawer screen.
  useBackToKundali(navigation);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // plan in the checkout modal
  const [error, setError] = useState("");

  const iap = isExpoGo ? null : useIAP();
  const {
    connected,
    currentPurchase,
    currentPurchaseError,
  } = iap || { connected: false };

  // Refresh the balance whenever the screen is focused (drawer screens persist).
  useFocusEffect(useCallback(() => { getCredits(); }, []));

  useEffect(() => {
    fetchCreditPlans()
      .then(async (data) => {
        setPlans(data);
        // If we have product IDs, fetch their localized details from the store
        const skus = data.map(p => p.productId).filter(Boolean);
        if (skus.length > 0 && connected) {
          try {
            await getProducts({ skus });
          } catch (err) {
            console.warn("IAP getProducts failed", err);
          }
        }
      })
      .catch(() => setError("Couldn't load plans. Please try again."))
      .finally(() => setLoading(false));
  }, [connected]);

  // Handle successful purchase from the store
  useEffect(() => {
    const checkPurchase = async () => {
      if (currentPurchase) {
        const receipt = currentPurchase.transactionReceipt;
        if (receipt) {
          try {
            // Find the plan that matches this product
            const plan = plans.find(p => p.productId === currentPurchase.productId);
            if (!plan) return;

            // Verify with our backend
            await verifyIapPayment({
              planId: plan.id,
              platform: Platform.OS,
              receipt: Platform.OS === "ios" ? receipt : undefined,
              purchaseToken: Platform.OS === "android" ? currentPurchase.purchaseToken : undefined,
            });

            // Mark as finished in the store so it doesn't repeat
            await finishTransaction({ purchase: currentPurchase });
            
            // Refresh balance
            getCredits();
            setSelected(null);
          } catch (err) {
            setError(err.message || "Payment verification failed");
          }
        }
      }
    };
    checkPurchase();
  }, [currentPurchase, plans]);

  // Handle store errors
  useEffect(() => {
    if (currentPurchaseError) {
      if (currentPurchaseError.code === ErrorCode.E_USER_CANCELLED) {
        // user just closed the sheet — ignore
      } else {
        setError(currentPurchaseError.message || "Store error");
      }
    }
  }, [currentPurchaseError]);

  return (
    <ScreenContainer showMenu={false}>
      <View style={s.headerRow}>
        <MenuButton />
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>Cosmic Credits</Text>
          <Text style={s.headerSub} numberOfLines={1}>Unlock the secrets of the stars</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Text style={s.subtitle}>Top up to keep unlocking readings, daily guidance, palm & chat.</Text>

      {/* Current balance */}
      <CosmicCard style={s.balanceCard}>
        <View style={s.balanceIndicator} />
        <View>
          <Text style={s.balanceLabel}>YOUR BALANCE</Text>
          <Text style={s.balanceValue}>✨ {credits ?? "—"}</Text>
        </View>
        <View style={s.balanceStatus}>
          <Text style={s.balanceStatusText}>Ready to use</Text>
        </View>
      </CosmicCard>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <View style={s.loaderContainer}>
          <ActivityIndicator size="large" color={c.primaryLight} />
          <Text style={s.loaderText}>Loading cosmic plans…</Text>
        </View>
      ) : plans.length === 0 ? (
        <Text style={s.empty}>No plans available right now.</Text>
      ) : (
        plans.map((p) => {
          const isPopular = p.bonusLabel?.toLowerCase().includes("popular");
          const isBestValue = p.bonusLabel?.toLowerCase().includes("value");

          return (
            <CosmicCard
              key={p.id}
              style={[
                s.planCard,
                isPopular && { borderColor: c.primaryLight + "60", borderWidth: 1.5 },
                isBestValue && { borderColor: c.warning + "40", borderWidth: 1 }
              ]}
            >
              {p.bonusLabel ? (
                <View style={[
                  s.badgeContainer,
                  { backgroundColor: isPopular ? c.primaryLight : isBestValue ? c.warning : c.textMuted }
                ]}>
                  <Text style={s.badgeText}>{p.bonusLabel}</Text>
                </View>
              ) : null}

              <View style={s.planRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.planName}>{p.name}</Text>
                  <Text style={s.planCredits}>✨ {p.credits} credits</Text>
                </View>
                <Text style={[s.planPrice, { color: c.primaryLight }]}>{formatInr(p.priceInr)}</Text>
              </View>

              <MagicButton
                style={{ marginTop: spacing.lg }}
                variant={isPopular ? "primary" : "ghost"}
                onPress={() => { setError(""); setSelected(p); }}
              >
                BUY NOW
              </MagicButton>
            </CosmicCard>
          );
        })
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
      if (plan.productId) {
        // Real In-App Purchase flow
        await requestPurchase({ sku: plan.productId });
        // The rest is handled by the useEffect(currentPurchase) in the parent
      } else {
        // Fallback mock flow (for testing or plans without SKUs)
        await purchasePlan(plan.id);
        setDone(true);
        setTimeout(onClose, 1100);
      }
    } catch (err) {
      if (err.code === ErrorCode.E_USER_CANCELLED) {
        setBusy(false);
      } else {
        onError(err.message || "Purchase failed");
      }
    } finally {
      // For real IAP, we don't setBusy(false) here because the modal stays
      // open until the useEffect handles the success/error update.
      if (!plan.productId) setBusy(false);
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
                {plan?.productId ? "Buy with Store" : "Pay (test)"}
              </MagicButton>
              <MagicButton variant="ghost" style={{ width: "100%", marginTop: spacing.sm }} disabled={busy} onPress={onClose}>
                Cancel
              </MagicButton>
              <Text style={s.modalNote}>
                {plan?.productId 
                  ? "Secured by Apple/Google. Credits are added once payment is verified."
                  : "Test payment — no real charge. Credits are granted instantly."}
              </Text>
            </>
          )}
        </CosmicCard>
      </View>
    </Modal>
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

    subtitle: { color: c.textDim, fontSize: 13.5, lineHeight: 20, textAlign: "center", paddingHorizontal: 20, marginBottom: spacing.xl },
    error:    { color: c.danger, fontSize: 12.5, textAlign: "center", marginBottom: spacing.md },
    empty:    { color: c.textDim, fontSize: 13, textAlign: "center", marginTop: spacing.md },

    balanceCard: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xl,
      overflow: "hidden",
      borderColor: c.bg === "#050508" ? c.primaryLight + "30" : c.primaryLight + "15",
      borderWidth: 1,
      backgroundColor: c.cardBgSolid,
      shadowOpacity: c.bg === "#050508" ? 0.2 : 0.05,
      shadowRadius: 10,
    },
    balanceIndicator: {
      position: "absolute",
      top: 0, left: 0, bottom: 0,
      width: 4,
      backgroundColor: c.primaryLight,
      opacity: 0.9,
    },
    balanceLabel: { color: c.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 4 },
    balanceValue: { color: c.text, fontSize: 26, fontWeight: "900" },
    balanceStatus: {
      flex: 1,
      alignItems: "flex-end",
    },
    balanceStatusText: {
      color: c.primaryLight,
      fontSize: 10,
      fontWeight: "700",
      backgroundColor: c.bg === "#050508" ? c.primaryLight + "15" : c.primaryLight + "08",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 99,
      borderWidth: 1,
      borderColor: c.primaryLight + "20",
    },

    loaderContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
    loaderText: { color: c.textDim, fontSize: 13, marginTop: 12 },

    planCard: { 
      padding: spacing.xl, 
      marginBottom: spacing.lg,
      backgroundColor: c.cardBgSolid,
      borderColor: c.bg === "#050508" ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)",
      borderWidth: 1,
      shadowOpacity: c.bg === "#050508" ? 0.2 : 0.05,
      shadowRadius: 10,
    },
    planRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    planName: { color: c.text, fontSize: 18, fontWeight: "800" },
    planCredits: { color: c.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
    planPrice: { fontSize: 22, fontWeight: "900" },

    badgeContainer: {
      position: "absolute",
      top: -12, alignSelf: "center",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 99,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },

    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
    modalCard:     { width: "100%", maxWidth: 340, alignItems: "center", marginBottom: 0 },
    modalIcon:     { fontSize: 34, lineHeight: 44, marginBottom: 4 },
    modalTitle:    { color: c.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
    modalSub:      { color: c.textBody, fontSize: 13, textAlign: "center", marginTop: 4, marginBottom: spacing.sm },
    modalNote:     { color: c.textDim, fontSize: 10.5, lineHeight: 15, textAlign: "center", marginTop: 10 },
  });
