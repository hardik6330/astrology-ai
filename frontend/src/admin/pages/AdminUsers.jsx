// Users table — paginated list from /admin/users with a name/phone/city
// search. Renders inside AdminLayout's <Outlet>.

import { useState } from "react";
import { LuSearch, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import Card from "@/common/Card";
import Button from "@/common/Button";
import PageHeader from "@/common/PageHeader";
import ErrorText from "@/common/ErrorText";
import { useAdminUsers } from "@/admin/api/queries";

const PAGE = 25;

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const {
    data = { rows: [], count: 0 },
    isPending,
    error,
  } = useAdminUsers({
    page,
    search,
    pageSize: PAGE,
  });

  const pages = Math.ceil(data.count / PAGE) || 1;

  const searchBox = (
    <div className="relative">
      <LuSearch size={16} className="absolute top-2.75 left-3 text-muted" />
      <input
        placeholder="Search name, phone, city…"
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
      <PageHeader title="Users" count={data.count} action={searchBox} />
      <ErrorText>{error?.message}</ErrorText>

      {/* cosmic-card supplies bg/border/radius; override its padding (the table
          draws its own cell padding) + bottom margin inline; overflow utility. */}
      <Card className="overflow-x-auto" style={{ padding: 0, marginBottom: 0 }}>
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["Name", "Phone", "Gender", "Birth Date", "City", "Joined"].map((h) => (
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
                  No users found.
                </td>
              </tr>
            ) : (
              data.rows.map((u) => (
                <tr key={u.id}>
                  <td className={tdClass}>{u.name}</td>
                  <td className={tdClass}>{u.phone || "—"}</td>
                  <td className={tdClass}>{u.gender || "—"}</td>
                  <td className={tdClass}>{u.birthDate}</td>
                  <td className={tdClass}>{u.birthCity}</td>
                  <td className={tdClass}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </td>
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
