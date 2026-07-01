import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { financeApi } from "../api";
import { queryKeys } from "./queryKeys";

export function useOrderCosts(query) {
  return useQuery({
    queryKey: queryKeys.finance.orderCosts(query),
    queryFn: () => financeApi.listOrderCosts(query).then((res) => res.data),
    enabled: Boolean(query),
    retry: false,
  });
}

export function useReceivables(query) {
  return useQuery({
    queryKey: queryKeys.finance.receivables(query),
    queryFn: () => financeApi.listReceivables(query).then((res) => res.data),
  });
}

export function usePayables(query) {
  return useQuery({
    queryKey: queryKeys.finance.payables(query),
    queryFn: () => financeApi.listPayables(query).then((res) => res.data),
  });
}

export function useCreateOrderCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => financeApi.createOrderCost(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}

export function useRecordReceivablePayment(receivableId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ receivableId: scopedReceivableId, ...payload }) =>
      financeApi.recordReceivablePayment(scopedReceivableId || receivableId, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useRecordPayablePayment(payableId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payableId: scopedPayableId, ...payload }) =>
      financeApi.recordPayablePayment(scopedPayableId || payableId, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}
