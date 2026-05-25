import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ChartProvider } from "./context/ChartContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import HomePage from "./pages/HomePage";

// Lazy-load the heavy authenticated pages. The home form is loaded eagerly
// because it's the landing page — every other page is fetched on demand,
// cutting initial bundle by ~30%.
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

// Router shell. The birth form lives at "/"; the full reading at
// "/reading" is gated by ProtectedRoute (needs a generated chart).
export default function App() {
  return (
    <ChartProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<RouteErrorBoundary><HomePage /></RouteErrorBoundary>} />
            <Route
              path="/reading"
              element={
                <RouteErrorBoundary>
                  <ProtectedRoute><ReadingPage /></ProtectedRoute>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/chat"
              element={
                <RouteErrorBoundary>
                  <ProtectedRoute><ChatPage /></ProtectedRoute>
                </RouteErrorBoundary>
              }
            />
            <Route
              path="/palm"
              element={
                <RouteErrorBoundary>
                  <ProtectedRoute><PalmPage /></ProtectedRoute>
                </RouteErrorBoundary>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ChartProvider>
  );
}
