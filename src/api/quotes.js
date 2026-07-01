import { http } from "./http";
import { buildQuery } from "./query";
import { applyPagination, canUseSupabase, currentUserId, nextDocNo, requireData, success } from "./supabaseAdapter";
import { supabase } from "../lib/supabaseClient";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(value) {
  return uuidPattern.test(String(value || "")) ? value : null;
}

function summarizeItems(items = []) {
  const totals = items.reduce(
    (acc, item) => {
      acc.estimated_revenue_total += Number(item.revenue_amount || 0);
      acc.estimated_cost_total += Number(item.estimated_cost_amount || 0);
      return acc;
    },
    { estimated_revenue_total: 0, estimated_cost_total: 0 }
  );

  totals.estimated_profit_total = totals.estimated_revenue_total - totals.estimated_cost_total;
  totals.estimated_profit_margin = totals.estimated_revenue_total
    ? totals.estimated_profit_total / totals.estimated_revenue_total
    : 0;

  return totals;
}

async function recordGovernanceEvent(quoteId, action, payload = {}) {
  const userId = await currentUserId();
  const { data, error } = await supabase.rpc("app_record_quote_governance_event", {
    p_quote_id: quoteId,
    p_action: action,
    p_actor_id: asUuid(payload.actor_id) || userId,
    p_remarks: payload.remarks || null,
    p_output_type: payload.output_type || null,
    p_channel: payload.channel || null,
    p_storage_path: payload.storage_path || null,
    p_recipient_email: payload.recipient_email || null,
    p_content_hash: payload.content_hash || null,
  });

  if (error) throw error;
  return data;
}

function isMissingRelationError(error) {
  return /Could not find the table|relation .* does not exist|schema cache/i.test(error?.message || "");
}

async function optionalGovernanceRows(request) {
  const { data, error } = await request;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return data || [];
}

export const quotesApi = {
  async create(payload) {
    if (canUseSupabase()) {
      const items = payload.items || [];
      const totals = summarizeItems(items);
      const quoteNo = await nextDocNo("QT");
      const userId = await currentUserId();
      let customerId = asUuid(payload.customer_id);
      let contactId = asUuid(payload.contact_id);

      if (!customerId) {
        const customerNo = await nextDocNo("CU");
        const { data: customer } = await requireData(
          supabase
            .from("customers")
            .insert([{
              customer_no: customerNo,
              company_name: payload.customer_name || "New Customer",
              source_primary: payload.source_type || "quote_workspace",
              owner_id: userId,
              status: "prospect",
              created_from_lead_id: asUuid(payload.lead_id),
            }])
            .select("*")
            .single()
        );
        customerId = customer.id;

        if (payload.contact_name || payload.email || payload.phone) {
          const { data: contact } = await requireData(
            supabase
              .from("contacts")
              .insert([{
                customer_id: customer.id,
                name: payload.contact_name || payload.customer_name || "Primary Contact",
                email: payload.email || null,
                phone: payload.phone || null,
                is_primary: true,
                status: "active",
              }])
              .select("*")
              .single()
          );
          contactId = contact.id;
        }
      }

      const quotePayload = {
        lead_id: asUuid(payload.lead_id),
        customer_id: customerId,
        contact_id: contactId,
        transport_mode: payload.transport_mode,
        shipment_type: payload.shipment_type,
        incoterm: payload.incoterm || null,
        origin: payload.origin,
        destination: payload.destination,
        cargo_desc: payload.cargo_desc || null,
        container_type: payload.container_type || null,
        volume_cbm: payload.volume_cbm || 0,
        weight_kg: payload.weight_kg || 0,
        rate_sheet_id: payload.rate_sheet_id || null,
        pricing_status: payload.pricing_status || "auto_calculated",
        currency: payload.currency || "USD",
        valid_until: payload.valid_until || null,
        remarks: payload.remarks || null,
        quote_no: quoteNo,
        created_by: userId,
        ...totals,
      };
      const { data: quote } = await requireData(
        supabase.from("quotes").insert([quotePayload]).select("*").single()
      );

      if (items.length) {
        const quoteItems = items.map((item) => ({
          quote_id: quote.id,
          rate_sheet_item_id: item.rate_sheet_item_id || null,
          fee_code: item.fee_code,
          fee_name: item.fee_name,
          qty: item.qty || 1,
          unit: item.unit || null,
          unit_price: item.unit_price || 0,
          currency: payload.currency || "USD",
          revenue_amount: item.revenue_amount || 0,
          estimated_cost_amount: item.estimated_cost_amount || 0,
          profit_amount: Number(item.revenue_amount || 0) - Number(item.estimated_cost_amount || 0),
        }));
        await requireData(supabase.from("quote_items").insert(quoteItems));
      }

      return success(quote);
    }

      return http.post("/quotes", payload);
  },
  async list(query, signal) {
    if (canUseSupabase()) {
      let request = supabase
        .from("quotes")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (query?.customer_id) request = request.eq("customer_id", query.customer_id);
      if (query?.status) request = request.eq("status", query.status);
      if (query?.approval_status) request = request.eq("approval_status", query.approval_status);
      if (query?.transport_mode) request = request.eq("transport_mode", query.transport_mode);
      if (query?.shipment_type) request = request.eq("shipment_type", query.shipment_type);

      const { data, count } = await requireData(applyPagination(request, query));
      return success({ items: data || [] }, {
        page: Number(query?.page || 1),
        page_size: Number(query?.page_size || 20),
        total: count || 0,
      });
    }

    return http.get(`/quotes${buildQuery(query)}`, signal);
  },
  async detail(quoteId, signal) {
    if (canUseSupabase()) {
      const { data: quote } = await requireData(
        supabase.from("quotes").select("*").eq("id", quoteId).single()
      );
      const { data: items } = await requireData(
        supabase.from("quote_items").select("*").eq("quote_id", quoteId).order("sort_order", { ascending: true })
      );
      const { data: snapshots } = await requireData(
        supabase.from("quote_cost_snapshots").select("*").eq("quote_id", quoteId).order("created_at", { ascending: true })
      );
      const [versions, approvalEvents, outputDocuments] = await Promise.all([
        optionalGovernanceRows(supabase.from("quote_versions").select("*").eq("quote_id", quoteId).order("version_no", { ascending: false })),
        optionalGovernanceRows(supabase.from("quote_approval_events").select("*").eq("quote_id", quoteId).order("created_at", { ascending: false })),
        optionalGovernanceRows(supabase.from("quote_output_documents").select("*").eq("quote_id", quoteId).order("generated_at", { ascending: false })),
      ]);

      return success({
        ...quote,
        items: items || [],
        snapshots: snapshots || [],
        versions,
        approval_events: approvalEvents,
        output_documents: outputDocuments,
      });
    }

    return http.get(`/quotes/${quoteId}`, signal);
  },
  async update(quoteId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("quotes").update(payload).eq("id", quoteId).select("*").single()
      );
      return success(data);
    }

    return http.patch(`/quotes/${quoteId}`, payload);
  },
  async send(quoteId, payload = {}) {
    if (canUseSupabase()) {
      const data = await recordGovernanceEvent(quoteId, "send", {
        ...payload,
        remarks: payload.remarks || "Quote marked as sent from system workspace.",
      });
      return success(data);
    }

    return http.post(`/quotes/${quoteId}/send`, payload);
  },
  async submitApproval(quoteId, payload = {}) {
    if (canUseSupabase()) {
      const data = await recordGovernanceEvent(quoteId, "submit_approval", {
        ...payload,
        remarks: payload.remarks || "Quote submitted for approval from system workspace.",
      });
      return success(data);
    }

    return http.post(`/quotes/${quoteId}/submit-approval`);
  },
  async approve(quoteId, payload = {}) {
    if (canUseSupabase()) {
      const data = await recordGovernanceEvent(quoteId, "approve", {
        ...payload,
        remarks: payload.remarks || "Quote approved from system workspace.",
      });
      return success(data);
    }

    return http.post(`/quotes/${quoteId}/approve`, payload);
  },
  async recordOutput(quoteId, payload = {}) {
    if (canUseSupabase()) {
      const data = await recordGovernanceEvent(quoteId, "formal_output", {
        ...payload,
        remarks: payload.remarks || "Customer-facing quote output generated from system workspace.",
      });
      return success(data);
    }

    return http.post(`/quotes/${quoteId}/outputs`, payload);
  },
  async convertToOrder(quoteId, payload) {
    if (canUseSupabase()) {
      const { data, error } = await supabase.rpc("app_convert_quote_to_order", {
        p_quote_id: quoteId,
        p_sales_owner_id: payload?.sales_owner_id || null,
        p_ops_owner_id: payload?.ops_owner_id || null,
        p_booking_no: payload?.booking_no || null,
      });

      if (error) throw error;
      return success(data);
    }

    return http.post(`/quotes/${quoteId}/convert-to-order`, payload);
  },
};
