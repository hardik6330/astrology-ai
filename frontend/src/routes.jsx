import { lazy } from "react";
import { Navigate } from "react-router-dom";
import AuthGate from "@/features/auth/AuthGate";
import ProtectedRoute from "@/features/auth/ProtectedRoute";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/features/auth/LoginPage";
import { AdminAuthProvider } from "@/admin/context/AdminAuthContext";
import AdminRoute from "@/admin/components/AdminRoute";

// Heavy authenticated screens are lazy-loaded so the initial login bundle
// stays small. Add new routes to the array below — they pick up the same
// AuthGate + ErrorBoundary wrapping automatically.
const ReadingPage = lazy(() => import("@/pages/ReadingPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const PalmPage = lazy(() => import("@/pages/PalmPage"));
const PalmStepPage = lazy(() => import("@/pages/PalmStepPage"));
const PalmComparePage = lazy(() => import("@/pages/PalmComparePage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));

// Back-office admin section — its own username/password auth, fully separate
// from the phone-OTP user gate. Lazy-loaded so it never weighs down the app.
const AdminLoginPage = lazy(() => import("@/admin/pages/AdminLoginPage"));
const AdminLayout = lazy(() => import("@/admin/layout/AdminLayout"));
const AdminDashboard = lazy(() => import("@/admin/pages/AdminDashboard"));
const AdminUsers = lazy(() => import("@/admin/pages/AdminUsers"));
const AdminPush = lazy(() => import("@/admin/pages/AdminPush"));
const AdminProfile = lazy(() => import("@/admin/pages/AdminProfile"));

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

// Admin section lives outside the phone AuthGate. `/admin/login` is standalone;
// the rest share AdminLayout (header + sidebar + footer) via nested routes,
// all behind AdminRoute and an AdminAuthProvider.
function adminRoutes() {
  return [
    {
      path: "/admin/login",
      element: (
        <AdminAuthProvider>
          <RouteErrorBoundary>
            <AdminLoginPage />
          </RouteErrorBoundary>
        </AdminAuthProvider>
      ),
    },
    {
      path: "/admin",
      element: (
        <AdminAuthProvider>
          <AdminRoute>
            <RouteErrorBoundary>
              <AdminLayout />
            </RouteErrorBoundary>
          </AdminRoute>
        </AdminAuthProvider>
      ),
      children: [
        { index: true, element: <AdminDashboard /> },
        { path: "users", element: <AdminUsers /> },
        { path: "push", element: <AdminPush /> },
        { path: "profile", element: <AdminProfile /> },
      ],
    },
  ];
}

// Returns the list of route descriptors React Router will render. Kept as
// a function (not a constant) so the lazy chunks aren't evaluated at module
// load time of routes.jsx.
export function appRoutes() {
  return [
    ...ROUTES.map((r) => ({ path: r.path, element: wrap(r) })),
    ...adminRoutes(),
    { path: "*", element: <Navigate to="/" replace /> },
  ];
}
