import { http } from "./http";
import { buildQuery } from "./query";
import { applyPagination, canUseSupabase, requireData, success } from "./supabaseAdapter";
import { supabase } from "../lib/supabaseClient";

function fallbackLead(payload) {
  return {
    ...payload,
    website_visit: undefined,
    id: globalThis.crypto?.randomUUID?.() || `lead-${Date.now()}`,
    lead_no: payload.lead_no || "PUBLIC-LEAD",
    created_at: new Date().toISOString(),
  };
}

function applyLeadFilters(builder, query = {}) {
  let next = builder;

  if (query.status) next = next.eq("status", query.status);
  if (query.assigned_to) next = next.eq("assigned_to", query.assigned_to);
  if (query.source_type) next = next.eq("source_type", query.source_type);
  if (query.transport_mode_interest) next = next.eq("transport_mode_interest", query.transport_mode_interest);
  if (query.shipment_type_interest) next = next.eq("shipment_type_interest", query.shipment_type_interest);
  if (query.country) next = next.eq("country", query.country);
  if (query.date_from) next = next.gte("created_at", query.date_from);
  if (query.date_to) next = next.lte("created_at", query.date_to);
  if (query.keyword) {
    const term = `%${query.keyword}%`;
    next = next.or(`company_name.ilike.${term},contact_name.ilike.${term},email.ilike.${term},origin.ilike.${term},destination.ilike.${term}`);
  }

  return next;
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseChannelDetail(detail) {
  const entries = {};
  String(detail || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const index = part.indexOf("=");
      if (index > -1) {
        entries[part.slice(0, index).trim()] = part.slice(index + 1).trim();
      } else if (!entries.touchpoint) {
        entries.touchpoint = part;
      }
    });
  return entries;
}

async function resolveAcquisitionRefs(leadPayload, websiteVisit) {
  const channel = parseChannelDetail(leadPayload.channel_detail);
  const utmSource = websiteVisit?.utm_source || channel.utm_source;
  const utmMedium = websiteVisit?.utm_medium || channel.utm_medium;
  const utmCampaign = websiteVisit?.utm_campaign || channel.utm_campaign;
  const resolved = {};

  if (!leadPayload.campaign_id && (utmCampaign || utmSource || utmMedium)) {
    let request = supabase
      .from("campaigns")
      .select("id, lead_source_id, campaign_name, utm_source, utm_medium, utm_campaign, landing_page")
      .limit(1);

    if (utmCampaign) request = request.eq("utm_campaign", utmCampaign);
    if (utmSource) request = request.eq("utm_source", utmSource);
    if (utmMedium) request = request.eq("utm_medium", utmMedium);

    const { data, error } = await request;
    if (!error && data?.[0]) {
      resolved.campaign_id = data[0].id;
      if (data[0].lead_source_id) resolved.lead_source_id = data[0].lead_source_id;
    }
  }

  if (!leadPayload.lead_source_id && !resolved.lead_source_id) {
    const sourceCode = normalizeToken(leadPayload.source_type || utmSource);
    if (sourceCode) {
      const { data, error } = await supabase
        .from("lead_sources")
        .select("id, code")
        .eq("code", sourceCode)
        .limit(1);

      if (!error && data?.[0]?.id) {
        resolved.lead_source_id = data[0].id;
      }
    }
  }

  return resolved;
}

export const leadsApi = {
  async create(payload) {
    const { website_visit: websiteVisit, ...leadPayload } = payload;

    if (canUseSupabase()) {
      const { data: userResult } = await supabase.auth.getUser();
      const isSignedIn = Boolean(userResult?.user);
      const acquisitionRefs = await resolveAcquisitionRefs(leadPayload, websiteVisit).catch(() => ({}));
      const nextLeadPayload = {
        ...leadPayload,
        ...Object.fromEntries(Object.entries(acquisitionRefs).filter(([, value]) => Boolean(value))),
      };

      if (websiteVisit?.session_id) {
        const {
          already_recorded: alreadyRecorded,
          ...websiteVisitPayload
        } = websiteVisit;
        const visitId = websiteVisitPayload.id || globalThis.crypto?.randomUUID?.();
        if (visitId) {
          if (alreadyRecorded) {
            nextLeadPayload.website_visit_id = visitId;
          } else {
            const { error: visitError } = await supabase.from("website_visits").insert([{
              ...websiteVisitPayload,
              lead_source_id: nextLeadPayload.lead_source_id || websiteVisitPayload.lead_source_id || null,
              campaign_id: nextLeadPayload.campaign_id || websiteVisitPayload.campaign_id || null,
              id: visitId,
            }]);
            if (!visitError || visitError.code === "23505") {
              nextLeadPayload.website_visit_id = visitId;
            }
          }
        }
      }

      if (isSignedIn) {
        const { data } = await requireData(
          supabase.from("leads").insert([nextLeadPayload]).select("*").single()
        );
        return success(data);
      }

      const { error } = await supabase.from("leads").insert([nextLeadPayload]);
      if (error) throw error;
      return success(fallbackLead(nextLeadPayload));
    }

    return http.post("/leads", leadPayload);
  },
  async list(query, signal) {
    if (canUseSupabase()) {
      const base = supabase
        .from("leads")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      const filtered = applyLeadFilters(base, query);
      const { data, count } = await requireData(applyPagination(filtered, query));

      return success({ items: data || [] }, {
        page: Number(query?.page || 1),
        page_size: Number(query?.page_size || 20),
        total: count || 0,
      });
    }

    return http.get(`/leads${buildQuery(query)}`, signal);
  },
  async detail(leadId, signal) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("leads").select("*").eq("id", leadId).single()
      );
      return success(data);
    }

    return http.get(`/leads/${leadId}`, signal);
  },
  async update(leadId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("leads").update(payload).eq("id", leadId).select("*").single()
      );
      return success(data);
    }

    return http.patch(`/leads/${leadId}`, payload);
  },
  assign(leadId, payload) {
    if (canUseSupabase()) {
      return this.update(leadId, payload);
    }

    return http.post(`/leads/${leadId}/assign`, payload);
  },
  async addActivity(leadId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("activities").insert([{ ...payload, lead_id: leadId }]).select("*").single()
      );
      return success(data);
    }

    return http.post(`/leads/${leadId}/activities`, payload);
  },
  async activities(leadId, signal) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase
          .from("activities")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(12)
      );
      return success({ items: data || [] });
    }

    return http.get(`/leads/${leadId}/activities`, signal);
  },
  async scoreLead(leadId) {
    if (canUseSupabase()) {
      const { data, error } = await supabase.rpc("app_score_lead", {
        p_lead_id: leadId,
      });

      if (error) throw error;
      return success(data);
    }

    return http.post(`/leads/${leadId}/score`);
  },
  async scheduleFollowUp(leadId, payload = {}) {
    if (canUseSupabase()) {
      const { data, error } = await supabase.rpc("app_schedule_follow_up_for_lead", {
        p_lead_id: leadId,
        p_template_code: payload.template_code || null,
        p_delay_hours: payload.delay_hours ?? null,
      });

      if (error) throw error;
      return success(data);
    }

    return http.post(`/leads/${leadId}/schedule-follow-up`, payload);
  },
  async bulkScheduleFollowUps(payload = {}) {
    if (canUseSupabase()) {
      const { data, error } = await supabase.rpc("app_bulk_schedule_lead_followups", {
        p_limit: payload.limit || 20,
      });

      if (error) throw error;
      return success(data);
    }

    return http.post("/leads/bulk-schedule-follow-ups", payload);
  },
  async emailTasks(query = {}, signal) {
    if (canUseSupabase()) {
      let request = supabase
        .from("email_tasks")
        .select(`
          *,
          lead:leads(
            id,
            lead_no,
            company_name,
            contact_name,
            email,
            phone,
            country,
            source_type,
            intent_level,
            lead_score,
            status,
            origin,
            destination
          )
        `, { count: "exact" })
        .order("scheduled_at", { ascending: true })
        .order("priority", { ascending: true });

      if (query.status) request = request.eq("status", query.status);
      if (query.lead_id) request = request.eq("lead_id", query.lead_id);
      if (query.date_from) request = request.gte("scheduled_at", query.date_from);
      if (query.date_to) request = request.lte("scheduled_at", query.date_to);

      const { data, count } = await requireData(applyPagination(request, query));

      return success({ items: data || [] }, {
        page: Number(query?.page || 1),
        page_size: Number(query?.page_size || 20),
        total: count || 0,
      });
    }

    return http.get(`/email-tasks${buildQuery(query)}`, signal);
  },
  async updateEmailTask(taskId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.from("email_tasks").update(payload).eq("id", taskId).select("*").single()
      );
      return success(data);
    }

    return http.patch(`/email-tasks/${taskId}`, payload);
  },
  async convertToCustomer(leadId, payload) {
    if (canUseSupabase()) {
      const { data, error } = await supabase.rpc("app_convert_lead_to_customer", {
        p_lead_id: leadId,
        p_owner_id: payload?.owner_id || null,
        p_create_primary_contact: payload?.create_primary_contact ?? true,
      });

      if (error) throw error;
      return success(data);
    }

    return http.post(`/leads/${leadId}/convert-to-customer`, payload);
  },
};
