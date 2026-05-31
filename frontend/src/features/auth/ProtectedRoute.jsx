import { Navigate } from "react-router-dom";
import { useChart } from "@/context/ChartContext";

// Gate for pages that need a generated chart. If the user lands on
// /reading directly without filling the birth form, send them home.
export default function ProtectedRoute({ children }) {
  const { chart } = useChart();
  if (!chart) return <Navigate to="/" replace />;
  return children;
}
