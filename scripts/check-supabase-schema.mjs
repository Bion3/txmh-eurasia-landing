import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = resolve(new URL("..", import.meta.url).pathname);

const readEnv = (file) => {
  const path = resolve(root, file);
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return index === -1 ? [line, ""] : [line.slice(0, index), line.slice(index + 1)];
      })
  );
};

const env = {
  ...readEnv(".env"),
  ...process.env,
};

const supabaseUrl = env.VITE_SUPABASE_URL || (env.SUPABASE_PROJECT_REF ? `https://${env.SUPABASE_PROJECT_REF}.supabase.co` : "");
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const email = env.SUPABASE_SMOKE_EMAIL;
const password = env.SUPABASE_SMOKE_PASSWORD;
const fetchTimeoutMs = Number(env.SUPABASE_CHECK_TIMEOUT_MS || 15000);

async function timedFetch(input, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal || controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

const requiredTables = [
  ["lead_sources", "id, code, name, category, is_active"],
  ["campaigns", "id, campaign_name, status, utm_source, utm_campaign"],
  ["website_visits", "id, session_id, landing_page, utm_source"],
  ["leads", "id, lead_no, company_name, source_type, lead_score, next_best_action, scoring_reason"],
  ["customers", "id, customer_no, company_name, source_primary"],
  ["contacts", "id, customer_id, name, email"],
  ["activities", "id, lead_id, customer_id, activity_type"],
  ["vendors", "id, vendor_name, vendor_type"],
  ["rate_sheets", "id, rate_sheet_no, name, mode, shipment_type, status"],
  ["rate_sheet_items", "id, rate_sheet_id, fee_code, calc_method, unit_price"],
  ["quotes", "id, quote_no, customer_id, transport_mode, estimated_revenue_total"],
  ["quote_items", "id, quote_id, fee_code, revenue_amount, estimated_cost_amount"],
  ["quote_cost_snapshots", "id, quote_id, fee_code, estimated_cost_amount"],
  ["quote_versions", "id, quote_id, version_no, approval_status, snapshot_data"],
  ["quote_approval_events", "id, quote_id, event_type, from_status, to_status"],
  ["quote_output_documents", "id, quote_id, output_type, channel, document_status"],
  ["financial_rules", "id, rule_code, rule_type, status, config"],
  ["finance_export_jobs", "id, job_no, export_type, external_system, status"],
  ["finance_export_events", "id, export_job_id, event_type, from_status, to_status"],
  ["orders", "id, order_no, customer_id, transport_mode, settlement_status"],
  ["shipments", "id, order_id, shipment_no, status"],
  ["shipment_milestones", "id, shipment_id, node_name, status"],
  ["order_parties", "id, order_id, role, company_name"],
  ["order_cargo_items", "id, order_id, goods_name_cn, gross_weight_kg, volume_cbm"],
  ["order_service_segments", "id, order_id, segment_type, status"],
  ["order_task_items", "id, order_id, group_name, task_name, status"],
  ["order_documents", "id, order_id, category, document_name"],
  ["order_finance_lines", "id, order_id, line_type, fee_code, total_amount"],
  ["order_exceptions", "id, order_id, severity, title, status"],
  ["order_operation_logs", "id, order_id, log_type, action"],
  ["order_costs", "id, order_id, fee_code, amount, status"],
  ["order_revenues", "id, order_id, fee_code, amount"],
  ["receivables", "id, customer_id, order_id, amount_due, status"],
  ["payables", "id, vendor_id, order_id, amount_due, status"],
  ["payments", "id, payment_type, party_type, amount, status"],
  ["fx_rates", "id, base_currency, quote_currency, rate, rate_date"],
  ["email_templates", "id, template_code, subject, is_active"],
  ["email_tasks", "id, lead_id, scheduled_at, status, template_code, priority"],
];

const anonReadableTables = new Set(["lead_sources", "campaigns"]);
const migrationPendingTables = new Set(["quote_versions", "quote_approval_events", "quote_output_documents", "financial_rules", "finance_export_jobs", "finance_export_events"]);

const authenticatedRpcChecks = [
  ["app_next_doc_no", (client) => client.rpc("app_next_doc_no", { prefix: "CHK" })],
  ["app_bulk_schedule_lead_followups", (client) => client.rpc("app_bulk_schedule_lead_followups", { p_limit: 1 })],
];

const results = [];

function add(status, label, detail = "") {
  results.push({ status, label, detail });
}

async function safeCheck(label, fn) {
  try {
    const detail = await fn();
    if (detail && typeof detail === "object" && detail.status) {
      add(detail.status, label, detail.detail || "");
      return;
    }
    add("PASS", label, detail);
  } catch (error) {
    add("FAIL", label, error.message || String(error));
  }
}

function printResults() {
  const maxLabelLength = Math.max(...results.map((item) => item.label.length));

  for (const item of results) {
    const detail = item.detail ? `  ${item.detail}` : "";
    console.log(`${item.status.padEnd(4)}  ${item.label.padEnd(maxLabelLength)}${detail}`);
  }

  const failed = results.filter((item) => item.status === "FAIL");
  const warned = results.filter((item) => item.status === "WARN");

  console.log("");
  console.log(`Supabase schema check: ${failed.length} failed, ${warned.length} warning(s), ${results.length} total.`);

  if (failed.length > 0) {
    console.log("");
    console.log("If tables or columns are missing, run npm run build:supabase:sql and execute supabase/deploy_bundle.sql in Supabase SQL Editor.");
    process.exit(1);
  }
}

function isPermissionDenied(error) {
  return /permission denied/i.test(error?.message || "");
}

if (!supabaseUrl || !supabaseAnonKey) {
  add("FAIL", "Supabase env", "set VITE_SUPABASE_ANON_KEY and either VITE_SUPABASE_URL or SUPABASE_PROJECT_REF in .env");
  printResults();
}

add("PASS", "Supabase env", supabaseUrl);

const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: timedFetch,
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

await Promise.all(requiredTables.map(([table, columns]) =>
  safeCheck(`table: ${table}`, async () => {
    const { data, error } = await anonClient.from(table).select(columns).limit(1);
    if (error) {
      if (migrationPendingTables.has(table) && /Could not find the table|schema cache|relation .* does not exist/i.test(error.message || "")) {
        return {
          status: "WARN",
          detail: "pending remote deploy; run npm run deploy:supabase after setting SUPABASE_DB_PASSWORD",
        };
      }

      if (!anonReadableTables.has(table) && isPermissionDenied(error)) {
        return `${columns.split(",").length} expected column(s); protected from anon Data API`;
      }

      throw error;
    }
    return `${columns.split(",").length} column(s) ok, ${data?.length || 0} row(s) visible`;
  })
));

if (email && password) {
  const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: timedFetch,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await safeCheck("authenticated sign-in", async () => {
    const { data, error } = await authedClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user?.email || "signed in";
  });

  for (const [name, runRpc] of authenticatedRpcChecks) {
    await safeCheck(`rpc: ${name}`, async () => {
      const { error } = await runRpc(authedClient);
      if (error) throw error;
      return "call accepted";
    });
  }
} else {
  add("WARN", "authenticated RPC checks", "set SUPABASE_SMOKE_EMAIL and SUPABASE_SMOKE_PASSWORD to test RPC grants and RLS");
}

printResults();
