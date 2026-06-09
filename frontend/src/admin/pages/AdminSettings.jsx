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

// notif_next_at is stored as epoch ms — meaningless to read raw. Turn it into a
// "in 2h 15m · 5 Jun, 7:55 AM IST" hint relative to now.
function formatNextAt(value) {
  const ms = Number(value);
  if (!ms || Number.isNaN(ms)) return "Not scheduled — sends on the next cron tick.";
  const diff = ms - Date.now();
  const when = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
  if (diff <= 0) return `Due now (next cron tick) · was ${when} IST`;
  const mins = Math.round(diff / 60000);
  const rel = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return `Next send in ${rel} · ${when} IST`;
}

const FIELD_INFO = {
  initial_credits:
    "The amount of free credits a brand-new user gets on signup. Example: Set to 200 so users can try 10 daily readings for free.",
  insights_cost:
    "Cost in credits for a full Kundali/Birth Chart interpretation. Example: 20 credits per generation.",
  chat_cost: "Cost per AI chat message. Example: 5 credits per reply to prevent API abuse.",
  daily_cost: "Cost for daily personalized guidance. Example: 15 credits per day.",
  palm_cost: "Cost for a palm reading analysis. Example: 30 credits due to higher AI processing needs.",
  notif_enabled: "Master switch to turn all automatic engagement notifications ON or OFF.",
  notif_audience:
    "Who receives the notification. 'All' sends to everyone, 'Sample' sends to a random % of users to spread server load.",
  notif_sample_pct:
    "Percentage of users to target when audience is 'Random Sample'. Example: 25% means 1 in 4 users gets the message.",
  notif_source:
    "Where the message text comes from. 'AI' uses Gemini to write fresh, unique messages every time.",
  notif_max_gap_hours:
    "Maximum time allowed between two notifications. Example: 12 means users won't go more than 12 hours without a nudge.",
  notif_min_gap_hours:
    "Minimum waiting time before sending another notification. Example: 5 prevents spamming users too frequently.",
  notif_window_start: "The earliest hour (IST, 0-23) the system can send notifications. Example: 9 for 9 AM.",
  notif_window_end: "The latest hour (IST, 0-23) the system can send notifications. Example: 15 for 3 PM.",
  notif_max_tokens:
    "Maximum number of devices to notify in one batch. Prevents server timeouts on large user bases.",
  notif_next_at:
    "The exact timestamp (Unix Epoch) when the next notification is scheduled. Managed automatically by the system.",
  app_latest_version:
    "The latest app version you've published (e.g. 1.2.0). The mobile app compares its own version to this on startup.",
  app_force_update:
    "When ON, users on a version older than the one above are blocked by a non-dismissible 'Update Required' popup until they update.",
  app_update_url: "The store link the Update button opens — your Play Store (or App Store) listing URL.",
};

// Free-text settings (version string, URL) — rendered as text inputs, NOT
// number inputs (which would blank a value like "1.2.0" on save).
const TEXT_FIELDS = new Set(["app_latest_version", "app_update_url"]);

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
  app_force_update: [
    ["false", "Off — optional update"],
    ["true", "On — block old versions"],
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

  // Split into three groups: app/force-update, engagement-notifications, and
  // everything else (credit/cost values).
  const notifSettings = settings.filter((s) => s.key.startsWith("notif_"));
  const appSettings = settings.filter((s) => s.key.startsWith("app_"));
  const creditSettings = settings.filter((s) => !s.key.startsWith("notif_") && !s.key.startsWith("app_"));

  // One setting's labelled control — a <select> for enum/boolean keys, else a
  // number input. Shared by both groups so they render identically.
  const renderField = (s) => (
    <div key={s.key}>
      {SELECT_OPTIONS[s.key] ? (
        <Field
          as="select"
          label={labelFor(s.key)}
          info={FIELD_INFO[s.key]}
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
      ) : TEXT_FIELDS.has(s.key) ? (
        <Field
          type="text"
          label={labelFor(s.key)}
          info={FIELD_INFO[s.key]}
          value={valueOf(s)}
          onChange={(e) => onEdit(s.key, e.target.value)}
          disabled={busy}
        />
      ) : (
        <Field
          type="number"
          min={0}
          label={labelFor(s.key)}
          info={FIELD_INFO[s.key]}
          value={valueOf(s)}
          onChange={(e) => onEdit(s.key, e.target.value)}
          disabled={busy}
        />
      )}
      {s.key === "notif_next_at" && (
        <p className="mx-0 mt-1.5 mb-0 text-[12px] text-accent">{formatNextAt(valueOf(s))}</p>
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
        <Card className="flex items-center justify-center py-20">
          <p className="text-muted">Loading settings...</p>
        </Card>
      ) : (
        <form onSubmit={save} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Column 1: Feature Costs & Credits */}
            <Card title="Feature Costs & Credits" className="h-fit">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                {creditSettings.map(renderField)}
              </div>
            </Card>

            {/* Column 2: Engagement Notifications */}
            <Card title="Engagement Notifications" className="h-fit">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                {notifSettings.map(renderField)}
              </div>
            </Card>

            {/* Column 3: App / Force Update */}
            <Card title="App / Force Update" className="h-fit">
              <p className="mx-0 mt-0 mb-6 text-[13px] text-muted leading-relaxed">
                Publish a new version number, then turn Force Update on to block users on older builds.
              </p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                {appSettings.map(renderField)}
              </div>
            </Card>
          </div>

          <div className="sticky bottom-6 z-10 flex flex-col items-center gap-3">
            <Button
              type="submit"
              size="lg"
              className="min-w-[200px] shadow-xl"
              busy={busy}
              busyLabel="Saving..."
              disabled={!changed.length}
              icon={LuSave}
            >
              {changed.length ? `Save ${changed.length} changes` : "Save changes"}
            </Button>
            {saved && (
              <p className="text-sm text-green-500 font-medium animate-fade-in">
                Settings saved successfully!
              </p>
            )}
            {saveErr && <ErrorText>{saveErr}</ErrorText>}
          </div>
        </form>
      )}
    </div>
  );
}
