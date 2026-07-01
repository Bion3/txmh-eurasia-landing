import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { queryKeys } from "./queryKeys";

async function callRpc(fnName, args) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase RPC is not configured");
  }

  const { data, error } = await supabase.rpc(fnName, args);

  if (error) {
    throw error;
  }

  return data;
}

export function useRpcConvertLeadToCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, ownerId = null, createPrimaryContact = true }) =>
      callRpc("app_convert_lead_to_customer", {
        p_lead_id: leadId,
        p_owner_id: ownerId,
        p_create_primary_contact: createPrimaryContact,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useRpcConvertQuoteToOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, salesOwnerId = null, opsOwnerId = null, bookingNo = null }) =>
      callRpc("app_convert_quote_to_order", {
        p_quote_id: quoteId,
        p_sales_owner_id: salesOwnerId,
        p_ops_owner_id: opsOwnerId,
        p_booking_no: bookingNo,
      }),
    onSuccess: (_data, variables) => {
      if (variables?.quoteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes.detail(variables.quoteId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useRpcGenerateReceivableForOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, dueDate = null }) =>
      callRpc("app_generate_receivable_for_order", {
        p_order_id: orderId,
        p_due_date: dueDate,
      }),
    onSuccess: (_data, variables) => {
      if (variables?.orderId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useRpcGeneratePayablesForOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, dueDate = null }) =>
      callRpc("app_generate_payables_for_order", {
        p_order_id: orderId,
        p_due_date: dueDate,
      }),
    onSuccess: (_data, variables) => {
      if (variables?.orderId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}
