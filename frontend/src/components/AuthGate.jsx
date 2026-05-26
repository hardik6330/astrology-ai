import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Top-level auth gate. While we're validating a stored token, render a
// neutral splash; if no/expired token, bounce to /login; otherwise render.
export default function AuthGate({ children }) {
  const { token, hydrating } = useAuth();
  const loc = useLocation();

  if (hydrating) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh",
                    background: "#050508", color: "#94a3b8" }}>
        <div style={{ fontSize: 32, animation: "pulse-gold 2s infinite ease-in-out" }}>✨</div>
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
}
