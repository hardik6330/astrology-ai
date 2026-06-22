// Top bar — page title on the left, signed-in admin name + avatar on the right.

import { useAdminAuth } from "@/admin/context/AdminAuthContext";

export default function Header() {
  const { admin } = useAdminAuth();
  const display = admin?.name || admin?.username || "A";

  return (
    <header className="flex h-15 shrink-0 items-center justify-between border-b border-(--c-border-soft) bg-[rgba(var(--panel-rgb),0.8)] px-6">
      <h1 className="m-0 text-base font-semibold text-ink">Selora — Back Office</h1>
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] text-dim">{admin?.name || admin?.username}</span>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-(image:--grad-primary) text-[13px] font-bold text-ink">
          {display.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
