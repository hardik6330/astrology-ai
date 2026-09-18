// Cosmic Credits. Shows the balance + the admin-defined plans. Purchasing is
// App-Store-only (Apple IAP via RevenueCat) — the web has no checkout, so each
// plan points the user at the iOS app instead.

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Card from "@/common/Card";
import ErrorText from "@/common/ErrorText";
import BottomNav from "@/components/BottomNav";
import { useCredits } from "@/common/useCredits";
import { fetchCreditPlans, getCredits } from "@/services/api";
import { Icon } from "@/utils/icons";

// paise → "₹49" (drops the .00 when whole rupees).
const formatInr = (paise) => {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
};

export default function CreditsPage() {
  const credits = useCredits();
  const location = useLocation();
  // Set when the user arrived here from a "not enough credits" prompt.
  const returnTo = location.state?.returnTo || null;
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
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
          Top up in the Selora iOS app — your balance syncs to this account.
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
                  <div className="text-[12px] text-dim font-medium">
                    {p.isSubscription ? "Per month" : "One-time purchase"}
                  </div>
                </div>

                <div className="w-full sm:w-auto text-center text-[12px] font-bold uppercase tracking-[1.5px] text-[#c084fc]">
                  Buy in the iOS app
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <BottomNav activeKey="credits" />
    </div>
  );
}
