// Buy Cosmic Credits. Lists the admin-defined plans and runs Apple In-App
// Purchases through RevenueCat for plans with a store `productId`. RevenueCat
// verifies the receipt and posts to the backend webhook, which grants the
// credits — this screen just re-fetches the balance afterwards. Plans without
// a productId can't be bought (there is no mock path any more).

import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { iapAvailable, getProducts, purchaseProduct } from "./iapClient";
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
import { fetchCreditPlans, getCredits, getSubscriptionStatus } from "@/services/api";
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

  // Refresh the balance whenever the screen is focused (drawer screens persist).
  useFocusEffect(useCallback(() => { getCredits(); }, []));

  // Store products by id (localized price). Empty in Expo Go / no-key builds.
  const [products, setProducts] = useState({});

  useEffect(() => {
    fetchCreditPlans()
      .then(async (data) => {
        setPlans(data);
        const ids = data.map((p) => p.productId).filter(Boolean);
        if (iapAvailable() && ids.length) {
          try { setProducts(await getProducts(ids)); } catch (err) { console.warn("RC getProducts failed", err); }
        }
        getSubscriptionStatus().then(setSubscription);
      })
      .catch(() => setError("Couldn't load plans. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  // Apple confirmed → RevenueCat posts to our webhook → credits land. Poll the
  // balance briefly so the badge catches up without a restart.
  const onPurchased = useCallback((plan) => {
    logEvent("purchase_completed", {
      credits: plan.credits,
      price_inr: plan.priceInr / 100,
      method: plan.isSubscription ? "subscription" : "iap",
    });
    [0, 1500, 4000].forEach((ms) => setTimeout(getCredits, ms));
    if (plan.isSubscription) setTimeout(() => getSubscriptionStatus().then(setSubscription), 1500);
    finishAndReturn();
  }, [finishAndReturn]);

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
        product={selected?.productId ? products[selected.productId] : null}
        onClose={() => setSelected(null)}
        onPaid={onPurchased}
        onError={(msg) => { setError(msg); setSelected(null); }}
      />
    </ScreenContainer>
  );
}

// Checkout modal. Runs the RevenueCat purchase sheet for the plan's store
// product; a plan without a productId (or a build without the store) can't be
// bought — there is no mock grant, so a shipped app can never give away credits.
function CheckoutModal({ plan, product, onClose, onPaid, onError }) {
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

  const purchasable = !!product;

  async function pay() {
    setBusy(true);
    try {
      await purchaseProduct(product);
      setDone(true);
      closeTimer.current = setTimeout(() => onPaid(plan), 1100);
    } catch (err) {
      if (!err?.userCancelled) onError(err.message || "Purchase failed");
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
              <Text style={s.modalIcon}>{EMOJIS.PARTY}</Text>
              <Text style={[s.modalTitle, { color: c.success }]}>{plan?.credits} credits added!</Text>
            </>
          ) : (
            <>
              <Text style={s.modalIcon}>{EMOJIS.SPARKLES}</Text>
              <Text style={s.modalTitle}>{plan?.name}</Text>
              <Text style={s.modalSub}>
                {plan?.credits} credits for {product?.priceString ?? (plan ? formatInr(plan.priceInr) : "")}
              </Text>
              <MagicButton
                style={{ width: "100%", marginTop: spacing.sm }}
                loading={busy}
                disabled={!purchasable}
                onPress={pay}
              >
                {purchasable ? `Buy ${product.priceString}` : "Coming soon"}
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
                <Text style={s.trustText}>{plan?.isSubscription ? "Renews monthly · cancel anytime in Settings" : "Credits never expire · No subscription"}</Text>
              </View>
              <Text style={s.modalNote}>
                {purchasable
                  ? "Secured by Apple. Credits are added once payment is verified."
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
