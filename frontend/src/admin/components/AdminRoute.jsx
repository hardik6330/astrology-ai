// Gate for back-office pages: redirect to /admin/login when there's no admin
// token. Mirrors the app's ProtectedRoute but keyed on the admin session.

import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/admin/context/AdminAuthContext";

export default function AdminRoute({ children }) {
  const { token } = useAdminAuth();
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}
