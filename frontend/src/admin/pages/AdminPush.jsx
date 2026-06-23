// Push Notification composer — broadcasts a custom title/body to every enabled
// device via /admin/push/broadcast and shows the FCM delivery summary.

import { useState } from "react";
import { LuSend } from "react-icons/lu";
import Card from "@/common/Card";
import Field from "@/common/Field";
import Button from "@/common/Button";
import PageHeader from "@/common/PageHeader";
import ErrorText from "@/common/ErrorText";
import { adminBroadcast } from "@/admin/api/adminApi";

export default function AdminPush() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function send(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!title.trim() || !body.trim()) return setError("Title and message are both required.");
    setBusy(true);
    try {
      const res = await adminBroadcast(title.trim(), body.trim());
      setResult(res);
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err.message || "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Push Notification"
        subtitle="Broadcast to every device with notifications enabled."
      />

      {/* Card's .cosmic-card class is unlayered → its padding/margin-bottom beat
          Tailwind utilities, so those stay inline; flex/max-width/top-margin
          don't conflict and use utilities. */}
      <Card
        as="form"
        onSubmit={send}
        className="mt-2 flex max-w-130 flex-col"
        style={{ padding: 24, marginBottom: 0 }}
      >
        <Field
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="A message from the stars"
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
          Send broadcast
        </Button>

        <ErrorText style={{ fontSize: 12.5, margin: "8px 0 0" }}>{error}</ErrorText>
        {result && (
          <p className="mt-2 mb-0 text-[12.5px] text-success">
            Sent {result.sent} · failed {result.failed} · pruned {result.disabled}
          </p>
        )}
      </Card>
    </div>
  );
}
