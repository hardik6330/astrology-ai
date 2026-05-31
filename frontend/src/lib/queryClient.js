import { QueryClient } from "@tanstack/react-query";

// Single QueryClient for the whole app.
//
// Defaults rationale:
// - staleTime 5 min — kundali/palm/daily readings don't change client-side
//   between visits, so don't refetch on every component mount.
// - gcTime 30 min — keep cached data around long enough for back-nav.
// - retry 1 — Gemini-backed endpoints fail loudly; one retry catches blips,
//   beyond that the user sees the real error instead of a long spinner.
// - refetchOnWindowFocus false — PWA + mobile webview gets noisy otherwise.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
