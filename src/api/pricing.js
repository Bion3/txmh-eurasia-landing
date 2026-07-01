import { http } from "./http";
import { canUseSupabase, requireData, success } from "./supabaseAdapter";
import { supabase } from "../lib/supabaseClient";

export const pricingApi = {
  async recalculate(payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.rpc("app_recalculate_quote_pricing", {
          p_transport_mode: payload.transport_mode,
          p_shipment_type: payload.shipment_type,
          p_origin: payload.origin || null,
          p_destination: payload.destination || null,
          p_volume_cbm: Number(payload.volume_cbm || 0),
          p_weight_kg: Number(payload.weight_kg || 0),
          p_container_qty: Number(payload.container_qty || 1),
          p_container_type: payload.container_type || null,
          p_customer_id: payload.customer_id || null,
          p_quote_date: payload.quote_date || null,
          p_min_margin: Number(payload.min_margin || 0.18),
        })
      );

      return success(data);
    }

    return http.post("/pricing/recalculate", payload);
  },
};
