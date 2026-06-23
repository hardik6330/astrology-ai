import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/utils/icons";

// Remembers where the highlight pill last sat, so navigating between pages
// (each mounts its own BottomNav) still slides the pill from the previous tab
// to the new one instead of snapping. Module scope = persists for the session.
let lastActiveIndex = -1;

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
  ["kundali", "Birth Chart", "KUNDLI"],
  ["planets", "Planets", "PLANET"],
  ["timeline", "Timeline", "CLOCK"],
  ["reading", "Insights", "SPARKLES"],
  ["palm", "Palm", "HAND_OPEN"],
  ["chat", "Chat", "CHAT"],
  ["profile", "Profile", "USER"],
];

export default function BottomNav({ activeKey, onLocalTab }) {
  const navigate = useNavigate();

  function go(key) {
    if (key === "palm") return navigate("/palm");
    if (key === "chat") return navigate("/chat");
    if (key === "profile") return navigate("/profile");
    // Reading sub-tabs.
    if (onLocalTab)
      onLocalTab(key); // already on /reading → just swap tab
    else navigate("/reading", { state: { tab: key } }); // somewhere else → go to /reading and set tab
  }

  // Index of the selected tab drives the sliding highlight pill below. The bar
  // has 7 equal-flex buttons (gap 2px) inside 6px padding, so each button is
  // (100% - 24px)/7 wide and sits at 6px + i*(width + 2px gap).
  const activeIndex = TABS.findIndex(([key]) => key === activeKey);
  const slotWidth = "((100% - 24px) / 7)";

  // Drive the pill's position from state so it animates. Start it where it last
  // sat (carried across page mounts via the module var), then slide to the
  // current tab after paint. Within the reading page, activeKey changes without
  // a remount — the same effect handles that case too.
  const [pillIndex, setPillIndex] = useState(lastActiveIndex >= 0 ? lastActiveIndex : activeIndex);
  useEffect(() => {
    if (activeIndex < 0) return;
    const id = requestAnimationFrame(() => setPillIndex(activeIndex));
    lastActiveIndex = activeIndex;
    return () => cancelAnimationFrame(id);
  }, [activeIndex]);

  return (
    <nav
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "max(12px, env(safe-area-inset-bottom))",
        zIndex: 50,
        width: "calc(100% - 24px)",
        maxWidth: 480,
        display: "flex",
        justifyContent: "space-between",
        gap: 2,
        padding: 6,
        borderRadius: 18,
        background: "rgba(16, 16, 28, 0.95)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        boxShadow: "0 8px 28px rgba(0, 0, 0, 0.55)",
      }}
    >
      {/* Sliding highlight pill — animates between tabs on selection. */}
      {activeIndex >= 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 6,
            bottom: 6,
            left: `calc(6px + ${pillIndex} * (${slotWidth} + 2px))`,
            width: `calc(${slotWidth})`,
            borderRadius: 13,
            border: "1px solid rgba(168,85,247,0.5)",
            background: "rgba(168,85,247,0.15)",
            transition: "left 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
            pointerEvents: "none",
          }}
        />
      )}
      {TABS.map(([key, label, icon]) => {
        const active = activeKey === key;
        return (
          <button
            key={key}
            onClick={() => go(key)}
            style={{
              position: "relative",
              flex: "1 1 0",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "7px 2px",
              borderRadius: 13,
              cursor: "pointer",
              border: "1px solid transparent",
              background: "transparent",
              color: active ? "#c084fc" : "#64748b",
              transition: "color 0.28s ease",
            }}
          >
            <Icon name={icon} size={17} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                maxWidth: "100%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
