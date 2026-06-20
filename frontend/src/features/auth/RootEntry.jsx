// Entry point for "/". Public (no AuthGate redirect) so a first-time visitor
// sees the marketing landing — "what we do" + a Login/Get-Started CTA — instead
// of being bounced straight to /login. A logged-in user falls through to the
// normal app home (HomePage), which itself routes returning users to /reading.
import { lazy, Suspense } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import Loading from "@/common/Loading";
import LandingPage from "@/pages/LandingPage";

// The authed app home is lazy so its (heavy) chart/form code stays out of the
// initial bundle that the public landing page loads. A logged-out visitor only
// ever downloads LandingPage; a returning user fetches HomePage on demand.
// Chunk-load failures after a redeploy are caught globally in main.jsx.
const HomePage = lazy(() => import("@/pages/HomePage"));

export default function RootEntry() {
  const { token, hydrating } = useAuth();

  // While validating a stored token, show a neutral splash (mirrors AuthGate)
  // so we don't flash the landing at a user who's actually signed in.
  if (hydrating) {
    return <Loading minHeight="100vh" style={{ background: "#050508" }} />;
  }
  if (!token) return <LandingPage />;
  return (
    <Suspense fallback={<Loading minHeight="100vh" style={{ background: "#050508" }} />}>
      <HomePage />
    </Suspense>
  );
}
