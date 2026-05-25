import { ErrorBoundary } from "react-error-boundary";
import { useNavigate } from "react-router-dom";
import { color } from "../theme/tokens";

function Fallback({ error, resetErrorBoundary }) {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "4rem 1rem", textAlign: "center" }}>
      <div className="cosmos"></div>
      <div className="stars"></div>
      <div className="cosmic-card" style={{ borderColor: color.dangerStrong, background: "rgba(239, 68, 68, 0.06)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌑</div>
        <p style={{ fontSize: 17, fontWeight: 700, color: color.danger, margin: "0 0 8px" }}>
          Something went off-script
        </p>
        <p style={{ fontSize: 13, color: color.textBody, lineHeight: 1.6, margin: "0 0 20px" }}>
          An unexpected error broke this page. The stars haven't gone anywhere —
          just give it another try.
        </p>
        <details style={{ textAlign: "left", marginBottom: 20 }}>
          <summary style={{ fontSize: 11, color: color.textMuted, cursor: "pointer" }}>Technical detail</summary>
          <pre style={{ fontSize: 10, color: color.textMuted, whiteSpace: "pre-wrap", marginTop: 8 }}>
            {error?.message || String(error)}
          </pre>
        </details>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={resetErrorBoundary} className="magic-btn" style={{ flex: 1 }}>
            🔄 Try Again
          </button>
          <button onClick={() => { resetErrorBoundary(); navigate("/"); }} style={{
            flex: 1, padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: "pointer", color: color.accentLight,
            border: `1px solid ${color.accentBorder}`, background: color.accentSoft }}>
            🏠 Home
          </button>
        </div>
      </div>
    </div>
  );
}

// Wrap each route so a render error in one page doesn't blank-screen the app.
// Resets when the URL pathname changes (so a user navigating away clears the error).
export default function RouteErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      FallbackComponent={Fallback}
      onError={(error, info) => {
        // Hook for Sentry / Better Stack later: report({ error, info }).
        console.error("[ErrorBoundary]", error, info.componentStack);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
