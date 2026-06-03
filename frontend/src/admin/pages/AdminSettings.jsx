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
        subtitle="Credits granted to new users and the cost of each AI feature."
      />
      <ErrorText>{error?.message}</ErrorText>

      {/* Card's .cosmic-card is unlayered → padding/margin-bottom stay inline;
          flex/max-width/top-margin use utilities. */}
      <Card
        as="form"
        onSubmit={save}
        className="mt-2 flex max-w-130 flex-col gap-5"
        style={{ padding: 24, marginBottom: 0 }}
      >
        {isPending ? (
          <p className="m-0 text-[13px] text-dim">Loading settings…</p>
        ) : settings.length === 0 ? (
          <p className="m-0 text-[13px] text-dim">No settings found.</p>
        ) : (
          settings.map((s) => (
            <div key={s.key}>
              <Field
                type="number"
                min={0}
                label={labelFor(s.key)}
                value={valueOf(s)}
                onChange={(e) => onEdit(s.key, e.target.value)}
                disabled={busy}
              />
              {s.description && <p className="mx-0 mt-1.5 mb-0 text-[12px] text-muted">{s.description}</p>}
            </div>
          ))
        )}

        <Button
          type="submit"
          busy={busy}
          busyLabel="Saving…"
          icon={LuSave}
          disabled={busy || changed.length === 0}
          className="mt-1"
        >
          {changed.length ? `Save ${changed.length} change${changed.length > 1 ? "s" : ""}` : "Save changes"}
        </Button>

        <ErrorText style={{ fontSize: 12.5, margin: "4px 0 0" }}>{saveErr}</ErrorText>
        {saved && <p className="mt-1 mb-0 text-[12.5px] text-success">Settings saved.</p>}
      </Card>
    </div>
  );
}
