import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useChart } from "../context/ChartContext";
import BottomNav from "../components/BottomNav";
import Card from "@/common/Card";
import { EMOJIS } from "@/utils/emojis";
import { useCredits } from "@/common/useCredits";
import { useEffect } from "react";
import { getCredits } from "@/services/api";

// Format the 24-h "HH:MM" form value to 12-h with AM/PM for display.
function fmtTime(t) {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h24 = Number(hStr);
  const m = String(mStr).padStart(2, "0");
  const ap = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${m} ${ap}`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { account, logout } = useAuth();
  const { form, clearAll } = useChart();
  const credits = useCredits();

  // Refresh credits on mount
  useEffect(() => {
    getCredits();
  }, []);

  const initial = (form?.name || "?").trim().charAt(0).toUpperCase();

  async function handleLogout() {
    // Wipe per-user chart/readings before clearing the auth session so
    // the next phone number to log in lands on a fresh form.
    clearAll?.();
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mx-auto max-w-140 px-4 pt-8 pb-28">
      <div className="cosmos"></div>
      <div className="stars"></div>

      <h2 className="mb-6 text-center text-[22px] font-extrabold text-ink">Your Profile</h2>

      {/* Identity card — flex/gap are utilities; cosmic-card's bottom margin is
          overridden inline (it's unlayered, so it beats Tailwind). */}
      <Card className="flex items-center gap-4" style={{ marginBottom: 16 }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[rgba(168,85,247,0.45)] bg-[rgba(168,85,247,0.18)] text-2xl font-extrabold text-[#c084fc]">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[17px] font-bold text-ink">{form?.name || `Welcome ${EMOJIS.SPARKLES}`}</p>
          <p className="mt-1 mb-0 text-xs text-dim">{account?.phone ? account.phone : "Not signed in"}</p>
        </div>
      </Card>

      {/* Credits Card */}
      <Card className="flex items-center justify-between" style={{ marginBottom: 16, padding: "16px 20px" }}>
        <div className="flex flex-col">
          <span className="text-[12px] font-medium uppercase tracking-wider text-dim">Cosmic Credits</span>
          <span className="mt-0.5 text-xl font-bold text-[#c084fc]">✨ {credits ?? "—"}</span>
        </div>
        <button
          onClick={() => navigate("/credits")}
          className="rounded-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] px-5 py-2 text-[13px] font-bold text-white shadow-lg transition-transform active:scale-95"
        >
          Buy Credits
        </button>
      </Card>

      {/* Birth details */}
      <Card style={{ marginBottom: 16 }}>
        <p className="m-0 mb-2 text-[13px] font-bold tracking-[0.5px] text-subtle">Birth Details</p>
        <DetailRow k="Name" v={form?.name || "—"} />
        <DetailRow k="Gender" v={form?.gender || "—"} />
        <DetailRow k="Date" v={form?.date || "—"} />
        <DetailRow k="Time" v={fmtTime(form?.time) || "—"} />
        <DetailRow k="City" v={form?.city || "—"} last />
      </Card>

      {/* Actions */}
      <Card className="grid gap-2.5">
        <button type="button" onClick={() => navigate("/", { state: { edit: true } })} className={ghostBtn}>
          {EMOJIS.EDIT} Update Birth Details
        </button>
        <button type="button" onClick={handleLogout} className={logoutBtn}>
          {EMOJIS.LOGOUT} Log out
        </button>
      </Card>

      <BottomNav activeKey="profile" />
    </div>
  );
}

function DetailRow({ k, v, last }) {
  return (
    <div
      className={`flex justify-between gap-3 py-2.5 ${
        last ? "" : "border-b border-[rgba(var(--slate-rgb),0.12)]"
      }`}
    >
      <span className="text-[13px] text-dim">{k}</span>
      <span className="text-right text-[13px] font-semibold text-ink">{v}</span>
    </div>
  );
}

const ghostBtn =
  "cursor-pointer rounded-xl border border-[rgba(168,85,247,0.35)] bg-transparent px-4 py-3 text-sm font-semibold text-[#c084fc]";
const logoutBtn =
  "cursor-pointer rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm font-bold text-[#fca5a5]";
