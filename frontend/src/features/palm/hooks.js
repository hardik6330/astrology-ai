import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analyzePalm, comparePalms, fetchSaved, fetchPalmHistory, fetchPalmById } from "@/services/api";

export const palmKeys = {
  saved: (form) => ["palm", "saved", form?.name, form?.date, form?.time, form?.city],
  history: (form) => ["palm", "history", form?.name, form?.date, form?.time, form?.city],
  byId: (id, form) => ["palm", "byId", id, form?.name, form?.date, form?.time, form?.city],
};

function formComplete(form) {
  return !!(form?.name && form?.date && form?.time && form?.city);
}

// Most-recent saved single-hand palm reading (if any).
export function useSavedPalm(form) {
  return useQuery({
    queryKey: palmKeys.saved(form),
    queryFn: () => fetchSaved("palm", form),
    enabled: formComplete(form),
  });
}

// Lightweight list of past palm readings (id + handType + createdAt).
export function usePalmHistory(form) {
  return useQuery({
    queryKey: palmKeys.history(form),
    queryFn: () => fetchPalmHistory(form),
    enabled: formComplete(form),
    placeholderData: [],
  });
}

// Full body of a specific past reading.
export function usePalmById(id, form) {
  return useQuery({
    queryKey: palmKeys.byId(id, form),
    queryFn: () => fetchPalmById(id, form),
    enabled: !!id && formComplete(form),
  });
}

// Single-hand analysis. Invalidates history so the new reading appears in
// the list view without a manual refetch.
export function useAnalyzePalm({ form } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imageBase64, claimedHand }) => analyzePalm(imageBase64, form, claimedHand),
    onSuccess: (data) => {
      qc.setQueryData(palmKeys.saved(form), data);
      qc.invalidateQueries({ queryKey: palmKeys.history(form) });
    },
  });
}

// Two-hand comparison. Same invalidation as single-hand.
export function useComparePalms({ form } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leftImage, rightImage, leftLandmarks, rightLandmarks }) =>
      comparePalms(leftImage, rightImage, form, leftLandmarks, rightLandmarks),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: palmKeys.history(form) });
    },
  });
}
