import { http } from "./http";
import { buildQuery } from "./query";
import { applyPagination, canUseSupabase, requireData, success } from "./supabaseAdapter";
import { supabase } from "../lib/supabaseClient";

export const financeApi = {
  async createOrderCost(payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("order_costs").insert([payload]).select("*").single()
      );
      return success(data);
    }

    return http.post("/order-costs", payload);
  },
  async listOrderCosts(query, signal) {
    if (canUseSupabase()) {
      let request = supabase.from("order_costs").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (query?.order_id) request = request.eq("order_id", query.order_id);
      if (query?.vendor_id) request = request.eq("vendor_id", query.vendor_id);
      if (query?.status) request = request.eq("status", query.status);
      const { data, count } = await requireData(applyPagination(request, query));
      return success({ items: data || [] }, { total: count || 0 });
    }

    return http.get(`/order-costs${buildQuery(query)}`, signal);
  },
  async listReceivables(query, signal) {
    if (canUseSupabase()) {
      let request = supabase.from("receivables").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (query?.customer_id) request = request.eq("customer_id", query.customer_id);
      if (query?.order_id) request = request.eq("order_id", query.order_id);
      if (query?.status) request = request.eq("status", query.status);
      const { data, count } = await requireData(applyPagination(request, query));
      return success({ items: data || [] }, { total: count || 0 });
    }

    return http.get(`/receivables${buildQuery(query)}`, signal);
  },
  async listPayables(query, signal) {
    if (canUseSupabase()) {
      let request = supabase.from("payables").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (query?.vendor_id) request = request.eq("vendor_id", query.vendor_id);
      if (query?.order_id) request = request.eq("order_id", query.order_id);
      if (query?.status) request = request.eq("status", query.status);
      const { data, count } = await requireData(applyPagination(request, query));
      return success({ items: data || [] }, { total: count || 0 });
    }

    return http.get(`/payables${buildQuery(query)}`, signal);
  },
  async listPayments(query, signal) {
    if (canUseSupabase()) {
      let request = supabase.from("payments").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (query?.payment_type) request = request.eq("payment_type", query.payment_type);
      if (query?.party_type) request = request.eq("party_type", query.party_type);
      if (query?.party_id) request = request.eq("party_id", query.party_id);
      const { data, count } = await requireData(applyPagination(request, query));
      return success({ items: data || [] }, { total: count || 0 });
    }

    return http.get(`/payments${buildQuery(query)}`, signal);
  },
  async recordReceivablePayment(receivableId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.rpc("app_record_receivable_payment", {
          p_receivable_id: receivableId,
          p_amount: Number(payload.amount || 0),
          p_currency: payload.currency || null,
          p_payment_date: payload.payment_date || null,
          p_payment_method: payload.payment_method || null,
          p_reference_no: payload.reference_no || null,
          p_fx_rate: payload.fx_rate || null,
          p_base_currency_amount: payload.base_currency_amount || null,
          p_allow_overpayment: payload.allow_overpayment === true,
        })
      );
      return success(data);
    }

    return http.post(`/receivables/${receivableId}/payments`, payload);
  },
  async recordPayablePayment(payableId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.rpc("app_record_payable_payment", {
          p_payable_id: payableId,
          p_amount: Number(payload.amount || 0),
          p_currency: payload.currency || null,
          p_payment_date: payload.payment_date || null,
          p_payment_method: payload.payment_method || null,
          p_reference_no: payload.reference_no || null,
          p_fx_rate: payload.fx_rate || null,
          p_base_currency_amount: payload.base_currency_amount || null,
          p_allow_overpayment: payload.allow_overpayment === true,
        })
      );
      return success(data);
    }

    return http.post(`/payables/${payableId}/payments`, payload);
  },
};
