import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchCities, getCityDetails } from "@/services/api";

// Tiny debounce hook — avoids firing a Places autocomplete request on every
// keystroke. 300ms matches what CitySearch.jsx used inline before.
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export const locationKeys = {
  search: (q, token) => ["location", "search", q, token],
  details: (placeId, token, ts) => ["location", "details", placeId, token, ts],
};

// Debounced city search. Token is the Places sessiontoken — same value
// passed across keystrokes within one "search session" so Google bills the
// autocomplete as a single session.
export function useCitySearch(query, token) {
  const debouncedQuery = useDebounced(query?.trim() ?? "", 300);
  return useQuery({
    queryKey: locationKeys.search(debouncedQuery, token),
    queryFn: () => searchCities(debouncedQuery, token),
    enabled: debouncedQuery.length >= 2,
    placeholderData: [],
    // Search results stay fresh briefly so back-and-forth typing reuses cache.
    staleTime: 60_000,
  });
}

// Imperative city-details lookup — exposed as a plain async fn since it's
// only fired on user pick (one-shot, not declarative).
export async function lookupCityDetails(placeId, token, ts) {
  return getCityDetails(placeId, token, ts);
}
