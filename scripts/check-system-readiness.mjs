import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

function filePath(file) {
  return resolve(root, file);
}

function read(file) {
  return readFileSync(filePath(file), "utf8");
}

function hasFile(file) {
  return existsSync(filePath(file));
}

function hasPatterns(file, patterns) {
  if (!hasFile(file)) return patterns;
  const content = read(file);
  return patterns.filter((pattern) => !pattern.test(content));
}

const requirements = [
  {
    id: "public_acquisition",
    label: "官网获客引流",
    evidence: [
      {
        file: "src/App.jsx",
        patterns: [/trackAcquisitionPageView/, /PublicConversionBar/, /PublicAiAssistant/, /\/routes\/:slug/],
      },
      {
        file: "src/components/PublicConversionBar.jsx",
        patterns: [/captureAcquisitionAttribution/, /useCreateLead/, /sticky_quick_form/, /buildStickyInquiry/],
      },
      {
        file: "src/components/system/LeadPoolWorkspace.jsx",
        patterns: [/路线\s*\/\s*落地页成效面板/, /访问转化/, /routePerformanceRows/, /websiteVisits/],
      },
      {
        file: "scripts/check-acquisition-routes.mjs",
        patterns: [/Acquisition route check passed/, /Public sticky lead capture/, /routeLandingPages/],
      },
    ],
  },
  {
    id: "eurasia_business_scope_permissions",
    label: "欧亚陆路业务聚焦与权限分类",
    evidence: [
      {
        file: "docs/EURASIA_BUSINESS_SCOPE_AND_PERMISSIONS.md",
        patterns: [/中欧班列拼箱 LCL/, /中欧班列整柜 FCL/, /中亚班列与卡车/, /中俄陆路与班列/, /欧亚大陆卡车/, /登录权限分类/, /app_metadata\.role/],
      },
      {
        file: "src/data/routeLandingPages.js",
        patterns: [/rail/, /truck/, /germany|kazakhstan|russia|europe/i],
      },
    ],
  },
  {
    id: "self_service_quote_order",
    label: "自助询价下单",
    evidence: [
      {
        file: "src/components/TMS/QuoteCalculator.jsx",
        patterns: [/Create order draft/, /\/order/, /quote/],
      },
      {
        file: "src/page/SelfServiceOrderPage.jsx",
        patterns: [/scoreSelfServiceOrder/, /handleSubmit/, /leadsApi\.create/, /door-to-door/i],
      },
      {
        file: "scripts/check-self-service-order.mjs",
        patterns: [/minimum required order/, /door pickup and delivery/, /missing required fields/],
      },
    ],
  },
  {
    id: "ai_customer_service",
    label: "AI 客服",
    evidence: [
      {
        file: "src/components/PublicAiAssistant.jsx",
        patterns: [/detectIntent/, /tracking/, /ddp/, /fba/, /quote/, /requirements/],
      },
      {
        file: "scripts/check-ai-assistant.mjs",
        patterns: [/China to Germany DDP/, /Amazon FBA/, /Track order/, /报价需要什么资料/],
      },
    ],
  },
  {
    id: "door_to_door_order_lifecycle",
    label: "订单门到门全周期管理",
    evidence: [
      {
        file: "src/components/system/OrderWorkspace.jsx",
        patterns: [/doorLifecycleSteps/, /buildDoorLifecycle/, /pickup/, /finance/, /订单执行指挥台/, /订单详情治理\s*\/\s*异常闭环/, /scoreOrderDetailGovernance/, /scoreOrderVisibilityArchiveControl/, /客户轨迹\s*\/\s*异常责任\s*\/\s*POD归档/],
      },
      {
        file: "scripts/check-order-lifecycle.mjs",
        patterns: [/new order starts at pickup/, /customs in progress/, /complete order lands on finance/, /detail governance promotes open exception/, /signed order missing POD becomes P1/, /visibility archive clean order stays P3/],
      },
    ],
  },
  {
    id: "supplier_management",
    label: "供应商管理",
    evidence: [
      {
        file: "src/components/system/CostCenterWorkspace.jsx",
        patterns: [/供应商运营台/, /scoreSupplierHealth/, /scoreSupplierKpiProfile/, /scoreSupplierDetailGovernance/, /供应商 KPI\s*\/\s*风险画像/, /供应商附件\s*\/\s*响应\s*\/\s*对账付款/, /费率版本\s*\/\s*生效审批/, /账期/, /优势线路/],
      },
      {
        file: "scripts/check-supplier-health.mjs",
        patterns: [/healthy supplier gets grade A/, /expired and uncovered supplier becomes grade D/, /strong supplier KPI stays P3/, /supplier detail governance catches/, /draft rate version requires approval/],
      },
    ],
  },
  {
    id: "cost_center_pricing",
    label: "成本中心与自动核价",
    evidence: [
      {
        file: "src/components/system/CostCenterWorkspace.jsx",
        patterns: [/费率健康\s*\/\s*补价指挥台/, /费率版本\s*\/\s*生效审批/, /rateHealthRows/, /buildRateHealthPlan/, /buildRateVersionApprovalRows/, /effective_to/],
      },
      {
        file: "src/components/system/QuoteWorkspace.jsx",
        patterns: [/pricingPreview/, /estimated_profit_margin/, /低毛利/, /成本自动核算/, /recalculateMutation/, /报价版本\s*\/\s*正式输出/, /buildQuoteVersionOutputRows/, /输出归档/],
      },
      {
        file: "scripts/check-quote-pricing.mjs",
        patterns: [/rail pricing totals/, /low margin pricing triggers/, /order draft carries pricing snapshot/, /quote version output ranks low margin/],
      },
      {
        file: "scripts/check-quote-governance.mjs",
        patterns: [/quote governance migration/, /quote api uses governance rpc/, /quote workspace surfaces output archive/],
      },
    ],
  },
  {
    id: "customer_management",
    label: "客户管理开发",
    evidence: [
      {
        file: "src/components/system/CustomerWorkspace.jsx",
        patterns: [/scoreCustomerHealth/, /scoreCustomerCommercialGovernance/, /客户复购\s*\/\s*唤醒指挥台/, /主数据\s*\/\s*合同账务准备/, /合同账期\s*\/\s*合并审批\s*\/\s*等级规则/, /客户去重\s*\/\s*合并候选/, /buildCustomerDuplicateCandidates/, /风险优先/],
      },
      {
        file: "scripts/check-customer-health.mjs",
        patterns: [/active customer with master data/, /overview risk summary/, /timeline sorts/, /duplicate candidates find shared email/, /customer commercial governance catches/],
      },
    ],
  },
  {
    id: "finance_ar_ap",
    label: "财务应收应付",
    evidence: [
      {
        file: "src/components/system/FinanceWorkspace.jsx",
        patterns: [/财务结算指挥台/, /buildSettlementAging/, /buildCashRiskScore/, /buildSettlementReadiness/, /buildInvoiceTaxReconciliationControl/, /buildFinancialRuleExportControl/, /对账\s*\/\s*开票\s*\/\s*核销准备度/, /发票税率\s*\/\s*核销控制台/, /财务规则\s*\/\s*外部导出控制台/, /应收管理/, /应付结算队列/],
      },
      {
        file: "scripts/check-finance-aging.mjs",
        patterns: [/cash risk score/, /overdue amount/, /missing invoice count/, /settlement readiness captures/, /invoice tax reconciliation catches/, /financial rule export catches/],
      },
      {
        file: "scripts/check-finance-governance.mjs",
        patterns: [/financial_rules/, /finance_export_jobs/, /finance export rpc records prepare export ack fail retry/],
      },
    ],
  },
  {
    id: "system_navigation",
    label: "完整系统导航与模块闭环",
    evidence: [
      {
        file: "src/components/system/SystemWorkspace.jsx",
        patterns: [/营销获客/, /客户管理/, /报价中心/, /成本中心/, /订单管理/, /财务结算/, /setActiveModuleDetail/],
      },
      {
        file: "src/components/system/SystemOverview.jsx",
        patterns: [/今日增长指挥台/, /客户健康与复购风险/, /回款与现金流/, /业务模块入口/],
      },
      {
        file: "scripts/check-business-flow.mjs",
        patterns: [/lead conversion emits customer draft/, /quote conversion emits order draft/, /order receivable handoff emits finance draft/],
      },
    ],
  },
  {
    id: "algorithm_verification",
    label: "逻辑和算法及时验证",
    evidence: [
      {
        file: "package.json",
        patterns: [
          /check:ai-assistant/,
          /check:self-service-order/,
          /check:quote-pricing/,
          /check:order-lifecycle/,
          /check:finance-aging/,
          /check:finance-governance/,
          /check:customer-health/,
          /check:supplier-health/,
          /check:core/,
          /check:business-flow/,
          /check:release/,
          /check:delivery/,
        ],
      },
    ],
  },
];

const rows = [];

for (const requirement of requirements) {
  const missingFiles = requirement.evidence.filter((item) => !hasFile(item.file)).map((item) => item.file);
  const missingPatterns = requirement.evidence.flatMap((item) =>
    hasPatterns(item.file, item.patterns).map((pattern) => `${item.file}: ${pattern}`),
  );
  const passed = missingFiles.length === 0 && missingPatterns.length === 0;
  rows.push({
    status: passed ? "PASS" : "FAIL",
    label: requirement.label,
    detail: passed ? `${requirement.evidence.length} evidence file(s)` : [...missingFiles, ...missingPatterns].join("; "),
  });
}

const routeContent = hasFile("src/App.jsx") ? read("src/App.jsx") : "";
const routeChecks = [
  ["/quote route", /path="\/quote"/.test(routeContent)],
  ["/order route", /path="\/order"/.test(routeContent)],
  ["/system route", /path="\/system\/:module\/\*"/.test(routeContent)],
  ["/routes route", /path="\/routes\/:slug"/.test(routeContent)],
];

for (const [label, passed] of routeChecks) {
  rows.push({
    status: passed ? "PASS" : "FAIL",
    label,
    detail: "src/App.jsx",
  });
}

let failures = 0;
for (const row of rows) {
  if (row.status === "PASS") {
    console.log(`PASS  ${row.label.padEnd(32)} ${row.detail}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${row.label.padEnd(32)} ${row.detail}`);
  }
}

if (failures > 0) {
  console.error(`\nSystem readiness check: ${failures} failed, ${rows.length} total.`);
  process.exit(1);
}

console.log(`\nSystem readiness check: 0 failed, ${rows.length} total.`);
