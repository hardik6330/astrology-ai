// React Query hooks for the admin data endpoints. These replace the per-page
// useEffect + loading/error/alive boilerplate (and the set-state-in-effect lint
// it tripped) with cached, deduped queries keyed under ["admin", …].

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { adminStats, adminUsers, adminPurchases, adminMe, adminGetSettings, adminGetPlans } from "./adminApi";

export function useAdminStats() {
  return useQuery({ queryKey: ["admin", "stats"], queryFn: adminStats });
}

export function useAdminUsers({ page, search, pageSize }) {
  return useQuery({
    queryKey: ["admin", "users", { page, search, pageSize }],
    queryFn: () => adminUsers({ limit: pageSize, offset: page * pageSize, search }),
    // Keep the previous page on screen while the next page/search loads.
    placeholderData: keepPreviousData,
  });
}

export function useAdminPurchases({ page, search, pageSize }) {
  return useQuery({
    queryKey: ["admin", "purchases", { page, search, pageSize }],
    queryFn: () => adminPurchases({ limit: pageSize, offset: page * pageSize, search }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminMe() {
  return useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => adminMe().then((d) => d.admin),
    // A stale/invalid token is a hard 401 — don't retry, surface it immediately.
    retry: false,
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => adminGetSettings().then((d) => d.settings),
  });
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => adminGetPlans().then((d) => d.plans),
  });
}
