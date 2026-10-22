import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const TABLES = {
  domestic: "freight_domestic_rates",
  plans: "freight_rail_plans",
  fcl: "freight_fcl_rail_rates",
  trucks: "freight_trucking_rates",
  rentals: "freight_container_rental_rates",
};

async function allRows(table, columns = "*") {
  if (!isSupabaseConfigured || !supabase) throw new Error("官网尚未配置采购价格库连接");
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: false })
      .range(from, from + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}

export async function loadProcurementEstimateData(transport) {
  const keys = transport === "fcl" ? ["fcl", "trucks", "rentals"] : ["domestic", "plans"];
  const [entries, suppliers] = await Promise.all([
    Promise.all(keys.map(async (key) => [key, await allRows(TABLES[key])])),
    allRows("suppliers", "id,company_name,created_at"),
  ]);
  return {
    ...Object.fromEntries(entries),
    suppliers: Object.fromEntries(suppliers.map((item) => [item.id, item.company_name])),
  };
}

export async function saveProcurementEstimate(estimate) {
  if (!isSupabaseConfigured || !supabase) throw new Error("官网尚未配置采购价格库连接");
  const { data, error } = await supabase
    .from("freight_cost_snapshots")
    .insert([{ route: estimate.inputs.route || estimate.label, inputs: estimate.inputs, result: estimate.result }])
    .select("id,created_at")
    .single();
  if (error) throw error;
  return data;
}
