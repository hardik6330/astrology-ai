// System Settings — edit the runtime-configurable credit/cost values that the
// backend reads via settingsService. Loads the current values, lets the admin
// edit them inline, and saves the changed ones in one POST.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LuSave } from "react-icons/lu";
import Card from "@/common/Card";
import Field from "@/common/Field";
import Button from "@/common/Button";
import PageHeader from "@/common/PageHeader";
import ErrorText from "@/common/ErrorText";
import { useAdminSettings } from "@/admin/api/queries";
import { adminSaveSettings } from "@/admin/api/adminApi";

// "initial_credits" → "Initial Credits"
const labelFor = (key) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Settings whose value is an enum/boolean string, not a number. Rendered as a
// <select> so admins pick a valid value instead of typing into a number input
// (which silently blanks text values like 'pool'/'all'/'true' on save).
const SELECT_OPTIONS = {
  notif_enabled: [
    ["true", "Enabled"],
    ["false", "Disabled"],
  ],
  notif_source: [
    ["pool", "Curated pool"],
    ["ai", "AI (Flash-generated)"],
  ],
  notif_audience: [
    ["all", "All devices"],
    ["random_one", "One random user"],
    ["random_sample", "Random sample"],
  ],
};

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data: settings = [], isPending, error } = useAdminSettings();

  // Overlay of edited values keyed by setting key; absent key = unchanged.
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saved, setSaved] = useState(false);

  const valueOf = (s) => (s.key in edits ? edits[s.key] : s.value);
  const changed = settings
    .filter((s) => s.key in edits && edits[s.key] !== s.value)
    .map((s) => ({ key: s.key, value: String(edits[s.key]).trim() }));

  // Split into two groups: credit/cost values vs engagement-notification config.
  const notifSettings = settings.filter((s) => s.key.startsWith("notif_"));
  const creditSettings = settings.filter((s) => !s.key.startsWith("notif_"));

  // One setting's labelled control — a <select> for enum/boolean keys, else a
  // number input. Shared by both groups so they render identically.
  const renderField = (s) => (
    <div key={s.key}>
      {SELECT_OPTIONS[s.key] ? (
        <Field
          as="select"
          label={labelFor(s.key)}
          value={valueOf(s)}
          onChange={(e) => onEdit(s.key, e.target.value)}
          disabled={busy}
        >
          {SELECT_OPTIONS[s.key].map(([val, text]) => (
            <option key={val} value={val}>
              {text}
            </option>
          ))}
        </Field>
      ) : (
        <Field
          type="number"
          min={0}
          label={labelFor(s.key)}
          value={valueOf(s)}
          onChange={(e) => onEdit(s.key, e.target.value)}
          disabled={busy}
        />
      )}
      {s.description && <p className="mx-0 mt-1.5 mb-0 text-[12px] text-muted">{s.description}</p>}
    </div>
  );

  function onEdit(key, val) {
    setSaved(false);
    setSaveErr("");
    setEdits((e) => ({ ...e, [key]: val }));
  }

  async function save(e) {
    e.preventDefault();
    setSaveErr("");
    setSaved(false);
    if (!changed.length) return;
    if (changed.some((c) => c.value === "")) return setSaveErr("Values can't be empty.");
    setBusy(true);
    try {
      const res = await adminSaveSettings(changed);
      qc.setQueryData(["admin", "settings"], res.settings); // fresh values from server
      setEdits({});
      setSaved(true);
    } catch (err) {
      setSaveErr(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="System Settings"
        subtitle="Credits & feature costs, plus engagement-notification settings."
      />
      <ErrorText>{error?.message}</ErrorText>

      {isPending ? (
        <p className="mt-2 text-[13px] text-dim">Loading settings…</p>
      ) : settings.length === 0 ? (
        <p className="mt-2 text-[13px] text-dim">No settings found.</p>
      ) : (
        <form onSubmit={save} className="mt-2 flex max-w-130 flex-col gap-5">
          {/* Section 1 — Credits & costs. Card's .cosmic-card is unlayered →
              padding/margin-bottom stay inline; flex/gap use utilities. */}
          <Card className="flex flex-col gap-5" style={{ padding: 24, marginBottom: 0 }}>
            <h2 className="m-0 text-[15px] font-semibold text-ink">Credits & Costs</h2>
            {creditSettings.map(renderField)}
          </Card>

          {/* Section 2 — Engagement notifications. */}
          <Card className="flex flex-col gap-5" style={{ padding: 24, marginBottom: 0 }}>
            <h2 className="m-0 text-[15px] font-semibold text-ink">Notifications</h2>
            <p className="m-0 -mt-3 text-[12px] text-muted">
              Randomised engagement pushes — timing, audience, and content source.
            </p>
            {notifSettings.map(renderField)}
          </Card>

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              busy={busy}
              busyLabel="Saving…"
              icon={LuSave}
              disabled={busy || changed.length === 0}
            >
              {changed.length
                ? `Save ${changed.length} change${changed.length > 1 ? "s" : ""}`
                : "Save changes"}
            </Button>
            <ErrorText style={{ fontSize: 12.5, margin: 0 }}>{saveErr}</ErrorText>
            {saved && <p className="m-0 text-[12.5px] text-success">Settings saved.</p>}
          </div>
        </form>
      )}
    </div>
  );
}
