import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatCompletion, fetchChatHistory } from "@/services/api";
import { buildFactSheet } from "@/astrology";

// Query keys are factored out so mutations can invalidate them by reference.
export const chatKeys = {
  history: (form) => ["chat", "history", form?.name, form?.date, form?.time, form?.city],
};

function formIsComplete(form) {
  return !!(form?.name && form?.date && form?.time && form?.city);
}

// Loads the persisted chat history for a person. Disabled until the form
// is complete so we don't fire a request with empty params.
export function useChatHistory(form) {
  return useQuery({
    queryKey: chatKeys.history(form),
    queryFn: () => fetchChatHistory(form),
    enabled: formIsComplete(form),
  });
}

// Sends a chat turn. Caller passes the running history; we POST it and
// return the assistant's reply. ChatPage still owns the optimistic "…"
// placeholder + context storage because that UI state is local to the page.
export function useSendChatMessage({ form, chart } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (history) => {
      const factSheet = chart ? buildFactSheet(chart, form) : undefined;
      return chatCompletion(history, "chat", { factSheet, form });
    },
    onSuccess: () => {
      // Backend persisted the turn — drop any cached history so the next
      // page mount reads the authoritative server copy.
      qc.invalidateQueries({ queryKey: chatKeys.history(form) });
    },
  });
}
