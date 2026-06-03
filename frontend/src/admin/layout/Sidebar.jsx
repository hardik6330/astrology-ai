// Left navigation rail — the single source of admin nav links, plus brand and
// logout. Self-contained: pulls logout from the admin session and routes the
// user back to /admin/login on sign-out.

import { NavLink, useNavigate } from "react-router-dom";
import { LuLayoutDashboard, LuUsers, LuBell, LuUser, LuLogOut, LuShield } from "react-icons/lu";
import { useAdminAuth } from "@/admin/context/AdminAuthContext";

const NAV = [
  { to: "/admin", label: "Dashboard", Icon: LuLayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", Icon: LuUsers },
  { to: "/admin/push", label: "Push Notification", Icon: LuBell },
];

// Shared nav-link classes; active state swaps the left border + bg + text.
const linkClass = ({ isActive }) =>
  `flex items-center gap-3 border-l-[3px] px-5 py-2.75 text-sm font-medium no-underline ${
    isActive ? "border-primary bg-[rgba(var(--violet-rgb),0.12)] text-ink" : "border-transparent text-dim"
  }`;

export default function Sidebar() {
  const navigate = useNavigate();
  const { logout } = useAdminAuth();

  function signOut() {
    logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <aside className="flex w-57.5 shrink-0 flex-col border-r border-(--c-border-soft) bg-[rgba(var(--panel-rgb),0.95)]">
      <div className="flex items-center gap-2.5 border-b border-(--c-border-soft) px-5 py-4.5">
        <LuShield size={22} className="text-primary" />
        <span className="text-[15px] font-bold text-ink">Admin Panel</span>
      </div>

      <nav className="flex-1 py-2">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Profile + Logout pinned to the bottom, below the main nav. */}
      <div className="border-t border-(--c-border-soft) pt-2 pb-3">
        <NavLink to="/admin/profile" className={linkClass}>
          <LuUser size={18} />
          Profile
        </NavLink>

        <button
          onClick={signOut}
          className="flex w-full cursor-pointer items-center gap-3 border-0 border-l-[3px] border-transparent bg-transparent px-5 py-2.75 text-left text-sm font-medium text-danger"
        >
          <LuLogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
