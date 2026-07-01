import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
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
      }),
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
const shouldWrite = process.argv.includes("--write");
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

const results = [];

function add(status, label, detail = "") {
  results.push({ status, label, detail });
}

async function safeCheck(label, fn) {
  try {
    const detail = await fn();
    add("PASS", label, detail);
  } catch (error) {
    add("FAIL", label, error.message || String(error));
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  add("FAIL", "Supabase env", "set VITE_SUPABASE_ANON_KEY and either VITE_SUPABASE_URL or SUPABASE_PROJECT_REF in .env");
} else {
  add("PASS", "Supabase env", supabaseUrl);
}

if (results.some((item) => item.status === "FAIL")) {
  for (const item of results) {
    console.log(`${item.status.padEnd(4)}  ${item.label}${item.detail ? `  ${item.detail}` : ""}`);
  }
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: timedFetch,
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

await safeCheck("public lead sources", async () => {
  const { data, error } = await supabase.from("lead_sources").select("id, name").limit(1);
  if (error) throw error;
  return `${data?.length || 0} row(s) visible`;
});

await safeCheck("public campaigns", async () => {
  const { data, error } = await supabase.from("campaigns").select("id, campaign_name, status").limit(1);
  if (error) throw error;
  return `${data?.length || 0} row(s) visible`;
});

if (shouldWrite) {
  await safeCheck("anonymous lead insert permission", async () => {
    const stamp = Date.now();
    const leadNo = `ANON-CHECK-${stamp}`;
    const visitId = randomUUID();
    const sessionId = `session-anon-check-${stamp}`;
    const { data: campaignRows, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, lead_source_id, utm_source, utm_medium, utm_campaign")
      .eq("status", "active")
      .eq("utm_campaign", "rail_lcl_europe")
      .limit(1);

    if (campaignError) throw campaignError;

    const campaign = campaignRows?.[0];

    const { error: visitError } = await supabase
      .from("website_visits")
      .insert({
        id: visitId,
        session_id: sessionId,
        visitor_id: `visitor-anon-check-${stamp}`,
        lead_source_id: campaign?.lead_source_id || null,
        campaign_id: campaign?.id || null,
        landing_page: "/quote?utm_source=google&utm_medium=cpc&utm_campaign=rail_lcl_europe",
        referrer_url: "https://www.google.com/",
        utm_source: campaign?.utm_source || "google",
        utm_medium: campaign?.utm_medium || "cpc",
        utm_campaign: campaign?.utm_campaign || "rail_lcl_europe",
        device_type: "check",
        first_visit_at: new Date().toISOString(),
        last_visit_at: new Date().toISOString(),
      });

    if (visitError) throw visitError;

    const { error } = await supabase
      .from("leads")
      .insert({
        lead_no: leadNo,
        company_name: "Anonymous Permission Check",
        contact_name: "Delivery Bot",
        email: `anon-check-${stamp}@example.test`,
        source_type: "google_ads",
        lead_source_id: campaign?.lead_source_id || null,
        campaign_id: campaign?.id || null,
        website_visit_id: visitId,
        channel_detail: "public_quote_widget:LCL | utm_source=google | utm_medium=cpc | utm_campaign=rail_lcl_europe | landing=/quote",
        transport_mode_interest: "rail",
        shipment_type_interest: "LCL",
        message: `Attribution check linked to website_visit ${visitId}`,
        status: "new",
      });

    if (error) throw error;
    return `visit + lead insert accepted by RLS (${leadNo}, ${sessionId}, campaign linked: ${campaign?.id ? "yes" : "no"}); cleanup ANON-CHECK leads after testing`;
  });
} else {
  add("WARN", "anonymous lead insert permission", "skipped; run npm run check:supabase:write to test intake writes");
}

let authedClient = null;
if (email && password) {
  authedClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: timedFetch,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await safeCheck("smoke user sign-in", async () => {
    const { data, error } = await authedClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user?.email || "signed in";
  });
} else {
  add("WARN", "smoke user sign-in", "set SUPABASE_SMOKE_EMAIL and SUPABASE_SMOKE_PASSWORD to test authenticated RPC/RLS");
}

if (authedClient) {
  await safeCheck("authenticated doc number RPC", async () => {
    const { data, error } = await authedClient.rpc("app_next_doc_no", { prefix: "CHK" });
    if (error) throw error;
    return data || "generated";
  });

  await safeCheck("authenticated rate sheet read", async () => {
    const { data, error } = await authedClient.from("rate_sheets").select("id, name, status").limit(1);
    if (error) throw error;
    return `${data?.length || 0} row(s) visible`;
  });
}

const maxLabelLength = Math.max(...results.map((item) => item.label.length));
for (const item of results) {
  const detail = item.detail ? `  ${item.detail}` : "";
  console.log(`${item.status.padEnd(4)}  ${item.label.padEnd(maxLabelLength)}${detail}`);
}

const failed = results.filter((item) => item.status === "FAIL");
const warned = results.filter((item) => item.status === "WARN");

console.log("");
console.log(`Supabase check: ${failed.length} failed, ${warned.length} warning(s), ${results.length} total.`);

if (failed.length > 0) {
  process.exit(1);
}
