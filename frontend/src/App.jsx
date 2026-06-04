import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ChartProvider } from "@/context/ChartContext";
import { AuthProvider } from "@/features/auth/AuthContext";
import { queryClient } from "@/lib/queryClient";
import Loading from "@/common/Loading";
import CreditBadge from "@/common/CreditBadge";
import { appRoutes } from "@/routes";

function PageLoader() {
  return <Loading />;
}

// Phone-OTP auth gates the whole app. /reading|/chat|/palm additionally
// require a generated chart (ProtectedRoute). Route table lives in routes.jsx.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChartProvider>
          <BrowserRouter>
            <CreditBadge />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {appRoutes().map((r) => (
                  <Route key={r.path} path={r.path} element={r.element}>
                    {r.children?.map((c) => (
                      <Route key={c.path ?? "index"} index={c.index} path={c.path} element={c.element} />
                    ))}
                  </Route>
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
