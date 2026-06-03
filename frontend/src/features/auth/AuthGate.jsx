import { Navigate, useLocation } from "react-router-dom";
import Loading from "@/common/Loading";
import { useAuth } from "./AuthContext";

// Top-level auth gate. While we're validating a stored token, render a
// neutral splash; if no/expired token, bounce to /login; otherwise render.
export default function AuthGate({ children }) {
  const { token, hydrating } = useAuth();
  const loc = useLocation();

  if (hydrating) {
    return <Loading minHeight="100vh" style={{ background: "#050508" }} />;
  }
  if (!token) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
}
