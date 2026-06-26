// Admin sign-in. Username + password → /admin/login. On success, lands on the
// admin dashboard. Separate from the phone-OTP user login entirely.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "@/common/Logo";
import Field from "@/common/Field";
import Button from "@/common/Button";
import ErrorText from "@/common/ErrorText";
import { useAdminAuth } from "@/admin/context/AdminAuthContext";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, token } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already signed in → skip the form.
  useEffect(() => {
    if (token) navigate("/admin", { replace: true });
  }, [token, navigate]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) return setError("Enter your username and password");
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      {/* Same animated cosmic backdrop as the rest of the app (index.css). */}
      <div className="cosmos" />
      <div className="stars" />
      <div className="shooting-star" />

      <form
        onSubmit={submit}
        className="relative z-1 w-full max-w-90 rounded-[20px] border border-(--c-border) bg-[rgba(var(--panel-rgb),0.85)] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
      >
        <div className="mb-6 text-center">
          <Logo size={44} className="mb-2.5 inline-block rounded-lg" />
          <h1 className="m-0 font-display text-[22px] font-bold text-ink">Selora Admin</h1>
          <p className="mt-2 mb-0 text-[13px] text-dim">Sign in to the back office.</p>
        </div>

        <Field
          label="Username"
          type="text"
          autoComplete="username"
          placeholder="admin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy}
        />

        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          style={{ marginTop: 14 }}
        />

        <Button type="submit" busy={busy} busyLabel="Signing in…" fullWidth className="mt-5">
          Sign in
        </Button>

        <ErrorText style={{ marginTop: 14, fontSize: 12.5 }}>{error}</ErrorText>
      </form>
    </div>
  );
}
