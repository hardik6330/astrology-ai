// Buy Cosmic Credits. Lists the admin-defined plans and runs native In-App
// Purchases (Apple/Google) for plans with a store `productId`; the backend
// verifies the receipt before granting. Plans without a productId fall back to
// a mock grant — DEV ONLY (gated below), never in a shipped build.

import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Modal, Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  iapAvailable,
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getErrorCodes,
  getSubscriptions,
  requestSubscription,
} from "./iapClient";
import ScreenContainer from "@/components/ScreenContainer";
import CosmicCard from "@/components/CosmicCard";
import MagicButton from "@/components/MagicButton";
import MenuButton from "@/components/MenuButton";
import { SkeletonCredits } from "@/components/Skeleton";
import { EMOJIS } from "@/utils/emojis";
import { useColors } from "@/theme/ThemeContext";
import { useStyles } from "@/theme/useStyles";
import { radius, spacing, fontSize } from "@/theme/tokens";
import { useCredits } from "@/hooks/useCredits";
import { useBackToKundali } from "@/utils/useBackToKundali";
import { fetchCreditPlans, purchasePlan, getCredits, verifyIapPayment, verifySubscription, getSubscriptionStatus } from "@/services/api";
import { logEvent } from "@/features/notifications/analytics";

const PLAN_FEATURES = [
  "AI Birth Chart Interpretation",
  "Daily Personalized Guidance",
  "AI Astrologer Chat Access",
  "Palm Reading Analysis",
];

// paise → "₹49" (drops the .00 when whole rupees).
const formatInr = (paise) => {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
};

// Subscriptions show a period so "₹149" doesn't read as a one-off.
const periodLabel = (days) => (days === 30 ? "/mo" : days === 365 ? "/yr" : `/${days}d`);

export default function CreditsScreen({ navigation, route }) {
  const c = useColors();
  const s = useStyles(makeStyles);
  const credits = useCredits();
  // Set when the user arrived from a "not enough credits" prompt — after a
  // successful top-up we send them straight back to that feature screen.
  const returnTo = route?.params?.returnTo || null;

  // Consistent with every other top-level screen: Android hardware back
  // returns to the Reading/Kundali home base, not the previous drawer screen.
  useBackToKundali(navigation);
  const [plans, setPlans] = useState([]);
  // The user's current subscription, or null. Drives the "active" banner and
  // stops us offering a plan they're already on.
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // plan in the checkout modal
  const [error, setError] = useState("");

  // Close the modal after a successful purchase, then return to the originating
  // feature if we came from one.
  const finishAndReturn = useCallback(() => {
    setSelected(null);
    if (returnTo) navigation.navigate(returnTo);
  }, [returnTo, navigation]);

  // Latest plans for the purchase listener closure (set up once on mount).
  const plansRef = useRef([]);
  useEffect(() => { plansRef.current = plans; }, [plans]);

  // Refresh the balance whenever the screen is focused (drawer screens persist).
  useFocusEffect(useCallback(() => { getCredits(); }, []));

  // Open the native store connection once and listen for purchase results.
  // Imperative API (not the useIAP hook) so there are no conditional hooks and
  // the whole thing is a clean no-op in Expo Go / non-IAP builds.
  useEffect(() => {
    if (!iapAvailable()) return;

    let purchaseSub, errorSub;
    const E = getErrorCodes();

    initConnection()
      .then(() => {
        // Resolve a store result → verify with our backend → finish → refresh.
        purchaseSub = purchaseUpdatedListener(async (purchase) => {
          const receipt = purchase.transactionReceipt;
          if (!receipt) return;
          const plan = plansRef.current.find((p) => p.productId === purchase.productId);
          if (!plan) return;
          try {
            const payload = {
              planId: plan.id,
              platform: Platform.OS,
              receipt: Platform.OS === "ios" ? receipt : undefined,
              purchaseToken: Platform.OS === "android" ? purchase.purchaseToken : undefined,
            };
            // A subscription grants its allowance every cycle, so it goes to the
            // subscription verifier and must NOT be consumed — consuming it
            // makes the store forget the entitlement.
            if (plan.isSubscription) await verifySubscription(payload);
            else await verifyIapPayment(payload);
            // Only finish AFTER the backend grants — an unfinished txn is
            // re-delivered on next launch, so a failed verify can retry.
            await finishTransaction(purchase, { isConsumable: !plan.isSubscription });
            logEvent("purchase_completed", {
              credits: plan.credits,
              price_inr: plan.priceInr / 100,
              method: plan.isSubscription ? "subscription" : "iap",
            });
            if (plan.isSubscription) getSubscriptionStatus().then(setSubscription);
            getCredits();
            setSelected(null);
            if (returnTo) navigation.navigate(returnTo);
          } catch (err) {
            setError(err.message || "Payment verification failed");
          }
        });
        errorSub = purchaseErrorListener((e) => {
          if (e?.code === E.E_USER_CANCELLED) return; // sheet dismissed — ignore
          setError(e?.message || "Store error");
        });
      })
      .catch((err) => console.warn("IAP initConnection failed", err));

    return () => {
      purchaseSub?.remove?.();
      errorSub?.remove?.();
      endConnection();
    };
  }, []);

  useEffect(() => {
    fetchCreditPlans()
      .then(async (data) => {
        setPlans(data);
        // Warm the store's localized details. Consumables and subscriptions
        // live in SEPARATE store catalogues — getProducts() never returns a
        // subscription SKU, so they have to be queried apart.
        if (iapAvailable()) {
          const packSkus = data.filter((p) => !p.isSubscription).map((p) => p.productId).filter(Boolean);
          const subSkus  = data.filter((p) => p.isSubscription).map((p) => p.productId).filter(Boolean);
          if (packSkus.length) {
            try { await getProducts(packSkus); } catch (err) { console.warn("IAP getProducts failed", err); }
          }
          if (subSkus.length) {
            try { await getSubscriptions(subSkus); } catch (err) { console.warn("IAP getSubscriptions failed", err); }
          }
        }
        getSubscriptionStatus().then(setSubscription);
      })
      .catch(() => setError("Couldn't load plans. Please try again."))
      .finally(() => setLoading(false));
  }, []);

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
          <Text style={s.balanceValue}>{EMOJIS.SPARKLES} {credits ?? "—"}</Text>
        </View>
        <View style={s.balanceStatus}>
          <Text style={s.balanceStatusText}>Ready to use</Text>
        </View>
      </CosmicCard>

      {subscription?.active ? (
        <CosmicCard style={s.balanceCard}>
          <View style={s.balanceIndicator} />
          <View style={{ flex: 1 }}>
            <Text style={s.balanceLabel}>SUBSCRIBED</Text>
            <Text style={s.balanceValue}>{subscription.plan?.name || "Active plan"}</Text>
            <Text style={s.headerSub}>
              {subscription.autoRenew ? "Renews" : "Ends"}{" "}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </Text>
          </View>
        </CosmicCard>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <SkeletonCredits />
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
                onPress={() => {
                  setError("");
                  // Already subscribed to this one — the store, not us, owns
                  // changing or cancelling it.
                  if (subscription?.active && subscription.planId === p.id) {
                    setError("You're already subscribed. Manage it in your store account.");
                    return;
                  }
                  setSelected(p);
                }}
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
                    <Text style={s.planCredits}>
                      {EMOJIS.SPARKLES} {p.credits} Credits{p.isSubscription ? " every month" : ""}
                    </Text>
                  </View>

                  <View style={s.planPriceContainer}>
                    <Text style={[s.planPrice, { color: isPopular ? c.primaryLight : c.text }]}>
                      {formatInr(p.priceInr)}{p.isSubscription ? periodLabel(p.periodDays) : ""}
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
        onPaid={finishAndReturn}
        onError={(msg) => { setError(msg); setSelected(null); }}
      />
    </ScreenContainer>
  );
}

// Checkout modal. Plans with a store `productId` run the native IAP sheet
// (success handled by the parent's purchase listener). Plans without one fall
// back to a mock grant that is DEV-ONLY — in a release build it's refused, so a
// shipped app can never give away credits without a verified payment.
const MOCK_ALLOWED = __DEV__; // never true in a production (release) build
function CheckoutModal({ plan, onClose, onPaid, onError }) {
  const c = useColors();
  const s = useStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const closeTimer = useRef(null);

  // Reset the success flash whenever a new plan opens the modal; clear any
  // pending auto-close timer so it can't fire into an unmounted modal.
  useEffect(() => {
    setDone(false);
    return () => clearTimeout(closeTimer.current);
  }, [plan?.id]);

  const canMock = !plan?.productId && MOCK_ALLOWED;
  const purchasable = !!plan?.productId || canMock;

  async function pay() {
    setBusy(true);
    try {
      if (plan.productId) {
        if (!iapAvailable()) throw new Error("In-app purchases aren't available in this build.");
        // Native IAP — the parent's purchaseUpdatedListener verifies & grants.
        // Subscriptions go through a different store call (and on Android need
        // the base-plan offer token, which requestSubscription resolves).
        if (plan.isSubscription) await requestSubscription(plan.productId);
        else await requestPurchase(plan.productId);
        // Modal stays open (busy) until the listener closes it.
      } else if (MOCK_ALLOWED) {
        // Dev-only fallback for plans without a store SKU.
        await purchasePlan(plan.id);
        logEvent("purchase_completed", { credits: plan.credits, price_inr: plan.priceInr / 100, method: "mock" });
        setDone(true);
        closeTimer.current = setTimeout(onPaid, 1100);
      } else {
        throw new Error("This plan isn't available for purchase yet.");
      }
    } catch (err) {
      if (err?.code === getErrorCodes().E_USER_CANCELLED) {
        setBusy(false);
      } else {
        onError(err.message || "Purchase failed");
      }
    } finally {
      // Real IAP keeps the modal busy until the listener resolves it.
      if (!plan.productId) setBusy(false);
    }
  }

  return (
    <Modal visible={!!plan} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={s.modalBackdrop}>
        <CosmicCard style={s.modalCard}>
          {done ? (
            <>
              <Text style={s.modalIcon}>{EMOJIS.PARTY}</Text>
              <Text style={[s.modalTitle, { color: c.success }]}>{plan?.credits} credits added!</Text>
            </>
          ) : (
            <>
              <Text style={s.modalIcon}>{EMOJIS.SPARKLES}</Text>
              <Text style={s.modalTitle}>{plan?.name}</Text>
              <Text style={s.modalSub}>
                {plan?.credits} credits for {plan ? formatInr(plan.priceInr) : ""}
              </Text>
              <MagicButton
                style={{ width: "100%", marginTop: spacing.sm }}
                loading={busy}
                disabled={!purchasable}
                onPress={pay}
              >
                {plan?.productId ? "Buy with Store" : canMock ? "Pay (test)" : "Coming soon"}
              </MagicButton>
              <MagicButton variant="ghost" style={{ width: "100%", marginTop: spacing.sm }} disabled={busy} onPress={onClose}>
                Cancel
              </MagicButton>
              {/* Trust signals at the payment moment — all literally true. */}
              <View style={s.trustRow}>
                <Ionicons name="lock-closed" size={12} color={c.success} />
                <Text style={s.trustText}>Secure payment · verified before credits are added</Text>
              </View>
              <View style={s.trustRow}>
                <Ionicons name="infinite" size={13} color={c.primaryLight} />
                <Text style={s.trustText}>Credits never expire · No subscription</Text>
              </View>
              <Text style={s.modalNote}>
                {plan?.productId
                  ? "Secured by Apple/Google. Credits are added once payment is verified."
                  : canMock
                    ? "Test payment — no real charge. Credits are granted instantly."
                    : "This plan isn't available for purchase yet."}
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
    trustRow:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
    trustText:     { color: c.textBody, fontSize: 12, fontWeight: "600", textAlign: "center" },
  });
