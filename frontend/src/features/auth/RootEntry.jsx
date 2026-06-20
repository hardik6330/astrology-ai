// Entry point for "/". Public (no AuthGate redirect) so a first-time visitor
// sees the marketing landing — "what we do" + a Login/Get-Started CTA — instead
// of being bounced straight to /login. A logged-in user falls through to the
// normal app home (HomePage), which itself routes returning users to /reading.
import { useAuth } from "@/features/auth/AuthContext";
import Loading from "@/common/Loading";
import HomePage from "@/pages/HomePage";
import LandingPage from "@/pages/LandingPage";

export default function RootEntry() {
  const { token, hydrating } = useAuth();

  // While validating a stored token, show a neutral splash (mirrors AuthGate)
  // so we don't flash the landing at a user who's actually signed in.
  if (hydrating) {
    return <Loading minHeight="100vh" style={{ background: "#050508" }} />;
  }
  return token ? <HomePage /> : <LandingPage />;
}
