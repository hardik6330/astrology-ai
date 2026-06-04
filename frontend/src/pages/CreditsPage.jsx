// Buy Cosmic Credits. Lists the admin-defined plans and runs a MOCK checkout
// (no real payment yet) — the "Pay (test)" modal simulates success and the
// backend grants the credits. The modal is isolated so a real Razorpay widget
// can drop straight in later without touching the plan grid.

import { useEffect, useState } from "react";
import Card from "@/common/Card";
import Button from "@/common/Button";
import ErrorText from "@/common/ErrorText";
import BottomNav from "@/components/BottomNav";
import { useCredits } from "@/common/useCredits";
import { fetchCreditPlans, purchasePlan, getCredits } from "@/services/api";

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

// Mock checkout. Clearly labelled test-only. Swap the body for a Razorpay
// handler later — the success path just needs to call purchasePlan(plan.id).
function CheckoutModal({ plan, onClose, onPaid, onError, formatInr }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function pay() {
    setBusy(true);
    try {
      await purchasePlan(plan.id);
      setDone(true);
      setTimeout(onPaid, 1100); // brief success flash, then close
    } catch (err) {
      onError(err.message || "Purchase failed");
      onClose();
    } finally {
      setBusy(false);
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
              Pay (test)
            </Button>
            <p className="mx-0 mb-0 mt-2.5 text-[10.5px] leading-snug text-dim">
              Test payment — no real charge. Credits are granted instantly.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
