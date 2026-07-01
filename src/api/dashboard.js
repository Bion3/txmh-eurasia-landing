import { http } from "./http";
import { buildQuery } from "./query";
import { applyPagination, canUseSupabase, requireData, success } from "./supabaseAdapter";
import { supabase } from "../lib/supabaseClient";

export const dashboardApi = {
  async summary(signal) {
    if (canUseSupabase()) {
      const { data } = await requireData(supabase.rpc("app_dashboard_summary"));
      return success(data);
    }

    return http.get("/dashboard/summary", signal);
  },
  salesFunnel(query, signal) {
    return http.get(`/dashboard/sales-funnel${buildQuery(query)}`, signal);
  },
  profitOverview(query, signal) {
    return http.get(`/dashboard/profit-overview${buildQuery(query)}`, signal);
  },
  async leadSourceOverview(query = {}, signal) {
    if (canUseSupabase()) {
      let sourcesRequest = supabase
        .from("lead_sources")
        .select("*", { count: "exact" })
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (query.is_active !== undefined) sourcesRequest = sourcesRequest.eq("is_active", query.is_active);

      let campaignsRequest = supabase
        .from("campaigns")
        .select(`
          *,
          lead_source:lead_sources(id, code, name, category)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (query.is_active === true) campaignsRequest = campaignsRequest.eq("status", "active");

      const [
        { data: leadSources, count: sourceCount },
        { data: campaigns, count: campaignCount },
      ] = await Promise.all([
        requireData(applyPagination(sourcesRequest, { page_size: 100, ...query })),
        requireData(applyPagination(campaignsRequest, { page_size: 100, ...query })),
      ]);

      let websiteVisits = [];
      let visitsAvailable = true;
      try {
        const visitDateFrom = query.date_from || new Date(Date.now() - 90 * 86400000).toISOString();
        const { data: visitRows } = await requireData(
          applyPagination(
            supabase
              .from("website_visits")
              .select("id, session_id, visitor_id, lead_source_id, campaign_id, landing_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content, device_type, created_at")
              .gte("created_at", visitDateFrom)
              .order("created_at", { ascending: false }),
            { page_size: 2000 },
          ),
        );
        websiteVisits = visitRows || [];
      } catch (error) {
        visitsAvailable = false;
      }

      return success({
        leadSources: leadSources || [],
        campaigns: campaigns || [],
        websiteVisits,
        visitsAvailable,
      }, {
        source_total: sourceCount || 0,
        campaign_total: campaignCount || 0,
        visit_total: websiteVisits.length,
      });
    }

    return http.get(`/dashboard/lead-source-overview${buildQuery(query)}`, signal);
  },
};
