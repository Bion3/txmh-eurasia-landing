import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

const checks = [
  {
    label: "finance governance migration creates rule export audit tables",
    file: "supabase/migrations/20260701090155_finance_rules_export_audit.sql",
    patterns: [
      /create table if not exists financial_rules/,
      /create table if not exists finance_export_jobs/,
      /create table if not exists finance_export_events/,
      /alter table financial_rules enable row level security/,
      /alter table finance_export_jobs enable row level security/,
      /alter table finance_export_events enable row level security/,
    ],
  },
  {
    label: "finance governance migration grants explicit authenticated access",
    file: "supabase/migrations/20260701090155_finance_rules_export_audit.sql",
    patterns: [
      /grant select, insert, update on\s+financial_rules,\s+finance_export_jobs,\s+finance_export_events\s+to authenticated/s,
      /financial_rules_select_policy/,
      /finance_export_jobs_select_policy/,
      /finance_export_events_select_policy/,
      /app_is_any_role\(array\['admin', 'manager', 'finance'\]\)/,
    ],
  },
  {
    label: "finance export rpc records prepare export ack fail retry",
    file: "supabase/migrations/20260701090155_finance_rules_export_audit.sql",
    patterns: [
      /app_record_finance_export_event/,
      /p_action in \('prepare', 'queue'\)/,
      /p_action = 'export'/,
      /p_action in \('ack', 'acknowledge'\)/,
      /p_action = 'fail'/,
      /p_action = 'retry'/,
      /revoke execute on function app_record_finance_export_event/,
      /grant execute on function app_record_finance_export_event/,
    ],
  },
  {
    label: "supabase bundle includes finance governance migration",
    file: "scripts/build-supabase-bundle.mjs",
    patterns: [
      /20260701090155_finance_rules_export_audit\.sql/,
    ],
  },
  {
    label: "release schema check tracks finance governance tables",
    file: "scripts/check-supabase-schema.mjs",
    patterns: [
      /financial_rules/,
      /finance_export_jobs/,
      /finance_export_events/,
    ],
  },
];

const results = [];

function add(status, label, detail = "") {
  results.push({ status, label, detail });
}

for (const check of checks) {
  const path = resolve(root, check.file);
  if (!existsSync(path)) {
    add("FAIL", check.label, `${check.file} missing`);
    continue;
  }

  const content = readFileSync(path, "utf8");
  const missing = check.patterns.filter((pattern) => !pattern.test(content));
  add(missing.length === 0 ? "PASS" : "FAIL", check.label, missing.length ? `missing ${missing.length} pattern(s)` : check.file);
}

const maxLabelLength = Math.max(...results.map((item) => item.label.length));
for (const result of results) {
  console.log(`${result.status.padEnd(4)}  ${result.label.padEnd(maxLabelLength)}  ${result.detail}`);
}

const failed = results.filter((item) => item.status === "FAIL");
console.log("");
console.log(`Finance governance check: ${failed.length} failed, ${results.length} total.`);

if (failed.length > 0) {
  process.exit(1);
}
