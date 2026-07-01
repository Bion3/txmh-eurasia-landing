import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { costCenterApi } from "../api";
import { queryKeys } from "./queryKeys";

export function useVendorList(query) {
  return useQuery({
    queryKey: queryKeys.costCenter.vendors(query),
    queryFn: () => costCenterApi.vendors(query).then((res) => res.data),
    retry: false,
  });
}

export function useRateSheetList(query) {
  return useQuery({
    queryKey: queryKeys.costCenter.rateSheets(query),
    queryFn: () => costCenterApi.rateSheets(query).then((res) => res.data),
    retry: false,
  });
}

export function useRateSheetItems(rateSheetId, query) {
  return useQuery({
    queryKey: rateSheetId
      ? queryKeys.costCenter.rateSheetItems(rateSheetId, query)
      : ["cost-center", "rate-sheet-items", "empty"],
    queryFn: () => costCenterApi.rateSheetItems(rateSheetId, query).then((res) => res.data),
    enabled: Boolean(rateSheetId),
    retry: false,
  });
}

export function useCreateRateSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => costCenterApi.createRateSheet(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.costCenter.all });
    },
  });
}

export function useCreateRateSheetItem(rateSheetId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => costCenterApi.createRateSheetItem(rateSheetId, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.costCenter.all });
      if (rateSheetId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.costCenter.rateSheetItems(rateSheetId) });
      }
    },
  });
}
