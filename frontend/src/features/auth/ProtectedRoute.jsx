import { Navigate } from "react-router-dom";
import { useChart } from "@/context/ChartContext";
import Loading from "@/common/Loading";

// Gate for pages that need a generated chart. If the user lands on
// /reading directly without filling the birth form, send them home.
export default function ProtectedRoute({ children }) {
  const { chart, hydrating } = useChart();
  // Still fetching the returning user's saved form — wait, don't bounce home.
  if (hydrating) return <Loading minHeight="100vh" />;
  if (!chart) return <Navigate to="/" replace />;
  return children;
}
