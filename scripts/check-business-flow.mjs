import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

function read(file) {
  const path = resolve(root, file);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function checkPatterns(file, checks) {
  const content = read(file);
  return checks.map(([name, pattern]) => ({
    name,
    passed: pattern.test(content),
    file,
  }));
}

const checks = [
  ...checkPatterns("src/components/system/SystemWorkspace.jsx", [
    ["workspace stores customer draft from lead conversion", /payload\?\.customerDraft[\s\S]*setCustomerDraft\(payload\.customerDraft\)[\s\S]*setActiveModule\("customers"\)/],
    ["workspace stores order draft from quote conversion", /payload\?\.orderDraft[\s\S]*setOrderDraft\(payload\.orderDraft\)[\s\S]*setActiveModule\("orders"\)/],
    ["workspace stores finance draft from order handoff", /payload\?\.financeDraft[\s\S]*setFinanceDraft\(payload\.financeDraft\)[\s\S]*setActiveModule\("finance"\)/],
    ["workspace routes lead quote creation into quote module", /handleCreateQuote[\s\S]*setSelectedLead\(lead\)[\s\S]*setActiveModule\("quotes"\)/],
    ["workspace maps order handoff amounts into finance draft", /receivableOpen:\s*orderDraft\?\.estimated_revenue_total[\s\S]*payableOpen:\s*orderDraft\?\.estimated_cost_total/],
  ]),
  ...checkPatterns("src/components/system/LeadPoolWorkspace.jsx", [
    ["lead conversion emits customer draft", /title:\s*"线索已转客户"[\s\S]*customerDraft:/],
    ["lead fallback keeps local customer draft", /title:\s*"客户草稿已暂存本地"[\s\S]*created_from_lead_id:\s*selectedLead\.id/],
    ["lead can open quote creation", /onClick=\{\(\)\s*=>\s*onCreateQuote\?\.\(selectedLead\)\}/],
  ]),
  ...checkPatterns("src/components/system/CustomerWorkspace.jsx", [
    ["customer workspace can create quote from selected customer", /onCreateQuote\?\.\(resolvedCustomer\)/],
    ["customer workspace schedules repurchase follow-up", /handleScheduleRepurchase\(resolvedCustomer\)/],
  ]),
  ...checkPatterns("src/components/system/QuoteWorkspace.jsx", [
    ["quote conversion emits order draft", /title:\s*"报价已转订单"[\s\S]*orderDraft:\s*buildOrderDraft/],
    ["quote fallback emits local order draft", /title:\s*"订单草稿已暂存本地"[\s\S]*orderDraft:\s*buildOrderDraft\(\)/],
    ["quote order draft carries revenue cost and profit snapshot", /estimated_revenue_total:\s*pricingPreview\?\.summary\?\.estimated_revenue_total[\s\S]*estimated_cost_total:\s*pricingPreview\?\.summary\?\.estimated_cost_total[\s\S]*estimated_profit_total:\s*pricingPreview\?\.summary\?\.estimated_profit_total/],
  ]),
  ...checkPatterns("src/components/system/OrderWorkspace.jsx", [
    ["order initializes from quote order draft", /quoted_revenue_total:\s*orderDraft\?\.estimated_revenue_total[\s\S]*quoted_cost_total:\s*orderDraft\?\.estimated_cost_total/],
    ["order receivable handoff emits finance draft", /title:\s*"应收流程已生成"[\s\S]*financeDraft:\s*buildFinanceDraft/],
    ["order cost handoff emits finance draft", /title:\s*"成本录入已排队"[\s\S]*financeDraft:\s*buildFinanceDraft/],
  ]),
  ...checkPatterns("src/components/system/FinanceWorkspace.jsx", [
    ["finance opens receivables by finance draft focus", /financeDraft\?\.focus\s*===\s*"costs"\s*\?\s*"costs"\s*:\s*"receivables"/],
    ["finance builds receivable rows from finance draft", /financeDraft\?\.receivableRows[\s\S]*amount_due:\s*String\(financeDraft\?\.receivableOpen/],
    ["finance builds payable rows from finance draft", /financeDraft\?\.payableRows[\s\S]*balance_amount:\s*String\(financeDraft\?\.payableOpen/],
    ["finance action plan uses current finance draft context", /buildFinanceActionPlan\(financeCommandRows,\s*financeCommandSummary,\s*financeDraft\)/],
  ]),
];

let failures = 0;
for (const check of checks) {
  if (check.passed) {
    console.log(`PASS  ${check.name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${check.name}  ${check.file}`);
  }
}

if (failures > 0) {
  console.error(`\nBusiness flow check: ${failures} failed, ${checks.length} total.`);
  process.exit(1);
}

console.log(`\nBusiness flow check: 0 failed, ${checks.length} total.`);
