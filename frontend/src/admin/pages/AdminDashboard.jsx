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
import { useState } from "react";
import Card from "@/common/Card";
import PageHeader from "@/common/PageHeader";
import AdminEmptyState from "@/admin/components/AdminEmptyState";
import { SkeletonCards } from "@/common/Skeleton";
import { useAdminStats, useAdminAnalytics } from "@/admin/api/queries";
import { TrendChart, Donut, fmtInr, fmtInt } from "@/admin/components/Charts";

// priceInr is stored in paise — render as whole rupees, Indian grouping.
const inr = (paise) => `₹${Math.round((paise || 0) / 100).toLocaleString("en-IN")}`;

// Stable colors for the donut breakdowns (fall back to violet for new keys).
const STATUS_COLORS = { paid: "#34d399", created: "#fbbf24", failed: "#f87171", refunded: "#22d3ee" };
const PROVIDER_COLORS = { razorpay: "#6366f1", mock: "#94a3b8", apple: "#e7e7f0", google: "#34d399" };
const RANGES = [7, 30, 90];

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

// A titled card that wraps one chart. Keeps the analytics grid markup tidy.
function ChartPanel({ title, hint, children }) {
  return (
    <Card style={{ padding: 20, marginBottom: 0 }}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-[15px] font-bold text-ink">{title}</h3>
        {hint && <span className="text-[12px] text-dim">{hint}</span>}
      </div>
      {children}
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats, isPending, error } = useAdminStats();
  const revenue = stats?.revenue;

  const [days, setDays] = useState(30);
  const { data: a, isPending: aPending, error: aError } = useAdminAnalytics(days);

  const statusData = (a?.ordersByStatus || []).map((r) => ({
    label: r.status,
    value: r.count,
    color: STATUS_COLORS[r.status] || "#8b5cf6",
  }));
  const providerData = (a?.revenueByProvider || []).map((r) => ({
    label: r.provider,
    value: r.count,
    color: PROVIDER_COLORS[r.provider] || "#8b5cf6",
  }));

  return (
    <div>
      <PageHeader title="Dashboard" />

      {error ? (
        <Card>
          <AdminEmptyState variant="error" message={error.message} />
        </Card>
      ) : (
        <>
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

          <p className="mx-0 mt-7 mb-3 text-[13px] font-semibold tracking-[1px] text-dim uppercase">
            Revenue
          </p>
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

          {/* ── Analytics charts ─────────────────────────────────────────── */}
          <div className="mt-7 mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[13px] font-semibold tracking-[1px] text-dim uppercase">Analytics</p>
            {/* range toggle */}
            <div className="inline-flex overflow-hidden rounded-lg border border-(--c-border)">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDays(r)}
                  className={`px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    days === r ? "bg-primary/20 text-primary" : "text-dim hover:text-ink"
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>

          {aError ? (
            <Card>
              <AdminEmptyState variant="error" message={aError.message} />
            </Card>
          ) : aPending ? (
            <SkeletonCards count={2} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartPanel title="New Users" hint={`Last ${a.days} days`}>
                <TrendChart labels={a.labels} data={a.signups} color="#8b5cf6" format={fmtInt} gid="users" />
              </ChartPanel>
              <ChartPanel title="Revenue" hint={`Last ${a.days} days`}>
                <TrendChart
                  labels={a.labels}
                  data={a.revenuePaise}
                  color="#34d399"
                  format={fmtInr}
                  gid="rev"
                />
              </ChartPanel>
              <ChartPanel title="Paid Orders" hint={`Last ${a.days} days`}>
                <TrendChart labels={a.labels} data={a.orders} color="#22d3ee" format={fmtInt} gid="orders" />
              </ChartPanel>
              <div className="grid gap-4 sm:grid-cols-2">
                <ChartPanel title="Orders by Status" hint="All time">
                  <Donut data={statusData} format={fmtInt} />
                </ChartPanel>
                <ChartPanel title="Paid by Provider" hint="All time">
                  <Donut data={providerData} format={fmtInt} />
                </ChartPanel>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
