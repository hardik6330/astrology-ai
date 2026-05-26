import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ChartProvider } from "./context/ChartContext";
import { AuthProvider } from "./context/AuthContext";
import AuthGate from "./components/AuthGate";
import ProtectedRoute from "./components/ProtectedRoute";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

// Lazy-load the heavy authenticated pages.
const ReadingPage = lazy(() => import("./pages/ReadingPage"));
const ChatPage    = lazy(() => import("./pages/ChatPage"));
const PalmPage    = lazy(() => import("./pages/PalmPage"));

function PageLoader() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", color: "#94a3b8" }}>
      <div style={{ fontSize: 32, animation: "pulse-gold 2s infinite ease-in-out" }}>✨</div>
    </div>
  );
}

// Phone-OTP auth gates the whole app. /reading|/chat|/palm additionally
// require a generated chart (ProtectedRoute).
export default function App() {
  return (
    <AuthProvider>
      <ChartProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<AuthGate><RouteErrorBoundary><HomePage /></RouteErrorBoundary></AuthGate>} />
              <Route
                path="/reading"
                element={
                  <AuthGate>
                    <RouteErrorBoundary>
                      <ProtectedRoute><ReadingPage /></ProtectedRoute>
                    </RouteErrorBoundary>
                  </AuthGate>
                }
              />
              <Route
                path="/chat"
                element={
                  <AuthGate>
                    <RouteErrorBoundary>
                      <ProtectedRoute><ChatPage /></ProtectedRoute>
                    </RouteErrorBoundary>
                  </AuthGate>
                }
              />
              <Route
                path="/palm"
                element={
                  <AuthGate>
                    <RouteErrorBoundary>
                      <ProtectedRoute><PalmPage /></ProtectedRoute>
                    </RouteErrorBoundary>
                  </AuthGate>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ChartProvider>
    </AuthProvider>
  );
}
