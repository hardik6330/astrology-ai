// Paying users — one aggregated row per user with at least one PAID purchase
// (order count, total spent, credits bought, last purchase), from
// /admin/purchases with a name/phone search. Renders inside AdminLayout's
// <Outlet>.

import { useState } from "react";
import { LuSearch, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import Card from "@/common/Card";
import Button from "@/common/Button";
import PageHeader from "@/common/PageHeader";
import ErrorText from "@/common/ErrorText";
import { useAdminPurchases } from "@/admin/api/queries";

const PAGE = 25;

// priceInr aggregates are in paise — show whole rupees, Indian grouping.
const inr = (paise) => `₹${Math.round((paise || 0) / 100).toLocaleString("en-IN")}`;

export default function AdminPurchases() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const {
    data = { rows: [], count: 0 },
    isPending,
    error,
  } = useAdminPurchases({ page, search, pageSize: PAGE });

  const pages = Math.ceil(data.count / PAGE) || 1;

  const searchBox = (
    <div className="relative">
      <LuSearch size={16} className="absolute top-2.75 left-3 text-muted" />
      <input
        placeholder="Search name, phone…"
        value={search}
        onChange={(e) => {
          setPage(0);
          setSearch(e.target.value);
        }}
        className="min-w-60 rounded-[10px] border border-(--c-border) bg-(--c-input-bg) py-2.25 pr-3.5 pl-8.5 text-[13px] text-ink outline-none"
      />
    </div>
  );

  return (
    <div>
      <PageHeader title="Purchases" count={data.count} action={searchBox} />
      <ErrorText>{error?.message}</ErrorText>

      {/* cosmic-card supplies bg/border/radius; override its padding (the table
          draws its own cell padding) + bottom margin inline; overflow utility. */}
      <Card className="overflow-x-auto" style={{ padding: 0, marginBottom: 0 }}>
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["Name", "Phone", "Orders", "Credits Bought", "Total Spent", "Last Purchase"].map((h) => (
                <th
                  key={h}
                  className="border-b border-(--c-border-soft) px-4 py-3 text-left font-semibold whitespace-nowrap text-dim"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td className={tdClass} colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : data.rows.length === 0 ? (
              <tr>
                <td className={tdClass} colSpan={6}>
                  No paid purchases yet.
                </td>
              </tr>
            ) : (
              data.rows.map((b) => (
                <tr key={b.userId}>
                  <td className={tdClass}>{b.name}</td>
                  <td className={tdClass}>{b.phone || "—"}</td>
                  <td className={tdClass}>{b.orders}</td>
                  <td className={tdClass}>{b.creditsBought}</td>
                  <td className={`${tdClass} font-semibold text-[#4ade80]`}>{inr(b.spentPaise)}</td>
                  <td className={tdClass}>{b.lastPaidAt ? new Date(b.lastPaidAt).toLocaleString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          icon={LuChevronLeft}
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          style={pagerBtn}
        >
          Prev
        </Button>
        <span className="text-[13px] text-dim">
          Page {page + 1} of {pages}
        </span>
        <Button
          variant="ghost"
          disabled={page + 1 >= pages}
          onClick={() => setPage((p) => p + 1)}
          style={pagerBtn}
        >
          Next <LuChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}

const tdClass = "border-b border-[rgba(var(--slate-rgb),0.08)] px-4 py-3 whitespace-nowrap text-body";
// Button styles its size inline, so size overrides must come via `style` (inline
// wins over utility classes), not className.
const pagerBtn = { padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 500 };
