import { http } from "./http";
import { buildQuery } from "./query";
import { applyPagination, canUseSupabase, currentUserId, nextDocNo, requireData, success } from "./supabaseAdapter";
import { supabase } from "../lib/supabaseClient";

function applyRateSheetFilters(builder, query = {}) {
  let next = builder;

  if (query.mode) next = next.eq("mode", query.mode);
  if (query.shipment_type) next = next.eq("shipment_type", query.shipment_type);
  if (query.status) next = next.eq("status", query.status);
  if (query.vendor_id) next = next.eq("vendor_id", query.vendor_id);
  if (query.keyword) {
    const term = `%${query.keyword}%`;
    next = next.or(`name.ilike.${term},rate_sheet_no.ilike.${term},origin_port.ilike.${term},destination_port.ilike.${term}`);
  }

  return next;
}

export const costCenterApi = {
  async vendors(query = {}, signal) {
    if (canUseSupabase()) {
      let request = supabase
        .from("vendors")
        .select("*", { count: "exact" })
        .order("vendor_name", { ascending: true });

      if (query.status) request = request.eq("status", query.status);
      if (query.vendor_type) request = request.eq("vendor_type", query.vendor_type);
      if (query.keyword) {
        const term = `%${query.keyword}%`;
        request = request.or(`vendor_name.ilike.${term},country.ilike.${term},contact_name.ilike.${term}`);
      }

      const { data, count } = await requireData(applyPagination(request, query));
      return success({ items: data || [] }, {
        page: Number(query.page || 1),
        page_size: Number(query.page_size || 50),
        total: count || 0,
      });
    }

    return http.get(`/cost-center/vendors${buildQuery(query)}`, signal);
  },

  async rateSheets(query = {}, signal) {
    if (canUseSupabase()) {
      const request = supabase
        .from("rate_sheets")
        .select(`
          *,
          vendor:vendors(id, vendor_name, vendor_type, country, payment_term)
        `, { count: "exact" })
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false });

      const filtered = applyRateSheetFilters(request, query);
      const { data, count } = await requireData(applyPagination(filtered, query));
      return success({ items: data || [] }, {
        page: Number(query.page || 1),
        page_size: Number(query.page_size || 50),
        total: count || 0,
      });
    }

    return http.get(`/cost-center/rate-sheets${buildQuery(query)}`, signal);
  },

  async rateSheetItems(rateSheetId, query = {}, signal) {
    if (canUseSupabase()) {
      if (!rateSheetId) return success({ items: [] }, { page: 1, page_size: 100, total: 0 });

      let request = supabase
        .from("rate_sheet_items")
        .select("*", { count: "exact" })
        .eq("rate_sheet_id", rateSheetId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (query.included_in_quote !== undefined) {
        request = request.eq("included_in_quote", query.included_in_quote);
      }
      if (query.keyword) {
        const term = `%${query.keyword}%`;
        request = request.or(`fee_code.ilike.${term},fee_name.ilike.${term},unit.ilike.${term}`);
      }

      const { data, count } = await requireData(applyPagination(request, { page_size: 100, ...query }));
      return success({ items: data || [] }, {
        page: Number(query.page || 1),
        page_size: Number(query.page_size || 100),
        total: count || 0,
      });
    }

    return http.get(`/cost-center/rate-sheets/${rateSheetId}/items${buildQuery(query)}`, signal);
  },

  async createRateSheet(payload) {
    if (canUseSupabase()) {
      const userId = await currentUserId();
      const rateSheetNo = payload.rate_sheet_no || await nextDocNo("RS");
      const { data } = await requireData(
        supabase
          .from("rate_sheets")
          .insert([{
            ...payload,
            rate_sheet_no: rateSheetNo,
            created_by: userId,
          }])
          .select("*")
          .single()
      );
      return success(data);
    }

    return http.post("/cost-center/rate-sheets", payload);
  },

  async createRateSheetItem(rateSheetId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase
          .from("rate_sheet_items")
          .insert([{
            ...payload,
            rate_sheet_id: rateSheetId,
          }])
          .select("*")
          .single()
      );
      return success(data);
    }

    return http.post(`/cost-center/rate-sheets/${rateSheetId}/items`, payload);
  },
};
