// Credit Plans — back-office CRUD for the purchasable credit packages the
// clients show on their Buy Credits screen. Admin can add a plan, edit an
// existing one inline, and enable/disable it (no hard delete — disabling keeps
// historical purchase references valid). Prices are entered in ₹ and stored as
// paise on the backend.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LuPlus, LuSave } from "react-icons/lu";
import Card from "@/common/Card";
import Field from "@/common/Field";
import Button from "@/common/Button";
import PageHeader from "@/common/PageHeader";
import ErrorText from "@/common/ErrorText";
import { Skeleton } from "@/common/Skeleton";
import AdminEmptyState from "@/admin/components/AdminEmptyState";
import { useAdminPlans } from "@/admin/api/queries";
import { adminCreatePlan, adminUpdatePlan } from "@/admin/api/adminApi";

const paiseToRupees = (paise) => (paise == null ? "" : String(paise / 100));
const rupeesToPaise = (rupees) => Math.round(Number(rupees) * 100);

const EMPTY = {
  name: "",
  credits: "",
  priceRupees: "",
  bonusLabel: "",
  sortOrder: "0",
  // Store SKU. Without it a plan cannot be bought through the app stores at
  // all — it falls back to the mock path, which fails closed in production.
  productId: "",
  isSubscription: false,
  periodDays: "30",
};

export default function AdminPlans() {
  const qc = useQueryClient();
  const { data: plans = [], isPending, error } = useAdminPlans();

  return (
    <div>
      <PageHeader
        title="Credit Plans"
        subtitle="Packages users can buy. Disabling a plan hides it from clients without deleting it."
      />

      <div className="mt-2 flex w-full flex-col gap-5">
        <NewPlanForm onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "plans"] })} />

        {isPending ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} style={{ marginBottom: 0 }}>
                <Skeleton className="mb-3 h-5 w-32" />
                <Skeleton className="mb-2 h-3.5 w-24" />
                <Skeleton className="mb-4 h-3.5 w-20" />
                <Skeleton className="h-9 w-full rounded-[10px]" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card style={{ marginBottom: 0 }}>
            <AdminEmptyState variant="error" message={error.message} />
          </Card>
        ) : plans.length === 0 ? (
          <Card style={{ marginBottom: 0 }}>
            <AdminEmptyState title="No plans yet" message="Add a credit plan using the form above." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "plans"] })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create form ──────────────────────────────────────────────────────────────
function NewPlanForm({ onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!f.name.trim() || !f.credits || f.priceRupees === "") {
      return setErr("Name, credits and price are required.");
    }
    setBusy(true);
    try {
      await adminCreatePlan({
        name: f.name.trim(),
        productId: f.productId.trim() || null,
        isSubscription: !!f.isSubscription,
        periodDays: Number(f.periodDays) || 30,
        credits: Number(f.credits),
        priceInr: rupeesToPaise(f.priceRupees),
        bonusLabel: f.bonusLabel.trim() || null,
        sortOrder: Number(f.sortOrder) || 0,
      });
      setF(EMPTY);
      onSaved();
    } catch (e2) {
      setErr(e2.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      as="form"
      onSubmit={submit}
      className="flex flex-col gap-4"
      style={{ padding: 24, marginBottom: 0 }}
    >
      <h2 className="m-0 text-[15px] font-semibold text-ink">Add a plan</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field
          label="Name"
          value={f.name}
          onChange={set("name")}
          maxLength={80}
          placeholder="Starter"
          disabled={busy}
        />
        <Field
          type="number"
          min={1}
          label="Credits"
          value={f.credits}
          onChange={set("credits")}
          placeholder="100"
          disabled={busy}
        />
        <Field
          type="number"
          min={0}
          step="0.01"
          label="Price (₹)"
          value={f.priceRupees}
          onChange={set("priceRupees")}
          placeholder="49"
          disabled={busy}
        />
        <Field
          label="Badge (optional)"
          value={f.bonusLabel}
          onChange={set("bonusLabel")}
          maxLength={60}
          placeholder="Most Popular"
          disabled={busy}
        />
        <Field
          type="number"
          label="Sort order"
          value={f.sortOrder}
          onChange={set("sortOrder")}
          disabled={busy}
        />
        <Field
          label="Store SKU"
          value={f.productId}
          onChange={set("productId")}
          maxLength={100}
          placeholder="com.astrologyai.plus.monthly"
          disabled={busy}
        />
        <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-body">
          <input
            type="checkbox"
            checked={f.isSubscription}
            onChange={(e) => setF((st) => ({ ...st, isSubscription: e.target.checked }))}
            disabled={busy}
          />
          Subscription
        </label>
        {f.isSubscription && (
          <Field
            type="number"
            min={1}
            label="Days per cycle"
            value={f.periodDays}
            onChange={set("periodDays")}
            placeholder="30"
            disabled={busy}
          />
        )}
      </div>
      <p className="m-0 text-[12px] text-body">
        Store SKU must match the product id in RevenueCat / App Store Connect — that's how a purchase event
        finds this plan. A blank SKU means the plan can't be bought (the app shows "Coming soon"). A
        subscription grants its credits <strong>every cycle</strong> and needs a store <em>subscription</em>
        product, not a consumable.
      </p>
      <Button type="submit" busy={busy} busyLabel="Adding…" icon={LuPlus} className="self-start">
        Add plan
      </Button>
      <ErrorText style={{ fontSize: 12.5, margin: 0 }}>{err}</ErrorText>
    </Card>
  );
}

// ── Editable existing plan ───────────────────────────────────────────────────
function PlanRow({ plan, onSaved }) {
  const [f, setF] = useState({
    name: plan.name,
    credits: String(plan.credits),
    priceRupees: paiseToRupees(plan.priceInr),
    bonusLabel: plan.bonusLabel || "",
    productId: plan.productId || "",
    isSubscription: !!plan.isSubscription,
    periodDays: String(plan.periodDays ?? 30),
    sortOrder: String(plan.sortOrder ?? 0),
    active: plan.active,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const set = (k) => (e) => {
    setSaved(false);
    setF((s) => ({ ...s, [k]: e.target.value }));
  };

  async function save(patch) {
    setErr("");
    setSaved(false);
    setBusy(true);
    try {
      await adminUpdatePlan(plan.id, patch);
      setSaved(true);
      onSaved();
    } catch (e2) {
      setErr(e2.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const saveAll = (e) => {
    e.preventDefault();
    save({
      name: f.name.trim(),
      productId: f.productId.trim() || null,
      isSubscription: !!f.isSubscription,
      periodDays: Number(f.periodDays) || 30,
      credits: Number(f.credits),
      priceInr: rupeesToPaise(f.priceRupees),
      bonusLabel: f.bonusLabel.trim() || null,
      sortOrder: Number(f.sortOrder) || 0,
    });
  };

  return (
    <Card
      as="form"
      onSubmit={saveAll}
      className="flex flex-col gap-3"
      style={{ padding: 20, marginBottom: 0, opacity: f.active ? 1 : 0.6 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">{plan.name}</span>
        <span className={`text-[11px] font-bold uppercase ${f.active ? "text-success" : "text-muted"}`}>
          {f.active ? "Active" : "Disabled"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" value={f.name} onChange={set("name")} maxLength={80} disabled={busy} />
        <Field
          type="number"
          min={1}
          label="Credits"
          value={f.credits}
          onChange={set("credits")}
          disabled={busy}
        />
        <Field
          type="number"
          min={0}
          step="0.01"
          label="Price (₹)"
          value={f.priceRupees}
          onChange={set("priceRupees")}
          disabled={busy}
        />
        <Field
          label="Badge"
          value={f.bonusLabel}
          onChange={set("bonusLabel")}
          maxLength={60}
          disabled={busy}
        />
        <Field
          type="number"
          label="Sort order"
          value={f.sortOrder}
          onChange={set("sortOrder")}
          disabled={busy}
        />
        <Field
          label="Store SKU"
          value={f.productId}
          onChange={set("productId")}
          maxLength={100}
          placeholder="com.astrologyai.plus.monthly"
          disabled={busy}
        />
        <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-body">
          <input
            type="checkbox"
            checked={f.isSubscription}
            onChange={(e) => setF((st) => ({ ...st, isSubscription: e.target.checked }))}
            disabled={busy}
          />
          Subscription
        </label>
        {f.isSubscription && (
          <Field
            type="number"
            min={1}
            label="Days per cycle"
            value={f.periodDays}
            onChange={set("periodDays")}
            disabled={busy}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" busy={busy} busyLabel="Saving…" icon={LuSave}>
          Save
        </Button>
        <Button
          type="button"
          variant={f.active ? "danger" : "ghost"}
          disabled={busy}
          onClick={() => {
            setF((s) => ({ ...s, active: !s.active }));
            save({ active: !f.active });
          }}
        >
          {f.active ? "Disable" : "Enable"}
        </Button>
        {saved && <span className="text-[12.5px] text-success">Saved.</span>}
      </div>
      <ErrorText style={{ fontSize: 12.5, margin: 0 }}>{err}</ErrorText>
    </Card>
  );
}
