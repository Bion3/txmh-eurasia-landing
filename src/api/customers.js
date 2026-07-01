import { http } from "./http";
import { buildQuery } from "./query";
import { applyPagination, canUseSupabase, requireData, success } from "./supabaseAdapter";
import { supabase } from "../lib/supabaseClient";

export const customersApi = {
  async list(query, signal) {
    if (canUseSupabase()) {
      let request = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (query?.owner_id) request = request.eq("owner_id", query.owner_id);
      if (query?.country) request = request.eq("country", query.country);
      if (query?.status) request = request.eq("status", query.status);
      if (query?.keyword) {
        const term = `%${query.keyword}%`;
        request = request.or(`company_name.ilike.${term},company_name_en.ilike.${term},country.ilike.${term}`);
      }

      const { data, count } = await requireData(applyPagination(request, query));
      return success({ items: data || [] }, {
        page: Number(query?.page || 1),
        page_size: Number(query?.page_size || 20),
        total: count || 0,
      });
    }

    return http.get(`/customers${buildQuery(query)}`, signal);
  },
  async detail(customerId, signal) {
    if (canUseSupabase()) {
      const { data: customer } = await requireData(
        supabase.from("customers").select("*").eq("id", customerId).single()
      );
      const [{ data: contacts }, { data: quotes }, { data: orders }, { data: activities }] = await Promise.all([
        requireData(supabase.from("contacts").select("*").eq("customer_id", customerId).order("created_at", { ascending: true })),
        requireData(supabase.from("quotes").select("*").eq("customer_id", customerId).order("created_at", { ascending: false })),
        requireData(supabase.from("orders").select("*").eq("customer_id", customerId).order("created_at", { ascending: false })),
        requireData(supabase.from("activities").select("*").eq("customer_id", customerId).order("created_at", { ascending: false })),
      ]);

      return success({
        ...customer,
        contacts: contacts || [],
        quotes: quotes || [],
        orders: orders || [],
        activities: activities || [],
      });
    }

    return http.get(`/customers/${customerId}`, signal);
  },
  async create(payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("customers").insert([payload]).select("*").single()
      );
      return success(data);
    }

    return http.post("/customers", payload);
  },
  async update(customerId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("customers").update(payload).eq("id", customerId).select("*").single()
      );
      return success(data);
    }

    return http.patch(`/customers/${customerId}`, payload);
  },
  async addActivity(customerId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("activities").insert([{ ...payload, customer_id: customerId }]).select("*").single()
      );
      return success(data);
    }

    return http.post(`/customers/${customerId}/activities`, payload);
  },
  async contacts(customerId, signal) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("contacts").select("*").eq("customer_id", customerId).order("created_at", { ascending: true })
      );
      return success({ items: data || [] });
    }

    return http.get(`/customers/${customerId}/contacts`, signal);
  },
  async createContact(customerId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("contacts").insert([{ ...payload, customer_id: customerId }]).select("*").single()
      );
      return success(data);
    }

    return http.post(`/customers/${customerId}/contacts`, payload);
  },
  async updateContact(contactId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("contacts").update(payload).eq("id", contactId).select("*").single()
      );
      return success(data);
    }

    return http.patch(`/contacts/${contactId}`, payload);
  },
};
