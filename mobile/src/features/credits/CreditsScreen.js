// Buy Cosmic Credits. Lists the admin-defined plans and runs a MOCK checkout
// (no real payment yet) — the confirm modal simulates success and the backend
// grants the credits. The modal is isolated so a real Razorpay flow can drop in
// later without touching the plan list.

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Modal, ActivityIndicator, Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
// react-native-iap removed — incompatible with RN 0.81 (Kotlin 2.x).
// IAP is mock-only for now (no plan has a productId). Re-add when upgrading
// to react-native-iap v14+ with react-native-nitro-modules.
const requestPurchase = async () => { throw new Error("IAP not installed"); };
const useIAP = () => ({ connected: false });
const getProducts = async () => [];
const finishTransaction = async () => {};
const ErrorCode = { E_USER_CANCELLED: "E_USER_CANCELLED" };
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MagicButton from "@/components/MagicButton";
import MenuButton from "@/components/MenuButton";
import { useColors } from "@/theme/ThemeContext";
import { useStyles } from "@/theme/useStyles";
import { radius, spacing, fontSize } from "@/theme/tokens";
import { useCredits } from "@/hooks/useCredits";
import { useBackToKundali } from "@/utils/useBackToKundali";
import { fetchCreditPlans, purchasePlan, getCredits, verifyIapPayment } from "@/services/api";
import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const PLAN_FEATURES = [
  "AI Kundali Interpretation",
  "Daily Personalized Guidance",
  "AI Astrologer Chat Access",
  "Palm Reading Analysis",
];

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
        <View style={s.plansContainer}>
          {plans.map((p) => {
            const isPopular = p.bonusLabel?.toLowerCase().includes("popular");
            const isBestValue = p.bonusLabel?.toLowerCase().includes("value");
            const perCredit = (p.priceInr / 100 / p.credits).toFixed(2);

            return (
              <Pressable
                key={p.id}
                onPress={() => { setError(""); setSelected(p); }}
                style={({ pressed }) => [
                  s.planCard,
                  isPopular && s.planCardPopular,
                  isBestValue && s.planCardBestValue,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                ]}
              >
                {p.bonusLabel ? (
                  <View style={[
                    s.badgeContainer,
                    { backgroundColor: isPopular ? c.primary : isBestValue ? c.warning : c.textMuted }
                  ]}>
                    <Text style={s.badgeText}>{p.bonusLabel}</Text>
                  </View>
                ) : null}

                <View style={s.planContent}>
                  <View style={s.planIconContainer}>
                    <Ionicons 
                      name={p.credits >= 100 ? "diamond-outline" : "sparkles-outline"} 
                      size={28} 
                      color={isPopular ? c.primaryLight : c.textDim} 
                    />
                  </View>
                  
                  <View style={s.planInfo}>
                    <Text style={s.planName}>{p.name}</Text>
                    <Text style={s.planCredits}>✨ {p.credits} Credits</Text>
                  </View>

                  <View style={s.planPriceContainer}>
                    <Text style={[s.planPrice, { color: isPopular ? c.primaryLight : c.text }]}>
                      {formatInr(p.priceInr)}
                    </Text>
                    <View style={[s.buyArrow, isPopular && { backgroundColor: c.primarySoft }]}>
                      <Ionicons name="chevron-forward" size={18} color={isPopular ? c.primaryLight : c.textMuted} />
                    </View>
                  </View>
                </View>

                <View style={s.featuresList}>
                  {PLAN_FEATURES.map((feat, idx) => (
                    <View key={idx} style={s.featureRow}>
                      <Ionicons name="checkmark-circle" size={14} color={isPopular ? c.primaryLight : c.success} />
                      <Text style={s.featureText}>{feat}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
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
      marginBottom: spacing.md,
    },
    headerTitle: { color: c.primaryLight, fontSize: 18, lineHeight: 24, fontWeight: "700", textAlign: "center" },
    headerSub:   { color: c.textMuted, fontSize: 13, marginTop: 2, textAlign: "center" },

    subtitle: { color: c.textDim, fontSize: 16, lineHeight: 24, textAlign: "center", paddingHorizontal: 20, marginBottom: spacing.xl },
    error:    { color: c.danger, fontSize: 14.5, textAlign: "center", marginBottom: spacing.md },
    empty:    { color: c.textDim, fontSize: 15, textAlign: "center", marginTop: spacing.md },

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
    balanceLabel: { color: c.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginBottom: 4 },
    balanceValue: { color: c.text, fontSize: 30, fontWeight: "900" },
    balanceStatus: {
      flex: 1,
      alignItems: "flex-end",
    },
    balanceStatusText: {
      color: c.primaryLight,
      fontSize: 12,
      fontWeight: "700",
      backgroundColor: c.bg === "#050508" ? c.primaryLight + "15" : c.primaryLight + "08",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 99,
      borderWidth: 1,
      borderColor: c.primaryLight + "20",
    },

    loaderContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
    loaderText: { color: c.textDim, fontSize: 15, marginTop: 12 },

    plansContainer: {
      gap: spacing.md,
    },
    planCard: { 
      padding: spacing.lg, 
      marginBottom: spacing.sm,
      backgroundColor: c.cardBgSolid,
      borderColor: c.cardBorder,
      borderWidth: 1,
      borderRadius: radius.lg,
      position: "relative",
    },
    planCardPopular: {
      borderColor: c.primary,
      borderWidth: 2,
      backgroundColor: c.bg === "#050508" ? "rgba(168,85,247,0.05)" : "rgba(168,85,247,0.02)",
    },
    planCardBestValue: {
      borderColor: c.warning,
    },
    planContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    planIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: c.inputBg,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    planInfo: {
      flex: 1,
    },
    planCredits: {
      color: c.primaryLight,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 2,
    },
    planName: {
      color: c.text,
      fontSize: 18,
      fontWeight: "700",
    },
    planPriceContainer: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: spacing.sm,
    },
    planPrice: {
      fontSize: 20,
      fontWeight: "900",
    },
    buyArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },

    featuresList: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.cardBorder,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "47%", // roughly 2 columns
      gap: 6,
    },
    featureText: {
      color: c.textDim,
      fontSize: 11,
    },

    badgeContainer: {
      position: "absolute",
      top: -10,
      right: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      zIndex: 10,
    },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },

    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
    modalCard:     { width: "100%", maxWidth: 340, alignItems: "center", marginBottom: 0 },
    modalIcon:     { fontSize: 34, lineHeight: 44, marginBottom: 4 },
    modalTitle:    { color: c.text, fontSize: 18, fontWeight: "700", textAlign: "center" },
    modalSub:      { color: c.textBody, fontSize: 15, textAlign: "center", marginTop: 4, marginBottom: spacing.sm },
    modalNote:     { color: c.textDim, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 10 },
  });
