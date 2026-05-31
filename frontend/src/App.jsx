import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ChartProvider } from "@/context/ChartContext";
import { AuthProvider } from "@/features/auth/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { appRoutes } from "@/routes";

function PageLoader() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", color: "#94a3b8" }}>
      <div style={{ fontSize: 32, animation: "pulse-gold 2s infinite ease-in-out" }}>✨</div>
    </div>
  );
}

// Phone-OTP auth gates the whole app. /reading|/chat|/palm additionally
// require a generated chart (ProtectedRoute). Route table lives in routes.jsx.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChartProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {appRoutes().map((r) => (
                  <Route key={r.path} path={r.path} element={r.element} />
                ))}
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ChartProvider>
      </AuthProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
