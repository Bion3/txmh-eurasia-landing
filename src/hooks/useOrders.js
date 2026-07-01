import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "../api";
import { queryKeys } from "./queryKeys";

export function useOrderList(query) {
  return useQuery({
    queryKey: queryKeys.orders.list(query),
    queryFn: () => ordersApi.list(query).then((res) => res.data),
    retry: false,
  });
}

export function useOrderDetail(orderId) {
  return useQuery({
    queryKey: orderId ? queryKeys.orders.detail(orderId) : ["orders", "detail", "empty"],
    queryFn: () => ordersApi.detail(orderId).then((res) => res.data),
    enabled: Boolean(orderId),
    retry: false,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => ordersApi.create(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, ...payload }) => ordersApi.update(orderId, payload).then((res) => res.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      if (variables?.orderId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) });
      }
      if (data?.id && data.id !== variables?.orderId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(data.id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useUpdateOrderTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, orderId, ...payload }) => ordersApi.updateTask(taskId, payload).then((res) => res.data),
    onSuccess: (_data, variables) => {
      if (variables?.orderId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}

export function useCreateOrderOperationLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, ...payload }) => ordersApi.addOperationLog(orderId, payload).then((res) => res.data),
    onSuccess: (_data, variables) => {
      if (variables?.orderId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) });
      }
    },
  });
}
