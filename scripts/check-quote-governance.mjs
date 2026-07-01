import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

const checks = [
  {
    label: "quote governance migration creates version approval and output tables",
    file: "supabase/migrations/20260701012623_quote_version_approval_output_audit.sql",
    patterns: [
      /create table if not exists quote_versions/,
      /create table if not exists quote_approval_events/,
      /create table if not exists quote_output_documents/,
      /alter table quote_versions enable row level security/,
      /alter table quote_approval_events enable row level security/,
      /alter table quote_output_documents enable row level security/,
    ],
  },
  {
    label: "quote governance rpc records audited actions",
    file: "supabase/migrations/20260701012623_quote_version_approval_output_audit.sql",
    patterns: [
      /app_record_quote_governance_event/,
      /p_action = 'send'/,
      /p_action = 'submit_approval'/,
      /p_action = 'approve'/,
      /p_action = 'formal_output'/,
      /revoke execute on function app_record_quote_governance_event/,
      /grant execute on function app_record_quote_governance_event/,
    ],
  },
  {
    label: "quote api uses governance rpc and loads audit data",
    file: "src/api/quotes.js",
    patterns: [
      /recordGovernanceEvent/,
      /app_record_quote_governance_event/,
      /quote_versions/,
      /quote_approval_events/,
      /quote_output_documents/,
      /recordOutput/,
    ],
  },
  {
    label: "quote workspace surfaces output archive and audit counts",
    file: "src/components/system/QuoteWorkspace.jsx",
    patterns: [
      /useRecordQuoteOutput/,
      /recordFormalQuoteOutput/,
      /版本锁定/,
      /审批审计/,
      /输出归档/,
      /正式输出记录/,
    ],
  },
  {
    label: "supabase bundle includes quote governance migration",
    file: "scripts/build-supabase-bundle.mjs",
    patterns: [
      /20260701012623_quote_version_approval_output_audit\.sql/,
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
console.log(`Quote governance check: ${failed.length} failed, ${results.length} total.`);

if (failed.length > 0) {
  process.exit(1);
}
