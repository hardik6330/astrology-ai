import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatCompletion, chatStream, fetchChatHistory } from "@/services/api";
import { buildFactSheet } from "@/shared/astrology";

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
//
// Pass `onDelta` to stream. The mutation still RESOLVES WITH THE FULL TEXT
// either way, so every caller's success/error handling is identical whether the
// answer arrived in one piece or fifty.
export function useSendChatMessage({ form, chart, onDelta } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (history) => {
      const factSheet = chart ? buildFactSheet(chart, form) : undefined;
      if (!onDelta) return chatCompletion(history, "chat", { factSheet, form });

      let started = false;
      try {
        return await chatStream(history, { factSheet, form }, (d) => {
          started = true;
          onDelta(d);
        });
      } catch (err) {
        // Streaming can fail for reasons the buffered POST won't hit at all (a
        // proxy that won't pass text/event-stream, a corporate middlebox). Retry
        // buffered — but ONLY if nothing was rendered yet, otherwise the user
        // watches the answer restart from the top. A real error (402, blocked)
        // carries a .code and must not be retried into a second charge.
        if (started || err.code) throw err;
        return chatCompletion(history, "chat", { factSheet, form });
      }
    },
    onSuccess: () => {
      // Backend persisted the turn — drop any cached history so the next
      // page mount reads the authoritative server copy.
      qc.invalidateQueries({ queryKey: chatKeys.history(form) });
    },
  });
}
