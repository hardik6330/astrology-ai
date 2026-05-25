import { useNavigate } from "react-router-dom";

// Floating bottom tab bar — shared between ReadingPage and PalmPage so users
// can jump between sections from any sub-page.
//
// Props:
//   activeKey   — which tab key (one of TABS below) should render as selected
//   onLocalTab  — called for the reading sub-tabs (kundali / planets / timeline / reading).
//                 If provided (i.e. you're ON the reading page), we let the parent
//                 switch its local tab state. If absent (e.g. on /palm), we navigate
//                 to /reading and pass the tab key in location state.
const TABS = [
  ["kundali",  "Kundali",  "🪔"],
  ["planets",  "Planets",  "🪐"],
  ["timeline", "Timeline", "🔮"],
  ["reading",  "All Over", "✨"],
  ["palm",     "Palm",     "🖐️"],
  ["chat",     "Chat",     "💬"],
];

export default function BottomNav({ activeKey, onLocalTab }) {
  const navigate = useNavigate();

  function go(key) {
    if (key === "palm") return navigate("/palm");
    if (key === "chat") return navigate("/chat");
    // Reading sub-tabs.
    if (onLocalTab) onLocalTab(key);                                 // already on /reading → just swap tab
    else navigate("/reading", { state: { tab: key } });              // somewhere else → go to /reading and set tab
  }

  return (
    <nav style={{
      position: "fixed", left: "50%", transform: "translateX(-50%)",
      bottom: "max(12px, env(safe-area-inset-bottom))", zIndex: 50,
      width: "calc(100% - 24px)", maxWidth: 480,
      display: "flex", justifyContent: "space-between", gap: 2,
      padding: 6, borderRadius: 18,
      background: "rgba(16, 16, 28, 0.95)", backdropFilter: "blur(14px)",
      border: "1px solid rgba(99, 102, 241, 0.3)",
      boxShadow: "0 8px 28px rgba(0, 0, 0, 0.55)",
    }}>
      {TABS.map(([key, label, icon]) => {
        const active = activeKey === key;
        return (
          <button key={key} onClick={() => go(key)} style={{
            flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column",
            alignItems: "center", gap: 2, padding: "7px 2px", borderRadius: 13,
            cursor: "pointer", border: "1px solid " + (active ? "rgba(168,85,247,0.5)" : "transparent"),
            background: active ? "rgba(168,85,247,0.15)" : "transparent",
            color: active ? "#c084fc" : "#64748b",
          }}>
            <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
