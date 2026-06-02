import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatCompletionJSON, fetchSaved, fetchDailyDates } from "@/services/api";
import { buildFactSheet } from "@/astrology";

export const kundaliKeys = {
  saved: (form) => ["kundali", "saved", form?.name, form?.date, form?.time, form?.city],
  dailyDates: (form) => ["kundali", "daily-dates", form?.name, form?.date, form?.time, form?.city],
  daily: (form, date) => ["kundali", "daily", form?.name, form?.date, form?.time, form?.city, date],
};

function formComplete(form) {
  return !!(form?.name && form?.date && form?.time && form?.city);
}

// Previously-saved kundali interpretation for this person, or null.
export function useSavedKundali(form) {
  return useQuery({
    queryKey: kundaliKeys.saved(form),
    queryFn: () => fetchSaved("interpret", form),
    enabled: formComplete(form),
  });
}

// Dates (YYYY-MM-DD) that already have generated daily guidance — drives
// the "dot under date" indicator on the daily strip.
export function useDailyDates(form) {
  return useQuery({
    queryKey: kundaliKeys.dailyDates(form),
    queryFn: () => fetchDailyDates(form),
    enabled: formComplete(form),
    // Empty array if backend has nothing yet — easier consumer code.
    placeholderData: [],
  });
}

// Saved daily guidance for a specific date. Returns null if none generated.
export function useSavedDaily(form, date) {
  return useQuery({
    queryKey: kundaliKeys.daily(form, date),
    queryFn: () => fetchSaved("daily", form, date),
    enabled: formComplete(form) && !!date,
  });
}

// Generates a fresh kundali interpretation via Gemini. Caller decides when
// to fire (typically when useSavedKundali returns null).
export function useGenerateKundali({ form, chart } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const factSheet = buildFactSheet(chart, form);
      return chatCompletionJSON([], "interpret", { factSheet, form });
    },
    onSuccess: (data) => {
      qc.setQueryData(kundaliKeys.saved(form), data);
    },
  });
}

// Generates daily guidance for a specific date. `ctx` is the natal/transit
// summary built by the caller (it varies per-date so we don't recompute it
// inside the hook).
export function useGenerateDaily({ form } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ctx, date }) => chatCompletionJSON([], "daily", { ctx, form, date }),
    onSuccess: (data, { date }) => {
      qc.setQueryData(kundaliKeys.daily(form, date), data);
      qc.invalidateQueries({ queryKey: kundaliKeys.dailyDates(form) });
    },
  });
}
