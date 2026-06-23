// Buy Cosmic Credits. Lists the admin-defined plans and runs the Razorpay
// checkout: open an order on the backend, pay via the Razorpay widget, then the
// backend verifies the signature and grants the credits. When the backend has
// no Razorpay keys (dev), the order settles instantly in mock mode instead.

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Card from "@/common/Card";
import Button from "@/common/Button";
import ErrorText from "@/common/ErrorText";
import BottomNav from "@/components/BottomNav";
import { useCredits } from "@/common/useCredits";
import { fetchCreditPlans, createCreditOrder, verifyCreditPayment, getCredits } from "@/services/api";
import { loadRazorpay } from "@/common/razorpay";
import { Icon } from "@/utils/icons";
import { LuLock, LuInfinity, LuShieldCheck } from "react-icons/lu";

// paise → "₹49" (drops the .00 when whole rupees).
const formatInr = (paise) => {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
};

export default function CreditsPage() {
  const credits = useCredits();
  const navigate = useNavigate();
  const location = useLocation();
  // Set when the user arrived here from a "not enough credits" prompt — after a
  // successful top-up we send them straight back to that feature.
  const returnTo = location.state?.returnTo || null;
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // plan in the checkout modal
  const [error, setError] = useState("");

  // After a successful purchase, drop the user back where they came from.
  const onPaid = () => {
    setSelected(null);
    if (returnTo) navigate(returnTo, { replace: true });
  };

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

      <div className="text-center mb-10">
        <div className="inline-flex mb-4 p-3 rounded-2xl bg-[#c084fc]/10 border border-[#c084fc]/20 shadow-[0_0_20px_rgba(192,132,252,0.2)] animate-pulse">
          <Icon name="SPARKLES" size={30} className="text-[#c084fc]" />
        </div>
        <h2 className="mb-2 text-[32px] font-black tracking-tight text-ink bg-gradient-to-b from-white to-[#c084fc] bg-clip-text text-transparent">
          Cosmic Credits
        </h2>
        <p className="mx-auto max-w-85 text-[15px] leading-relaxed text-dim">
          Unlock the secrets of the stars with credits for readings, guidance, and AI chat.
        </p>
      </div>

      {/* Current balance */}
      <Card
        className="flex items-center justify-between overflow-hidden relative group transition-all duration-500 hover:border-[#c084fc]/50"
        style={{
          padding: "24px 28px",
          marginBottom: 32,
          background: "linear-gradient(145deg, rgba(30, 30, 50, 0.7), rgba(20, 20, 35, 0.7))",
          border: "1px solid rgba(192,132,252,0.25)",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#8b5cf6] to-[#c084fc]"></div>
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#c084fc]/5 rounded-full blur-3xl group-hover:bg-[#c084fc]/10 transition-colors duration-500"></div>

        <div className="flex flex-col relative z-10">
          <span className="text-[12px] font-black uppercase tracking-[3px] text-[#c084fc] mb-1.5 opacity-80">
            Your Balance
          </span>
          <div className="flex items-baseline gap-2">
            <span className="inline-flex items-center gap-2 text-4xl font-black text-ink tracking-tight">
              <Icon name="SPARKLES" size={34} className="text-[#c084fc]" /> {credits ?? "—"}
            </span>
            <span className="text-[14px] font-medium text-dim">Available</span>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-end gap-2">
          <div className="text-[12px] font-bold text-[#c084fc] bg-[#c084fc]/10 px-4 py-1.5 rounded-full border border-[#c084fc]/30 backdrop-blur-md shadow-[0_0_15px_rgba(192,132,252,0.15)]">
            Ready to use
          </div>
        </div>
      </Card>

      {returnTo && (
        <div className="mb-5 rounded-xl border border-[#c084fc]/30 bg-[#c084fc]/10 px-4 py-2.5 text-center text-[12.5px] font-medium text-subtle">
          Top up below — we'll take you right back to continue.
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-[#c084fc]/20"></div>
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-[#c084fc] border-t-transparent"></div>
          </div>
          <p className="mt-6 text-[14px] font-medium text-dim tracking-wide">Aligning the stars…</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[15px] text-dim">No cosmic plans available right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 max-w-120 mx-auto">
          {plans.map((p) => {
            const isPopular = p.bonusLabel?.toLowerCase().includes("popular");
            const isBestValue = p.bonusLabel?.toLowerCase().includes("value");

            return (
              <Card
                key={p.id}
                className={`relative flex flex-col sm:flex-row items-center justify-between gap-6 transition-all duration-500 hover:scale-[1.02] group ${
                  isPopular
                    ? "ring-1 ring-[#c084fc]/40 bg-[#c084fc]/5 shadow-[0_0_30px_rgba(192,132,252,0.15)]"
                    : isBestValue
                      ? "ring-1 ring-[#fbbf24]/40 bg-[#fbbf24]/5 shadow-[0_0_30px_rgba(251,191,36,0.1)]"
                      : "hover:border-white/20"
                }`}
                style={{
                  padding: "24px 32px",
                  marginBottom: 0,
                  background: isPopular
                    ? "linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(20, 20, 30, 0.6) 100%)"
                    : isBestValue
                      ? "linear-gradient(90deg, rgba(251, 191, 36, 0.1) 0%, rgba(20, 20, 30, 0.6) 100%)"
                      : undefined,
                }}
              >
                {p.bonusLabel && (
                  <div
                    className={`absolute top-0 right-6 -translate-y-1/2 rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-[1.5px] text-white shadow-xl z-20 whitespace-nowrap ${
                      isPopular
                        ? "bg-gradient-to-r from-[#6366f1] to-[#a855f7] ring-2 ring-black/20"
                        : isBestValue
                          ? "bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] ring-2 ring-black/20 text-black"
                          : "bg-zinc-800 border border-white/10"
                    }`}
                  >
                    {isPopular && <Icon name="FIRE" size={11} className="mr-1.5 inline align-[-1px]" />}
                    {isBestValue && <Icon name="RING" size={11} className="mr-1.5 inline align-[-1px]" />}
                    {p.bonusLabel}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className="text-ink group-hover:scale-110 transition-transform duration-500">
                    <Icon name="SPARKLES" size={36} className="text-[#c084fc]" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="text-2xl font-black text-ink tracking-tight">{p.credits} Credits</div>
                    <div className="text-[11px] font-black uppercase tracking-[2px] text-[#c084fc] opacity-80">
                      Cosmic Power
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center sm:items-end flex-1">
                  <div className="text-2xl font-black text-ink tracking-tight">{formatInr(p.priceInr)}</div>
                  <div className="text-[12px] text-dim font-medium">One-time purchase</div>
                </div>

                <div className="w-full sm:w-auto">
                  <Button
                    variant="magic"
                    className="font-black tracking-widest text-[13px] py-3 px-8 shadow-[0_10px_20px_rgba(192,132,252,0.3)] group-hover:shadow-[0_15px_30px_rgba(192,132,252,0.5)] group-hover:-translate-y-1"
                    onClick={() => {
                      setError("");
                      setSelected(p);
                    }}
                  >
                    BUY NOW
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <CheckoutModal
          plan={selected}
          onClose={() => setSelected(null)}
          onPaid={onPaid}
          formatInr={formatInr}
          returnTo={returnTo}
        />
      )}

      <BottomNav activeKey="credits" />
    </div>
  );
}

// Razorpay checkout. Opens an order on the backend, launches the Razorpay
// widget, then verifies the payment server-side. Falls back to mock settlement
// when the backend has no keys (provider:'mock').
function CheckoutModal({ plan, onClose, onPaid, formatInr, returnTo }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Errors are shown INSIDE the modal (with a Try Again) instead of closing it —
  // a payment hiccup shouldn't dump the user back to the plan list.
  const [err, setErr] = useState("");

  function settled() {
    setDone(true);
    setTimeout(onPaid, 1100); // brief success flash, then close / return
  }

  async function pay() {
    setBusy(true);
    setErr("");
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
        name: "Selora",
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
          } catch {
            setErr(
              "We couldn't confirm your payment. If you were charged, your credits will arrive shortly — otherwise tap Try Again."
            );
            setBusy(false);
          }
        },
        // User dismissed Checkout without paying — re-enable the Pay button.
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", (resp) => {
        setErr(
          resp?.error?.description ||
            "Your payment didn't go through — no money was deducted. Please try again."
        );
        setBusy(false);
      });
      rzp.open();
    } catch {
      setErr("Couldn't start checkout. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4"
      onClick={busy ? undefined : onClose}
    >
      <Card
        className="w-full max-w-90 text-center relative overflow-hidden"
        style={{
          padding: 32,
          background: "linear-gradient(145deg, rgba(30, 30, 50, 0.9), rgba(15, 15, 25, 0.9))",
          border: "1px solid rgba(192,132,252,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#c084fc] to-transparent"></div>

        {done ? (
          <div className="animate-bounce">
            <div className="mb-4 flex justify-center text-[#c084fc]">
              <Icon name="SPARKLES" size={56} className="text-[#c084fc]" />
            </div>
            <p className="m-0 text-[18px] font-black text-success tracking-tight">
              {plan.credits} credits added!
            </p>
            <p className="mt-2 text-[13px] text-dim">
              {returnTo ? "Taking you back…" : "The stars are now in your favor."}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 inline-flex p-4 rounded-full bg-[#c084fc]/10 border border-[#c084fc]/20 shadow-[0_0_20px_rgba(192,132,252,0.2)]">
              <Icon name="SPARKLES" size={34} className="text-[#c084fc]" />
            </div>
            <p className="m-0 text-[20px] font-black text-ink tracking-tight uppercase">{plan.name}</p>
            <div className="my-6 p-4 rounded-xl bg-black/30 border border-white/5">
              <p className="m-0 text-[15px] font-bold text-subtle">{plan.credits} Cosmic Credits</p>
              <p className="mt-1 text-2xl font-black text-[#c084fc]">{formatInr(plan.priceInr)}</p>
            </div>
            {err && (
              <p className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] leading-snug text-danger">
                {err}
              </p>
            )}
            <Button
              variant="magic"
              fullWidth
              busy={busy}
              busyLabel="Securing transaction…"
              className="py-4 text-[14px] font-black tracking-widest shadow-[0_10px_20px_rgba(192,132,252,0.3)]"
              onClick={pay}
            >
              {err ? "Try Again" : `PAY ${formatInr(plan.priceInr)}`}
            </Button>
            {/* Trust signals at the exact moment of payment — reduce checkout
                hesitation. All three are literally true (no auto-renew, credits
                don't expire, Razorpay handles card data + PCI). */}
            <div className="mt-6 flex flex-col items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-subtle">
                <LuLock size={13} className="text-success" />
                Secure payment · card details never touch our servers
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10.5px] text-dim">
                <span className="inline-flex items-center gap-1">
                  <LuInfinity size={12} className="text-[#c084fc]" /> Credits never expire
                </span>
                <span className="inline-flex items-center gap-1">
                  <LuShieldCheck size={12} className="text-[#c084fc]" /> No subscription · one-time
                </span>
              </div>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-dim opacity-70">
                Payments secured by Razorpay
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
