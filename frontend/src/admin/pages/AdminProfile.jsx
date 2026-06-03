// Admin profile — shows the signed-in admin's account details from /admin/me.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@/common/Card";
import PageHeader from "@/common/PageHeader";
import { useAdminAuth } from "@/admin/context/AdminAuthContext";
import { useAdminMe } from "@/admin/api/queries";

export default function AdminProfile() {
  const navigate = useNavigate();
  const { logout } = useAdminAuth();
  const { data: admin, isError } = useAdminMe();

  // Stale/invalid token → drop session and bounce to login.
  useEffect(() => {
    if (isError) {
      logout();
      navigate("/admin/login", { replace: true });
    }
  }, [isError, logout, navigate]);

  return (
    <div>
      <PageHeader title="Profile" />

      {/* cosmic-card padding/margin-bottom override inline (see AdminPush). */}
      <Card className="max-w-110" style={{ padding: 24, marginBottom: 0 }}>
        <div className="grid h-14 w-14 place-items-center rounded-full bg-(image:--grad-primary) text-[22px] font-bold text-ink">
          {(admin?.name || admin?.username || "A").charAt(0).toUpperCase()}
        </div>
        <div className="mt-3.5">
          <Row label="Name" value={admin?.name} />
          <Row label="Username" value={admin?.username} />
          <Row label="Admin ID" value={admin?.id} />
          <Row
            label="Member since"
            value={admin?.createdAt ? new Date(admin.createdAt).toLocaleDateString() : null}
          />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-[rgba(var(--slate-rgb),0.1)] py-3">
      <span className="text-[13px] text-dim">{label}</span>
      <span className="text-sm font-medium text-ink">{value ?? "—"}</span>
    </div>
  );
}
