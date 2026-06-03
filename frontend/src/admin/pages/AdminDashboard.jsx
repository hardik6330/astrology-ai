// Dashboard landing — headline counts from /admin/stats. Renders inside
// AdminLayout's <Outlet>, so it's chrome-free (no header/sidebar here).
//
// Tailwind reference page: layout/spacing/colors are utility classes; only the
// truly dynamic bits (each card's accent color, driven by JS data) stay inline.

import { LuUsers, LuGlobe, LuHand, LuMessageSquare, LuSmartphone } from "react-icons/lu";
import Card from "@/common/Card";
import PageHeader from "@/common/PageHeader";
import ErrorText from "@/common/ErrorText";
import { useAdminStats } from "@/admin/api/queries";

const CARDS = [
  { key: "users", label: "Users", Icon: LuUsers, color: "#8b5cf6" },
  { key: "kundalis", label: "Kundalis", Icon: LuGlobe, color: "#6366f1" },
  { key: "palmReadings", label: "Palm Readings", Icon: LuHand, color: "#ec4899" },
  { key: "chatMessages", label: "Chat Messages", Icon: LuMessageSquare, color: "#34d399" },
  { key: "pushTokens", label: "Active Devices", Icon: LuSmartphone, color: "#fbbf24" },
];

export default function AdminDashboard() {
  const { data: stats, error } = useAdminStats();

  return (
    <div>
      <PageHeader title="Dashboard" />
      <ErrorText>{error?.message}</ErrorText>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {CARDS.map((c) => (
          // Card's .cosmic-card class is unlayered, so it beats Tailwind's
          // (layered) p-5/mb-0 — override the surface inline. Inner content
          // below is pure Tailwind (cosmic-card doesn't style children).
          <Card key={c.key} style={{ padding: 20, marginBottom: 0 }}>
            <div
              className="mb-3.5 grid h-10 w-10 place-items-center rounded-[10px]"
              // Per-card accent is data-driven → stays inline (Tailwind can't
              // generate a class from a runtime value).
              style={{ background: `${c.color}22`, color: c.color }}
            >
              <c.Icon size={20} />
            </div>
            <div className="text-[26px] font-bold text-ink">{stats ? (stats[c.key] ?? 0) : "—"}</div>
            <div className="text-[13px] text-dim">{c.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
