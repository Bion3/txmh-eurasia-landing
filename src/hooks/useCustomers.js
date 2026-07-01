import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "../api";
import { queryKeys } from "./queryKeys";

export function useCustomerList(query) {
  return useQuery({
    queryKey: queryKeys.customers.list(query),
    queryFn: () => customersApi.list(query).then((res) => res.data),
    retry: false,
  });
}

export function useCustomerDetail(customerId) {
  return useQuery({
    queryKey: customerId ? queryKeys.customers.detail(customerId) : ["customers", "detail", "empty"],
    queryFn: () => customersApi.detail(customerId).then((res) => res.data),
    enabled: Boolean(customerId),
    retry: false,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => customersApi.create(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, ...payload }) => customersApi.update(customerId, payload).then((res) => res.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      if (variables?.customerId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(variables.customerId) });
      }
      if (data?.id && data.id !== variables?.customerId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(data.id) });
      }
    },
  });
}

export function useCreateCustomerContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, ...payload }) =>
      customersApi.createContact(customerId, payload).then((res) => res.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      if (variables?.customerId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(variables.customerId) });
      }
    },
  });
}

export function useUpdateCustomerContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactId, customerId, ...payload }) =>
      customersApi.updateContact(contactId, payload).then((res) => res.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      if (variables?.customerId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(variables.customerId) });
      }
    },
  });
}

export function useCreateCustomerActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, ...payload }) =>
      customersApi.addActivity(customerId, payload).then((res) => res.data),
    onSuccess: (_data, variables) => {
      if (variables?.customerId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(variables.customerId) });
      }
    },
  });
}
