import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChart } from "../context/ChartContext";
import BottomNav from "../components/BottomNav";

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

  const initial = (form?.name || "?").trim().charAt(0).toUpperCase();

  async function handleLogout() {
    // Wipe per-user chart/readings before clearing the auth session so
    // the next phone number to log in lands on a fresh form.
    clearAll?.();
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem 7rem" }}>
      <div className="cosmos"></div>
      <div className="stars"></div>

      <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, textAlign: "center", margin: "0 0 24px" }}>
        Your Profile
      </h2>

      {/* Identity card */}
      <div className="cosmic-card" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={avatar}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={name}>{form?.name || "Welcome ✨"}</p>
          <p style={muted}>{account?.phone ? account.phone : "Not signed in"}</p>
        </div>
      </div>

      {/* Birth details */}
      <div className="cosmic-card" style={{ marginBottom: 16 }}>
        <p style={sectionTitle}>Birth Details</p>
        <DetailRow k="Name" v={form?.name || "—"} />
        <DetailRow k="Gender" v={form?.gender || "—"} />
        <DetailRow k="Date" v={form?.date || "—"} />
        <DetailRow k="Time" v={fmtTime(form?.time) || "—"} />
        <DetailRow k="City" v={form?.city || "—"} last />
      </div>

      {/* Actions */}
      <div className="cosmic-card" style={{ display: "grid", gap: 10 }}>
        <button type="button" onClick={() => navigate("/")} style={ghostBtn}>
          ✏️ Update Birth Details
        </button>
        <button type="button" onClick={handleLogout} style={logoutBtn}>
          ↩ Log out
        </button>
      </div>

      <BottomNav activeKey="profile" />
    </div>
  );
}

function DetailRow({ k, v, last }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: 12,
      padding: "10px 0",
      borderBottom: last ? "none" : "1px solid rgba(148,163,184,0.12)",
    }}>
      <span style={{ color: "#94a3b8", fontSize: 13 }}>{k}</span>
      <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}

const avatar = {
  width: 56, height: 56, borderRadius: 28,
  background: "rgba(168,85,247,0.18)",
  border: "2px solid rgba(168,85,247,0.45)",
  color: "#c084fc", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 24, fontWeight: 800,
};
const name = { color: "#fff", fontSize: 17, fontWeight: 700, margin: 0 };
const muted = { color: "#94a3b8", fontSize: 12, margin: "4px 0 0" };
const sectionTitle = { color: "#cbd5e1", fontSize: 13, fontWeight: 700, margin: "0 0 8px", letterSpacing: 0.5 };
const ghostBtn = {
  padding: "12px 16px", borderRadius: 12,
  background: "transparent",
  border: "1px solid rgba(168,85,247,0.35)",
  color: "#c084fc", fontSize: 14, fontWeight: 600,
  cursor: "pointer",
};
const logoutBtn = {
  padding: "12px 16px", borderRadius: 12,
  background: "rgba(239,68,68,0.10)",
  border: "1px solid rgba(239,68,68,0.45)",
  color: "#fca5a5", fontSize: 14, fontWeight: 700,
  cursor: "pointer",
};
