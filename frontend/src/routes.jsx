import { lazy } from "react";
import { Navigate } from "react-router-dom";
import AuthGate from "@/features/auth/AuthGate";
import ProtectedRoute from "@/features/auth/ProtectedRoute";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/features/auth/LoginPage";

// Heavy authenticated screens are lazy-loaded so the initial login bundle
// stays small. Add new routes to the array below — they pick up the same
// AuthGate + ErrorBoundary wrapping automatically.
const ReadingPage = lazy(() => import("@/pages/ReadingPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const PalmPage = lazy(() => import("@/pages/PalmPage"));
const PalmStepPage = lazy(() => import("@/pages/PalmStepPage"));
const PalmComparePage = lazy(() => import("@/pages/PalmComparePage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));

// `requiresChart: true` adds the ProtectedRoute (needs a generated kundali).
// `public: true` skips AuthGate (login screen).
const ROUTES = [
  { path: "/login", element: <LoginPage />, public: true },
  { path: "/", element: <HomePage /> },
  { path: "/reading", element: <ReadingPage />, requiresChart: true },
  { path: "/chat", element: <ChatPage />, requiresChart: true },
  { path: "/palm", element: <PalmPage />, requiresChart: true },
  { path: "/palm-step", element: <PalmStepPage />, requiresChart: true },
  { path: "/palm-compare", element: <PalmComparePage />, requiresChart: true },
  { path: "/profile", element: <ProfilePage /> },
];

function wrap(route) {
  let node = <RouteErrorBoundary>{route.element}</RouteErrorBoundary>;
  if (route.requiresChart) node = <ProtectedRoute>{node}</ProtectedRoute>;
  if (!route.public) node = <AuthGate>{node}</AuthGate>;
  return node;
}

// Returns the list of route descriptors React Router will render. Kept as
// a function (not a constant) so the lazy chunks aren't evaluated at module
// load time of routes.jsx.
export function appRoutes() {
  return [
    ...ROUTES.map((r) => ({ path: r.path, element: wrap(r) })),
    { path: "*", element: <Navigate to="/" replace /> },
  ];
}
