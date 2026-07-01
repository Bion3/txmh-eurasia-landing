import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const shouldBuild = process.argv.includes("--build");

const requiredFiles = [
  "package.json",
  "src/App.jsx",
  "src/page/SystemPage.jsx",
  "src/components/system/SystemWorkspace.jsx",
  "src/components/system/SystemOverview.jsx",
  "src/components/system/LeadPoolWorkspace.jsx",
  "src/components/system/CustomerWorkspace.jsx",
  "src/components/system/QuoteWorkspace.jsx",
  "src/components/system/CostCenterWorkspace.jsx",
  "src/components/system/OrderWorkspace.jsx",
  "src/components/system/FinanceWorkspace.jsx",
  "src/components/PublicConversionBar.jsx",
  "src/api/costCenter.js",
  "src/hooks/useCostCenter.js",
  "src/api/supabaseAdapter.js",
  "src/lib/supabaseClient.js",
  "src/hooks/useAuthSession.js",
  "supabase/migrations/20260527_000000_legacy_schema_backup.sql",
  "supabase/migrations/20260527_000001_mvp_logistics_system.sql",
  "supabase/migrations/20260527_000002_mvp_rpc_workflows.sql",
  "supabase/migrations/20260528_000003_mvp_rls_policies.sql",
  "supabase/migrations/20260528105246_harden_rls_roles_and_api_grants.sql",
  "supabase/migrations/20260530_000004_order_detail_operational_tables.sql",
  "supabase/migrations/20260531_000005_lead_scoring_and_followups.sql",
  "supabase/migrations/20260531_000006_public_intake_security_hardening.sql",
  "supabase/migrations/20260531_000007_rpc_and_authenticated_policy_hardening.sql",
  "supabase/migrations/20260601_000008_email_task_update_policy.sql",
  "supabase/migrations/20260602021157_transactional_payment_rpc.sql",
  "supabase/migrations/20260602041708_pricing_recalculation_rpc.sql",
  "supabase/migrations/20260602062921_order_status_update_rpc.sql",
  "supabase/migrations/20260602063911_order_task_rpc_and_list_view.sql",
  "supabase/migrations/20260602073915_dashboard_summary_rpc.sql",
  "supabase/migrations/20260602075118_auto_lead_followup_trigger.sql",
  "supabase/migrations/20260701012623_quote_version_approval_output_audit.sql",
  "supabase/migrations/20260701090155_finance_rules_export_audit.sql",
  "supabase/seed.sql",
  "supabase/smoke_test.sql",
  "docs/DELIVERY_CHECKLIST.md",
  "docs/SYSTEM_ARCHITECTURE.md",
  "docs/CURRENT_FRAMEWORK_AND_FLOW.md",
  "docs/PROJECT_SYSTEM_AUDIT.md",
  "docs/EURASIA_BUSINESS_SCOPE_AND_PERMISSIONS.md",
  "scripts/check-business-flow.mjs",
  "scripts/check-core.mjs",
  "scripts/check-quote-pricing.mjs",
  "scripts/check-quote-governance.mjs",
  "scripts/check-finance-governance.mjs",
  "scripts/check-release.mjs",
  "scripts/check-supabase.mjs",
  "scripts/check-supabase-schema.mjs",
  "scripts/check-system-readiness.mjs",
  "scripts/build-supabase-bundle.mjs",
  "scripts/deploy-supabase-bundle.mjs",
];

const requiredDependencies = [
  "@supabase/supabase-js",
  "@tanstack/react-query",
  "react",
  "react-dom",
  "react-router",
  "vite",
];

const requiredEnvKeys = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
];

const forbiddenSqlPatterns = [
  {
    file: "supabase/migrations/20260528_000003_mvp_rls_policies.sql",
    pattern: /user_metadata['")\s-]*->>?\s*['"]role['"]/i,
    label: "RLS must not authorize from user_metadata.role",
  },
  {
    file: "supabase/migrations/20260528105246_harden_rls_roles_and_api_grants.sql",
    pattern: /user_metadata['")\s-]*->>?\s*['"]role['"]/i,
    label: "hardening migration must not authorize from user_metadata.role",
  },
];

const requiredContentChecks = [
  {
    file: "src/components/PublicConversionBar.jsx",
    label: "public sticky direct lead capture",
    patterns: [
      /30-second inquiry/,
      /handleSubmit/,
      /useCreateLead/,
      /captureAcquisitionAttribution/,
      /sticky_quick_form/,
      /buildStickyInquiry/,
    ],
  },
  {
    file: "src/lib/acquisitionAttribution.js",
    label: "public page-view conversion tracking",
    patterns: [
      /PAGE_VIEW_STORAGE_KEY/,
      /trackAcquisitionPageView/,
      /already_recorded/,
      /:page_view/,
      /website_visits/,
    ],
  },
  {
    file: "src/components/system/SystemOverview.jsx",
    label: "system overview growth command center",
    patterns: [
      /今日增长指挥台/,
      /handleCopyGrowthCommandPlan/,
      /growthCommandRows/,
      /buildGrowthCommandPlan/,
    ],
  },
  {
    file: "src/components/system/SystemOverview.jsx",
    label: "traditional system benchmark radar",
    patterns: [
      /传统系统借鉴雷达/,
      /buildTraditionalSystemBenchmarkRows/,
      /传统 CRM/,
      /供应商管理\s*\/\s*SRM/,
      /ERP\s*\/\s*财务系统/,
    ],
  },
  {
    file: "docs/EURASIA_BUSINESS_SCOPE_AND_PERMISSIONS.md",
    label: "eurasia rail truck business scope and permissions",
    patterns: [
      /中欧班列拼箱 LCL/,
      /中欧班列整柜 FCL/,
      /中亚班列与卡车/,
      /中俄陆路与班列/,
      /欧亚大陆卡车/,
      /登录权限分类/,
      /app_metadata\.role/,
      /check:finance-governance/,
    ],
  },
  {
    file: "src/components/system/SystemWorkspace.jsx",
    label: "customer quote order detail deep links",
    patterns: [
      /detailModuleLabels/,
      /selectedCustomerId=\{detailId\}/,
      /selectedQuoteId=\{detailId\}/,
      /selectedOrderId=\{detailId\}/,
      /handleCopyDetailLink/,
      /复制详情链接/,
    ],
  },
  {
    file: "src/components/system/LeadPoolWorkspace.jsx",
    label: "lead workspace route landing performance panel",
    patterns: [
      /路线\s*\/\s*落地页成效面板/,
      /handleCopyRouteActionPlan/,
      /routePerformanceRows/,
      /campaignLandingOptions/,
      /访问转化/,
      /visitorCount/,
      /websiteVisits/,
    ],
  },
  {
    file: "src/components/system/CustomerWorkspace.jsx",
    label: "customer workspace reactivation command center",
    patterns: [
      /客户复购\s*\/\s*唤醒指挥台/,
      /handleCopyCustomerGrowthPlan/,
      /customerGrowthRows/,
      /buildCustomerGrowthPlan/,
      /handleScheduleRepurchase\(customer\)/,
    ],
  },
  {
    file: "src/components/system/CustomerWorkspace.jsx",
    label: "customer duplicate merge candidates",
    patterns: [
      /客户去重\s*\/\s*合并候选/,
      /buildCustomerDuplicateCandidates/,
      /scoreCustomerDuplicatePair/,
      /复制合并检查清单/,
      /疑似重复/,
    ],
  },
  {
    file: "src/components/system/CustomerWorkspace.jsx",
    label: "customer commercial governance approval tier terms",
    patterns: [
      /合同账期\s*\/\s*合并审批\s*\/\s*等级规则/,
      /scoreCustomerCommercialGovernance/,
      /buildCustomerCommercialGovernancePlan/,
      /复制客户商业治理清单/,
      /客户等级\/加价规则/,
      /疑似重复未进入合并审批/,
    ],
  },
  {
    file: "src/components/system/CostCenterWorkspace.jsx",
    label: "cost center rate health command center",
    patterns: [
      /费率健康\s*\/\s*补价指挥台/,
      /handleCopyRateHealthPlan/,
      /rateHealthRows/,
      /buildRateHealthPlan/,
      /effective_to/,
    ],
  },
  {
    file: "src/components/system/CostCenterWorkspace.jsx",
    label: "supplier KPI risk profile",
    patterns: [
      /供应商 KPI\s*\/\s*风险画像/,
      /scoreSupplierKpiProfile/,
      /费率新鲜度/,
      /财务准备/,
      /异常压力/,
      /selectedSupplierKpi/,
    ],
  },
  {
    file: "src/components/system/CostCenterWorkspace.jsx",
    label: "supplier detail attachment response reconciliation governance",
    patterns: [
      /供应商附件\s*\/\s*响应\s*\/\s*对账付款/,
      /scoreSupplierDetailGovernance/,
      /buildSupplierDetailGovernancePlan/,
      /复制详情治理清单/,
      /附件合规/,
      /响应时效/,
      /对账付款/,
    ],
  },
  {
    file: "src/components/system/CostCenterWorkspace.jsx",
    label: "rate version approval readiness",
    patterns: [
      /费率版本\s*\/\s*生效审批/,
      /scoreRateVersionReadiness/,
      /buildRateVersionApprovalRows/,
      /复制费率审批清单/,
      /版本连续性/,
    ],
  },
  {
    file: "src/components/system/QuoteWorkspace.jsx",
    label: "quote workspace follow-up command center",
    patterns: [
      /报价跟进工作台/,
      /handleCopyQuoteFollowUpPlan/,
      /quoteQueueRows/,
      /buildQuoteFollowUpPlan/,
    ],
  },
  {
    file: "src/components/system/QuoteWorkspace.jsx",
    label: "quote version formal output control",
    patterns: [
      /报价版本\s*\/\s*正式输出/,
      /buildQuoteVersionOutputRows/,
      /scoreQuoteVersionOutput/,
      /复制正式输出清单/,
      /客户版邮件\/PDF/,
    ],
  },
  {
    file: "supabase/migrations/20260701012623_quote_version_approval_output_audit.sql",
    label: "quote governance version approval output audit",
    patterns: [
      /quote_versions/,
      /quote_approval_events/,
      /quote_output_documents/,
      /app_record_quote_governance_event/,
      /enable row level security/,
      /formal_output/,
    ],
  },
  {
    file: "supabase/migrations/20260701090155_finance_rules_export_audit.sql",
    label: "finance governance rule export audit",
    patterns: [
      /financial_rules/,
      /finance_export_jobs/,
      /finance_export_events/,
      /app_record_finance_export_event/,
      /enable row level security/,
      /retry_pending/,
      /acknowledged/,
    ],
  },
  {
    file: "src/components/system/OrderWorkspace.jsx",
    label: "order workspace execution command center",
    patterns: [
      /订单执行指挥台/,
      /handleCopyOrderExecutionPlan/,
      /orderExecutionRows/,
      /buildOrderExecutionPlan/,
    ],
  },
  {
    file: "src/components/system/OrderWorkspace.jsx",
    label: "order detail governance exception closure",
    patterns: [
      /订单详情治理\s*\/\s*异常闭环/,
      /scoreOrderDetailGovernance/,
      /buildOrderDetailGovernancePlan/,
      /复制详情治理清单/,
      /附件准备/,
    ],
  },
  {
    file: "src/components/system/OrderWorkspace.jsx",
    label: "order customer visibility pod archive governance",
    patterns: [
      /客户轨迹\s*\/\s*异常责任\s*\/\s*POD归档/,
      /scoreOrderVisibilityArchiveControl/,
      /buildOrderVisibilityArchivePlan/,
      /复制客户轨迹归档清单/,
      /客户轨迹/,
      /POD归档/,
      /异常责任/,
    ],
  },
  {
    file: "src/components/system/FinanceWorkspace.jsx",
    label: "finance workspace settlement command center",
    patterns: [
      /财务结算指挥台/,
      /handleCopyFinanceActionPlan/,
      /financeCommandRows/,
      /buildFinanceActionPlan/,
    ],
  },
  {
    file: "src/components/system/FinanceWorkspace.jsx",
    label: "finance settlement readiness profile",
    patterns: [
      /对账\s*\/\s*开票\s*\/\s*核销准备度/,
      /buildSettlementReadiness/,
      /票据准备/,
      /账期准备/,
      /毛利确认/,
      /settlementReadiness/,
    ],
  },
  {
    file: "src/components/system/FinanceWorkspace.jsx",
    label: "finance invoice tax reconciliation control",
    patterns: [
      /发票税率\s*\/\s*核销控制台/,
      /buildInvoiceTaxReconciliationControl/,
      /税率校验/,
      /余额核销/,
      /invoiceTaxControl/,
    ],
  },
  {
    file: "src/components/system/FinanceWorkspace.jsx",
    label: "finance rules external export control",
    patterns: [
      /财务规则\s*\/\s*外部导出控制台/,
      /buildFinancialRuleExportControl/,
      /buildFinancialRuleExportPlan/,
      /复制导出治理清单/,
      /坏账\/折扣/,
      /外部导出/,
    ],
  },
];

const results = [];

function add(status, label, detail = "") {
  results.push({ status, label, detail });
}

function filePath(file) {
  return resolve(root, file);
}

function readJson(file) {
  return JSON.parse(readFileSync(filePath(file), "utf8"));
}

function readEnv(file) {
  if (!existsSync(filePath(file))) {
    return null;
  }

  return Object.fromEntries(
    readFileSync(filePath(file), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return index === -1 ? [line, ""] : [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

for (const file of requiredFiles) {
  add(existsSync(filePath(file)) ? "PASS" : "FAIL", `required file: ${file}`);
}

try {
  const packageJson = readJson("package.json");
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const dependency of requiredDependencies) {
    add(
      allDependencies[dependency] ? "PASS" : "FAIL",
      `dependency: ${dependency}`,
      allDependencies[dependency] || "missing",
    );
  }

  add(packageJson.scripts?.build ? "PASS" : "FAIL", "npm script: build");
  add(packageJson.scripts?.dev ? "PASS" : "FAIL", "npm script: dev");
  add(packageJson.scripts?.["check:business-flow"] ? "PASS" : "FAIL", "npm script: check:business-flow");
  add(packageJson.scripts?.["check:core"] ? "PASS" : "FAIL", "npm script: check:core");
  add(packageJson.scripts?.["check:release"] ? "PASS" : "FAIL", "npm script: check:release");
  add(packageJson.scripts?.["check:release:strict"] ? "PASS" : "FAIL", "npm script: check:release:strict");
  add(packageJson.scripts?.["check:release:write"] ? "PASS" : "FAIL", "npm script: check:release:write");
  add(packageJson.scripts?.["check:quote-pricing"] ? "PASS" : "FAIL", "npm script: check:quote-pricing");
  add(packageJson.scripts?.["check:quote-governance"] ? "PASS" : "FAIL", "npm script: check:quote-governance");
  add(packageJson.scripts?.["check:finance-governance"] ? "PASS" : "FAIL", "npm script: check:finance-governance");
  add(packageJson.scripts?.["check:supabase"] ? "PASS" : "FAIL", "npm script: check:supabase");
  add(packageJson.scripts?.["check:supabase:schema"] ? "PASS" : "FAIL", "npm script: check:supabase:schema");
  add(packageJson.scripts?.["check:supabase:write"] ? "PASS" : "FAIL", "npm script: check:supabase:write");
  add(packageJson.scripts?.["check:system-readiness"] ? "PASS" : "FAIL", "npm script: check:system-readiness");
  add(packageJson.scripts?.["build:supabase:sql"] ? "PASS" : "FAIL", "npm script: build:supabase:sql");
  add(packageJson.scripts?.["deploy:supabase"] ? "PASS" : "FAIL", "npm script: deploy:supabase");
} catch (error) {
  add("FAIL", "package.json can be parsed", error.message);
}

const envExample = readEnv(".env.example");
for (const key of requiredEnvKeys) {
  add(envExample?.[key] !== undefined ? "PASS" : "FAIL", `.env.example key: ${key}`);
}

for (const check of forbiddenSqlPatterns) {
  const content = existsSync(filePath(check.file)) ? readFileSync(filePath(check.file), "utf8") : "";
  add(!check.pattern.test(content) ? "PASS" : "FAIL", check.label, check.file);
}

for (const check of requiredContentChecks) {
  const content = existsSync(filePath(check.file)) ? readFileSync(filePath(check.file), "utf8") : "";
  const missing = check.patterns.filter((pattern) => !pattern.test(content));
  add(missing.length === 0 ? "PASS" : "FAIL", check.label, missing.length ? `missing ${missing.length} pattern(s)` : check.file);
}

const env = readEnv(".env");
if (!env) {
  add("WARN", ".env exists", "copy .env.example to .env before connecting Supabase");
} else {
  for (const key of requiredEnvKeys) {
    add(env[key] ? "PASS" : "WARN", `.env value: ${key}`, env[key] ? "configured" : "empty");
  }
}

if (shouldBuild) {
  const build = spawnSync("npm", ["run", "build"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });

  add(build.status === 0 ? "PASS" : "FAIL", "npm run build", build.status === 0 ? "" : build.stderr || build.stdout);
}

const maxLabelLength = Math.max(...results.map((item) => item.label.length));
for (const item of results) {
  const detail = item.detail ? `  ${item.detail}` : "";
  console.log(`${item.status.padEnd(4)}  ${item.label.padEnd(maxLabelLength)}${detail}`);
}

const failed = results.filter((item) => item.status === "FAIL");
const warned = results.filter((item) => item.status === "WARN");

console.log("");
console.log(`Delivery check: ${failed.length} failed, ${warned.length} warning(s), ${results.length} total.`);

if (failed.length > 0) {
  process.exit(1);
}
