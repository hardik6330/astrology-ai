// Dashboard landing — headline counts from /admin/stats. Renders inside
// AdminLayout's <Outlet>, so it's chrome-free (no header/sidebar here).
//
// Tailwind reference page: layout/spacing/colors are utility classes; only the
// truly dynamic bits (each card's accent color, driven by JS data) stay inline.

import {
  LuUsers,
  LuGlobe,
  LuHand,
  LuMessageSquare,
  LuSmartphone,
  LuIndianRupee,
  LuCalendarDays,
  LuReceipt,
  LuWallet,
} from "react-icons/lu";
import Card from "@/common/Card";
import PageHeader from "@/common/PageHeader";
import ErrorText from "@/common/ErrorText";
import { SkeletonCards } from "@/common/Skeleton";
import { useAdminStats } from "@/admin/api/queries";

// priceInr is stored in paise — render as whole rupees, Indian grouping.
const inr = (paise) => `₹${Math.round((paise || 0) / 100).toLocaleString("en-IN")}`;

const CARDS = [
  { key: "users", label: "Users", Icon: LuUsers, color: "#8b5cf6" },
  { key: "kundalis", label: "Kundalis", Icon: LuGlobe, color: "#6366f1" },
  { key: "palmReadings", label: "Palm Readings", Icon: LuHand, color: "#ec4899" },
  { key: "chatMessages", label: "Chat Messages", Icon: LuMessageSquare, color: "#34d399" },
  { key: "pushTokens", label: "Active Devices", Icon: LuSmartphone, color: "#fbbf24" },
];

// Revenue row — paid orders only (mock + Razorpay + IAP all settle into
// Purchase with status 'paid'); value() formats from stats.revenue.
const REVENUE_CARDS = [
  {
    key: "total",
    label: "Total Revenue",
    Icon: LuIndianRupee,
    color: "#4ade80",
    value: (r) => inr(r.totalPaise),
  },
  {
    key: "month",
    label: "Revenue (This Month)",
    Icon: LuCalendarDays,
    color: "#22d3ee",
    value: (r) => inr(r.monthPaise),
  },
  { key: "orders", label: "Paid Orders", Icon: LuReceipt, color: "#f472b6", value: (r) => r.paidOrders ?? 0 },
  {
    key: "buyers",
    label: "Paying Users",
    Icon: LuWallet,
    color: "#facc15",
    value: (r) => r.payingUsers ?? 0,
  },
];

function StatCard({ color, Icon, value, label }) {
  // Card's .cosmic-card class is unlayered, so it beats Tailwind's (layered)
  // p-5/mb-0 — override the surface inline. Per-card accent is data-driven →
  // stays inline too (Tailwind can't generate a class from a runtime value).
  return (
    <Card style={{ padding: 20, marginBottom: 0 }}>
      <div
        className="mb-3.5 grid h-10 w-10 place-items-center rounded-[10px]"
        style={{ background: `${color}22`, color }}
      >
        <Icon size={20} />
      </div>
      <div className="text-[26px] font-bold text-ink">{value}</div>
      <div className="text-[13px] text-dim">{label}</div>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats, isPending, error } = useAdminStats();
  const revenue = stats?.revenue;

  return (
    <div>
      <PageHeader title="Dashboard" />
      <ErrorText>{error?.message}</ErrorText>

      {isPending ? (
        <SkeletonCards count={CARDS.length} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          {CARDS.map((c) => (
            <StatCard
              key={c.key}
              color={c.color}
              Icon={c.Icon}
              value={stats ? (stats[c.key] ?? 0) : "—"}
              label={c.label}
            />
          ))}
        </div>
      )}

      <p className="mx-0 mt-7 mb-3 text-[13px] font-semibold tracking-[1px] text-dim uppercase">Revenue</p>
      {isPending ? (
        <SkeletonCards count={REVENUE_CARDS.length} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          {REVENUE_CARDS.map((c) => (
            <StatCard
              key={c.key}
              color={c.color}
              Icon={c.Icon}
              value={revenue ? c.value(revenue) : "—"}
              label={c.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}
