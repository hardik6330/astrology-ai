import { lazy } from "react";
import { Navigate } from "react-router-dom";
import AuthGate from "@/features/auth/AuthGate";
import ProtectedRoute from "@/features/auth/ProtectedRoute";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/features/auth/LoginPage";
import { AdminAuthProvider } from "@/admin/context/AdminAuthContext";
import AdminRoute from "@/admin/components/AdminRoute";

// lazy() that survives a redeploy. Content-hashed chunk names change on every
// build, so a client still running the previous index.html (browser cache or
// the autoUpdate service worker) can request a chunk that no longer exists →
// "Failed to fetch dynamically imported module." We catch that once and do a
// hard reload to pull the fresh index.html + new chunk names. A short
// sessionStorage cooldown prevents a reload loop if the import fails for a real
// reason (offline, genuine 500).
function lazyWithReload(factory) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const KEY = "chunk_reload_at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
        return new Promise(() => {}); // suspend until the reload takes over
      }
      throw err; // already reloaded recently — let the error boundary show
    }
  });
}

// Heavy authenticated screens are lazy-loaded so the initial login bundle
// stays small. Add new routes to the array below — they pick up the same
// AuthGate + ErrorBoundary wrapping automatically.
const ReadingPage = lazyWithReload(() => import("@/pages/ReadingPage"));
const ChatPage = lazyWithReload(() => import("@/pages/ChatPage"));
const PalmPage = lazyWithReload(() => import("@/pages/PalmPage"));
const PalmStepPage = lazyWithReload(() => import("@/pages/PalmStepPage"));
const PalmComparePage = lazyWithReload(() => import("@/pages/PalmComparePage"));
const ProfilePage = lazyWithReload(() => import("@/pages/ProfilePage"));
const CreditsPage = lazyWithReload(() => import("@/pages/CreditsPage"));

// Back-office admin section — its own username/password auth, fully separate
// from the phone-OTP user gate. Lazy-loaded so it never weighs down the app.
const AdminLoginPage = lazyWithReload(() => import("@/admin/pages/AdminLoginPage"));
const AdminLayout = lazyWithReload(() => import("@/admin/layout/AdminLayout"));
const AdminDashboard = lazyWithReload(() => import("@/admin/pages/AdminDashboard"));
const AdminUsers = lazyWithReload(() => import("@/admin/pages/AdminUsers"));
const AdminPush = lazyWithReload(() => import("@/admin/pages/AdminPush"));
const AdminProfile = lazyWithReload(() => import("@/admin/pages/AdminProfile"));
const AdminSettings = lazyWithReload(() => import("@/admin/pages/AdminSettings"));
const AdminPlans = lazyWithReload(() => import("@/admin/pages/AdminPlans"));

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
  { path: "/credits", element: <CreditsPage /> },
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
        { path: "settings", element: <AdminSettings /> },
        { path: "plans", element: <AdminPlans /> },
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
