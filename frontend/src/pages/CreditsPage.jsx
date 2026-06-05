// Buy Cosmic Credits. Lists the admin-defined plans and runs the Razorpay
// checkout: open an order on the backend, pay via the Razorpay widget, then the
// backend verifies the signature and grants the credits. When the backend has
// no Razorpay keys (dev), the order settles instantly in mock mode instead.

import { useEffect, useState } from "react";
import Card from "@/common/Card";
import Button from "@/common/Button";
import ErrorText from "@/common/ErrorText";
import BottomNav from "@/components/BottomNav";
import { useCredits } from "@/common/useCredits";
import { fetchCreditPlans, createCreditOrder, verifyCreditPayment, getCredits } from "@/services/api";
import { loadRazorpay } from "@/common/razorpay";

// paise → "₹49" (drops the .00 when whole rupees).
const formatInr = (paise) => {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
};

export default function CreditsPage() {
  const credits = useCredits();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // plan in the checkout modal
  const [error, setError] = useState("");

  // Refresh the balance + load plans on mount.
  useEffect(() => {
    getCredits();
    fetchCreditPlans()
      .then(setPlans)
      .catch(() => setError("Couldn't load plans. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-140 px-4 pt-8 pb-28">
      <div className="cosmos"></div>
      <div className="stars"></div>

      <h2 className="mb-1.5 text-center text-[22px] font-extrabold text-ink">Cosmic Credits</h2>
      <p className="mx-auto mb-6 max-w-90 text-center text-[13px] leading-[1.6] text-dim">
        Top up to keep unlocking readings, daily guidance, palm & chat.
      </p>

      {/* Current balance */}
      <Card className="flex items-center justify-between" style={{ padding: 18, marginBottom: 20 }}>
        <span className="text-[13px] text-subtle">Your balance</span>
        <span className="inline-flex items-center gap-1.5 text-lg font-bold text-[#c084fc]">
          ✨ {credits ?? "—"}
        </span>
      </Card>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="mt-2 text-center text-[13px] text-dim">Loading plans…</p>
      ) : plans.length === 0 ? (
        <p className="mt-2 text-center text-[13px] text-dim">No plans available right now.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.id}
              className="relative flex flex-col items-center text-center"
              style={{ padding: 22, marginBottom: 0 }}
            >
              {p.bonusLabel && (
                <span className="absolute -top-2.5 rounded-full border border-[rgba(168,85,247,0.5)] bg-[rgba(168,85,247,0.18)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#c084fc]">
                  {p.bonusLabel}
                </span>
              )}
              <div className="mt-1 text-2xl font-bold text-ink">✨ {p.credits}</div>
              <div className="mt-0.5 text-[12px] text-subtle">credits</div>
              <div className="my-3 text-xl font-bold text-[#c084fc]">{formatInr(p.priceInr)}</div>
              <Button
                variant="magic"
                fullWidth
                onClick={() => {
                  setError("");
                  setSelected(p);
                }}
              >
                Buy
              </Button>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <CheckoutModal
          plan={selected}
          onClose={() => setSelected(null)}
          onPaid={() => setSelected(null)}
          onError={(msg) => setError(msg)}
          formatInr={formatInr}
        />
      )}

      <BottomNav activeKey="credits" />
    </div>
  );
}

// Razorpay checkout. Opens an order on the backend, launches the Razorpay
// widget, then verifies the payment server-side. Falls back to mock settlement
// when the backend has no keys (provider:'mock').
function CheckoutModal({ plan, onClose, onPaid, onError, formatInr }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function settled() {
    setDone(true);
    setTimeout(onPaid, 1100); // brief success flash, then close
  }

  async function pay() {
    setBusy(true);
    try {
      const order = await createCreditOrder(plan.id);

      // Dev / no keys — backend already granted the credits.
      if (order.provider === "mock") return settled();

      // Real payment — load the Razorpay SDK and open Checkout.
      await loadRazorpay();
      const { keyId, orderId: rzpOrderId, amount, currency } = order.razorpay;

      const rzp = new window.Razorpay({
        key: keyId,
        order_id: rzpOrderId,
        amount,
        currency,
        name: "Astrology AI",
        description: `${order.credits} Cosmic Credits`,
        theme: { color: "#a855f7" },
        // Surface UPI as the first payment block, then the rest. Requires UPI to
        // be enabled on the Razorpay account (Dashboard → Settings → Payment
        // Methods); this only controls ordering/visibility within Checkout.
        config: {
          display: {
            blocks: {
              upi: { name: "Pay using UPI", instruments: [{ method: "upi" }] },
            },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: true },
          },
        },
        // Called after a successful payment — verify it server-side before we
        // celebrate, since the client result alone isn't trustworthy.
        handler: async (resp) => {
          try {
            await verifyCreditPayment({
              orderId: order.orderId,
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            });
            settled();
          } catch (err) {
            onError(err.message || "Payment verification failed");
            onClose();
          }
        },
        // User dismissed Checkout without paying — re-enable the Pay button.
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", (resp) => {
        onError(resp?.error?.description || "Payment failed");
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      onError(err.message || "Purchase failed");
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={busy ? undefined : onClose}
    >
      <Card
        className="w-full max-w-90 text-center"
        style={{ padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <div className="mb-2 text-4xl">🎉</div>
            <p className="m-0 text-[15px] font-semibold text-success">{plan.credits} credits added!</p>
          </>
        ) : (
          <>
            <div className="mb-2 text-3xl">✨</div>
            <p className="m-0 text-[15px] font-semibold text-ink">{plan.name}</p>
            <p className="mx-0 mb-3 mt-1 text-[13px] text-subtle">
              {plan.credits} credits for {formatInr(plan.priceInr)}
            </p>
            <Button variant="magic" fullWidth busy={busy} busyLabel="Processing…" onClick={pay}>
              Pay {formatInr(plan.priceInr)}
            </Button>
            <p className="mx-0 mb-0 mt-2.5 text-[10.5px] leading-snug text-dim">
              Secured by Razorpay. Credits are added once your payment is verified.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
