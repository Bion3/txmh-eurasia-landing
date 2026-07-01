import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quotesApi } from "../api";
import { queryKeys } from "./queryKeys";

export function useQuoteList(query) {
  return useQuery({
    queryKey: queryKeys.quotes.list(query),
    queryFn: () => quotesApi.list(query).then((res) => res.data),
  });
}

export function useQuoteDetail(quoteId) {
  return useQuery({
    queryKey: quoteId ? queryKeys.quotes.detail(quoteId) : ["quotes", "detail", "empty"],
    queryFn: () => quotesApi.detail(quoteId).then((res) => res.data),
    enabled: Boolean(quoteId),
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => quotesApi.create(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, ...payload }) => quotesApi.update(quoteId, payload).then((res) => res.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all });
      if (variables?.quoteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes.detail(variables.quoteId) });
      }
      if (data?.id && data.id !== variables?.quoteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes.detail(data.id) });
      }
    },
  });
}

export function useSendQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, ...payload }) => quotesApi.send(quoteId, payload).then((res) => res.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all });
      if (variables?.quoteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes.detail(variables.quoteId) });
      }
      if (data?.id && data.id !== variables?.quoteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes.detail(data.id) });
      }
    },
  });
}

export function useSubmitQuoteApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, ...payload }) => quotesApi.submitApproval(quoteId, payload).then((res) => res.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all });
      if (variables?.quoteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes.detail(variables.quoteId) });
      }
      if (data?.id && data.id !== variables?.quoteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes.detail(data.id) });
      }
    },
  });
}

export function useRecordQuoteOutput() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, ...payload }) => quotesApi.recordOutput(quoteId, payload).then((res) => res.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all });
      if (variables?.quoteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes.detail(variables.quoteId) });
      }
      if (data?.id && data.id !== variables?.quoteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes.detail(data.id) });
      }
    },
  });
}

export function useConvertQuoteToOrder(quoteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => quotesApi.convertToOrder(quoteId, payload).then((res) => res.data),
    onSuccess: () => {
      if (quoteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes.detail(quoteId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}
