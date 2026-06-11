// Users table — paginated list from /admin/users with a name/phone/city
// search. Each row has a 3-dot menu → "Send Notification", which opens a
// composer modal that pushes a custom notification to that one user.
// Renders inside AdminLayout's <Outlet>.

import { useState } from "react";
import { LuSearch, LuChevronLeft, LuChevronRight, LuEllipsisVertical, LuSend, LuX } from "react-icons/lu";
import Card from "@/common/Card";
import Button from "@/common/Button";
import Field from "@/common/Field";
import PageHeader from "@/common/PageHeader";
import ErrorText from "@/common/ErrorText";
import { SkeletonRows } from "@/common/Skeleton";
import { useAdminUsers } from "@/admin/api/queries";
import { adminPushUser } from "@/admin/api/adminApi";

const PAGE = 25;

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Row 3-dot menu: { user, top, left } positioned via the button's rect so it
  // floats above the Card's horizontal scroll container (which would clip it).
  const [menu, setMenu] = useState(null);
  // The user whose notification composer modal is open (null = closed).
  const [target, setTarget] = useState(null);

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

  function openMenu(e, u) {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ user: u, top: r.bottom + 4, left: r.right - 190 });
  }

  function openComposer(u) {
    setMenu(null);
    setTarget(u);
  }

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
              <th className="w-12 border-b border-(--c-border-soft) px-4 py-3 text-right font-semibold text-dim">
                {/* actions */}
              </th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <SkeletonRows rows={8} cols={7} />
            ) : data.rows.length === 0 ? (
              <tr>
                <td className={tdClass} colSpan={7}>
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
                  <td className={`${tdClass} text-right`}>
                    <button
                      type="button"
                      aria-label="Row actions"
                      onClick={(e) => openMenu(e, u)}
                      className="cursor-pointer rounded-md p-1.5 text-dim hover:bg-white/5 hover:text-ink"
                    >
                      <LuEllipsisVertical size={16} />
                    </button>
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

      {/* Row dropdown — backdrop closes it; menu floats at the button's rect. */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-47.5 overflow-hidden rounded-[10px] border border-(--c-border) bg-(--c-panel) shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
            style={{ top: menu.top, left: menu.left }}
          >
            <button
              type="button"
              onClick={() => openComposer(menu.user)}
              className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.75 text-left text-[13px] text-body hover:bg-white/5"
            >
              <LuSend size={15} className="text-(--c-primary)" />
              Send Notification
            </button>
          </div>
        </>
      )}

      {target && <PushModal user={target} onClose={() => setTarget(null)} />}
    </div>
  );
}

// Per-user notification composer. Mirrors AdminPush's broadcast form but posts
// to /admin/users/:id/push so only that user's devices receive it.
function PushModal({ user, onClose }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e) {
    e.preventDefault();
    setError("");
    if (!title.trim() || !body.trim()) return setError("Title and message are both required.");
    setBusy(true);
    try {
      await adminPushUser(user.id, title.trim(), body.trim());
      onClose(); // success → dismiss the composer
    } catch (err) {
      setError(err.message || "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <Card
        as="form"
        onSubmit={send}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-115 flex-col"
        style={{ padding: 24, marginBottom: 0 }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[15px] font-bold text-ink">Send Notification</p>
            <p className="mx-0 mt-1 mb-0 text-[12.5px] text-dim">
              To {user.name}
              {user.phone ? ` · ${user.phone}` : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-dim hover:bg-white/5 hover:text-ink"
          >
            <LuX size={18} />
          </button>
        </div>

        <Field
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="✨ A message from the stars"
          disabled={busy}
        />

        <Field
          as="textarea"
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Write your notification message…"
          disabled={busy}
          style={{ marginTop: 16 }}
        />

        <Button type="submit" busy={busy} busyLabel="Sending…" icon={LuSend} className="mt-5">
          Send notification
        </Button>

        <ErrorText style={{ fontSize: 12.5, margin: "8px 0 0" }}>{error}</ErrorText>
      </Card>
    </div>
  );
}

const tdClass = "border-b border-[rgba(var(--slate-rgb),0.08)] px-4 py-3 whitespace-nowrap text-body";
// Button styles its size inline, so size overrides must come via `style` (inline
// wins over utility classes), not className.
const pagerBtn = { padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 500 };
