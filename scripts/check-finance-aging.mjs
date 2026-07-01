const fixedToday = "2026-07-01";

function parseDateMs(value) {
  if (!value || value === "-") return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function daysUntil(value) {
  const timestamp = parseDateMs(value);
  if (!timestamp) return null;
  const today = new Date(fixedToday).getTime();
  return Math.ceil((timestamp - today) / 86400000);
}

function financeAmount(row, ...fields) {
  for (const field of fields) {
    const value = Number(row?.[field] ?? 0);
    if (!Number.isNaN(value) && value > 0) return value;
  }
  return 0;
}

function financeDueLabel(dateValue) {
  const dueInDays = daysUntil(dateValue);
  if (dueInDays === null) return "无到期日";
  if (dueInDays < 0) return `逾期 ${Math.abs(dueInDays)} 天`;
  if (dueInDays === 0) return "今天到期";
  return `${dueInDays} 天后到期`;
}

function isClosedFinanceStatus(status) {
  const value = String(status || "").toLowerCase();
  return value === "closed" || value === "paid" || value === "settled" || value.includes("已结清");
}

function hasInvoiceReference(row) {
  return Boolean(row?.invoice_id || row?.invoice_no || row?.bill_no || row?.statement_no);
}

function buildSettlementAging({ receivables, payables }) {
  const normalize = (row, kind) => {
    const balance = financeAmount(row, "balance_amount", kind === "receivable" ? "amount_due" : "amount", "amount_due");
    const dueDate = row.due_date || row.occurred_at;
    const dueInDays = daysUntil(dueDate);
    const closed = isClosedFinanceStatus(row.status) || balance <= 0;
    let bucket = "no_due_date";

    if (closed) bucket = "closed";
    else if (dueInDays === null) bucket = "no_due_date";
    else if (dueInDays < 0) bucket = "overdue";
    else if (dueInDays <= 3) bucket = "due_soon";
    else if (dueInDays <= 14) bucket = "due_later";
    else bucket = "future";

    return {
      id: row.id,
      kind,
      party: kind === "receivable" ? row.customer || "客户" : row.vendor || "供应商",
      target: kind === "receivable" ? row.order_no || "订单" : row.description || row.cost_category || "应付",
      currency: row.currency || "USD",
      balance,
      dueDate,
      dueInDays,
      dueLabel: financeDueLabel(dueDate),
      status: row.status || "open",
      bucket,
      hasInvoice: hasInvoiceReference(row),
      row,
    };
  };

  const items = [
    ...receivables.map((row) => normalize(row, "receivable")),
    ...payables.map((row) => normalize(row, "payable")),
  ];
  const openItems = items.filter((item) => item.bucket !== "closed");
  const bucketAmount = (bucket, kind) =>
    items
      .filter((item) => item.bucket === bucket && (!kind || item.kind === kind))
      .reduce((sum, item) => sum + item.balance, 0);

  const priorityItems = openItems
    .filter((item) => ["overdue", "due_soon", "no_due_date"].includes(item.bucket) || !item.hasInvoice)
    .sort((first, second) => {
      const bucketRank = { overdue: 0, due_soon: 1, no_due_date: 2, due_later: 3, future: 4 };
      return (bucketRank[first.bucket] ?? 9) - (bucketRank[second.bucket] ?? 9) ||
        (first.dueInDays ?? 9999) - (second.dueInDays ?? 9999) ||
        second.balance - first.balance;
    });

  return {
    items,
    openItems,
    priorityItems,
    overdueAmount: bucketAmount("overdue"),
    dueSoonAmount: bucketAmount("due_soon"),
    noDueDateCount: openItems.filter((item) => item.bucket === "no_due_date").length,
    missingInvoiceCount: openItems.filter((item) => !item.hasInvoice).length,
    receivableOverdueAmount: bucketAmount("overdue", "receivable"),
    payableDueSoonAmount: bucketAmount("due_soon", "payable"),
  };
}

function buildCashRiskScore(aging, summary) {
  let score = 100;
  const reasons = [];

  if (aging.receivableOverdueAmount > 0) {
    score -= 30;
    reasons.push(`逾期应收 $${aging.receivableOverdueAmount.toFixed(0)}`);
  }

  if (aging.payableDueSoonAmount > 0) {
    score -= 16;
    reasons.push(`3天内应付 $${aging.payableDueSoonAmount.toFixed(0)}`);
  }

  if (aging.missingInvoiceCount > 0) {
    score -= Math.min(aging.missingInvoiceCount * 8, 24);
    reasons.push(`${aging.missingInvoiceCount} 项缺票据`);
  }

  if (aging.noDueDateCount > 0) {
    score -= Math.min(aging.noDueDateCount * 6, 18);
    reasons.push(`${aging.noDueDateCount} 项无到期日`);
  }

  if (summary?.profitRiskCount > 0) {
    score -= 18;
    reasons.push("存在毛利风险");
  }

  const normalizedScore = Math.max(score, 0);
  const grade = normalizedScore >= 85 ? "A" : normalizedScore >= 70 ? "B" : normalizedScore >= 55 ? "C" : "D";
  const tone = grade === "A" ? "emerald" : grade === "B" ? "sky" : grade === "C" ? "amber" : "rose";

  return {
    score: normalizedScore,
    grade,
    tone,
    reasons: reasons.length ? reasons.slice(0, 4) : ["现金流、票据和账期风险可控"],
  };
}

function buildSettlementReadiness(aging, summary) {
  const openItems = aging.openItems || [];
  const openCount = openItems.length;
  const percentage = (count) => (openCount ? Math.round((count / openCount) * 100) : 100);
  const invoiceReady = percentage(openItems.filter((item) => item.hasInvoice).length);
  const dueDateReady = percentage(openItems.filter((item) => Boolean(item.dueDate)).length);
  const overdueCount = openItems.filter((item) => item.bucket === "overdue").length;
  const dueSoonCount = openItems.filter((item) => item.bucket === "due_soon").length;
  const timingReady = Math.max(100 - overdueCount * 25 - dueSoonCount * 10 - aging.noDueDateCount * 8, 0);
  const marginReady = summary?.profitRiskCount > 0 ? 55 : 100;
  const score = Math.round((invoiceReady * 0.3) + (dueDateReady * 0.25) + (timingReady * 0.25) + (marginReady * 0.2));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const priority = aging.receivableOverdueAmount > 0 || grade === "D" ? "P1" : grade === "C" || aging.missingInvoiceCount > 0 || aging.noDueDateCount > 0 ? "P2" : "P3";
  const risks = [];

  if (aging.receivableOverdueAmount > 0) risks.push("逾期应收需催收");
  if (aging.missingInvoiceCount > 0) risks.push("票据/账单缺失");
  if (aging.noDueDateCount > 0) risks.push("账期到期日缺失");
  if (summary?.profitRiskCount > 0) risks.push("毛利风险待复核");
  if (aging.payableDueSoonAmount > 0) risks.push("供应商应付临期");

  let nextAction = "可以按正常节奏推进收付款登记、对账导出和月底核销。";
  if (priority === "P1") {
    nextAction = "先处理逾期应收、缺票据和毛利风险，再推进付款或核销，避免现金流和利润同时失真。";
  } else if (priority === "P2") {
    nextAction = "本周补齐发票/账单、到期日和毛利复核，再导出对账单给客户或供应商确认。";
  }

  return {
    score,
    grade,
    priority,
    metrics: [
      { label: "票据准备", value: invoiceReady },
      { label: "账期准备", value: dueDateReady },
      { label: "时效压力", value: timingReady },
      { label: "毛利确认", value: marginReady },
    ],
    risks: risks.length ? risks : ["对账、开票和核销准备度良好"],
    nextAction,
  };
}

function hasTaxReference(row) {
  if (!row) return false;
  if (row.tax_rate === "" || row.tax_rate === null || row.tax_rate === undefined) return false;
  return Number.isFinite(Number(row.tax_rate));
}

function isTaxMathConsistent(row) {
  const amount = Number(row?.amount ?? row?.amount_due ?? 0);
  const taxAmount = Number(row?.tax_amount ?? 0);
  const amountExTax = Number(row?.amount_ex_tax ?? amount - taxAmount);
  if (!Number.isFinite(amount) || !Number.isFinite(taxAmount) || !Number.isFinite(amountExTax)) return false;
  return Math.abs(amount - taxAmount - amountExTax) <= 0.05;
}

function buildInvoiceTaxReconciliationControl({ aging, orderCosts }) {
  const financeItems = aging.items || [];
  const openItems = aging.openItems || [];
  const orderCostRows = orderCosts || [];
  const percentage = (ready, total) => (total ? Math.round((ready / total) * 100) : 100);
  const invoiceReady = percentage(financeItems.filter((item) => item.hasInvoice || item.bucket === "closed").length, financeItems.length);
  const costsWithTax = orderCostRows.filter((row) => hasTaxReference(row));
  const taxConsistentRows = orderCostRows.filter((row) => hasTaxReference(row) && isTaxMathConsistent(row));
  const taxReady = percentage(taxConsistentRows.length, orderCostRows.length);
  const settledItems = financeItems.filter((item) => item.bucket === "closed" || item.balance <= 0);
  const reconciliationReady = percentage(settledItems.length, financeItems.length);
  const overdueCount = openItems.filter((item) => item.bucket === "overdue").length;
  const dueControl = Math.max(100 - overdueCount * 30 - aging.noDueDateCount * 12 - openItems.filter((item) => item.bucket === "due_soon").length * 8, 0);
  const score = Math.round((invoiceReady * 0.3) + (taxReady * 0.25) + (reconciliationReady * 0.25) + (dueControl * 0.2));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const missingTaxCount = orderCostRows.length - costsWithTax.length;
  const taxMismatchCount = orderCostRows.filter((row) => hasTaxReference(row) && !isTaxMathConsistent(row)).length;
  const openBalanceCount = openItems.filter((item) => item.balance > 0).length;
  const priority =
    grade === "D" || aging.receivableOverdueAmount > 0 || aging.missingInvoiceCount > 0 || taxMismatchCount > 0
      ? "P1"
      : grade === "C" || missingTaxCount > 0 || aging.noDueDateCount > 0 || openBalanceCount > 0
        ? "P2"
        : "P3";
  const risks = [];

  if (aging.missingInvoiceCount > 0) risks.push(`${aging.missingInvoiceCount} 项缺发票/账单号`);
  if (missingTaxCount > 0) risks.push(`${missingTaxCount} 条成本缺税率`);
  if (taxMismatchCount > 0) risks.push(`${taxMismatchCount} 条税额不平`);
  if (openBalanceCount > 0) risks.push(`${openBalanceCount} 项余额未核销`);
  if (aging.receivableOverdueAmount > 0) risks.push("逾期应收未核销");
  if (aging.noDueDateCount > 0) risks.push("账期到期日缺失");

  return {
    score,
    grade,
    priority,
    metrics: [
      { label: "发票/账单", value: invoiceReady },
      { label: "税率校验", value: taxReady },
      { label: "余额核销", value: reconciliationReady },
      { label: "账期控制", value: dueControl },
    ],
    risks: risks.length ? risks : ["发票、税率、余额和账期控制良好"],
  };
}

function hasFxReference(row) {
  const currency = String(row?.currency || "USD").toUpperCase();
  if (currency === "CNY") return true;
  return Boolean(row?.fx_rate || row?.exchange_rate || row?.base_currency_amount || row?.home_currency_amount);
}

function hasAdjustmentPolicy(row) {
  return Boolean(
    row?.discount_amount ||
    row?.write_off_amount ||
    row?.bad_debt_amount ||
    row?.fx_gain_loss_amount ||
    row?.adjustment_reason ||
    row?.settlement_reason,
  );
}

function buildFinancialRuleExportControl({ aging, orderCosts, receivables, payables, summary }) {
  const financeItems = aging.items || [];
  const openItems = aging.openItems || [];
  const costRows = orderCosts || [];
  const allRows = [...(receivables || []), ...(payables || []), ...costRows];
  const percentage = (ready, total) => (total ? Math.round((ready / total) * 100) : 100);
  const ruleReady = percentage(openItems.filter((item) => Boolean(item.dueDate) && item.hasInvoice).length, openItems.length);
  const fxRows = allRows.filter((row) => String(row.currency || "USD").toUpperCase() !== "CNY");
  const fxReady = percentage(fxRows.filter(hasFxReference).length, fxRows.length);
  const exportableRows = allRows.filter((row) => Number(row.amount_due || row.amount || row.balance_amount || 0) > 0);
  const externalReady = percentage(
    exportableRows.filter((row) =>
      Boolean(row.invoice_id || row.invoice_no || row.bill_no || row.statement_no) &&
      Boolean(row.order_no || row.order_id || row.description || row.fee_code) &&
      Boolean(row.currency) &&
      Boolean(row.due_date || row.occurred_at),
    ).length,
    exportableRows.length,
  );
  const staleReceivables = financeItems.filter((item) => item.kind === "receivable" && item.bucket === "overdue" && Number(item.dueInDays || 0) < -30);
  const staleReceivablesWithPolicy = staleReceivables.filter((item) => hasAdjustmentPolicy(item.row));
  const adjustmentReady = percentage(staleReceivablesWithPolicy.length, staleReceivables.length);
  const estimatedCostCount = costRows.filter((row) => row.is_estimated || row.status === "draft").length;
  const score = Math.round((ruleReady * 0.25) + (fxReady * 0.25) + (adjustmentReady * 0.2) + (externalReady * 0.3));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const priority =
    grade === "D" || staleReceivables.length > staleReceivablesWithPolicy.length || fxReady < 60
      ? "P1"
      : grade === "C" || externalReady < 80 || estimatedCostCount > 0 || summary?.profitRiskCount > 0
        ? "P2"
        : "P3";
  const risks = [];

  if (ruleReady < 100) risks.push("账期/票据规则未完整");
  if (fxReady < 100) risks.push("外币缺汇率或本位币金额");
  if (staleReceivables.length > staleReceivablesWithPolicy.length) risks.push("长期逾期未设置坏账/折扣策略");
  if (externalReady < 100) risks.push("外部系统导出字段缺失");
  if (estimatedCostCount > 0) risks.push(`${estimatedCostCount} 条成本仍为草稿/预估`);
  if (summary?.profitRiskCount > 0) risks.push("毛利风险会影响导出确认");

  return {
    score,
    grade,
    priority,
    risks: risks.length ? risks : ["规则、汇率、调整和导出字段准备良好"],
    metrics: [
      { label: "账期规则", value: ruleReady },
      { label: "汇率准备", value: fxReady },
      { label: "坏账/折扣", value: adjustmentReady },
      { label: "外部导出", value: externalReady },
    ],
  };
}

const result = buildSettlementAging({
  receivables: [
    {
      id: "ar-overdue",
      customer: "Customer A",
      order_no: "OD1",
      currency: "USD",
      balance_amount: "1000",
      due_date: "2026-06-20",
      status: "open",
      invoice_id: "inv-1",
    },
    {
      id: "ar-closed",
      customer: "Customer B",
      order_no: "OD2",
      currency: "USD",
      balance_amount: "0",
      due_date: "2026-06-01",
      status: "closed",
      invoice_id: "inv-2",
    },
  ],
  payables: [
    {
      id: "ap-due-soon",
      vendor: "Vendor A",
      description: "Main freight",
      currency: "USD",
      balance_amount: "500",
      due_date: "2026-07-02",
      status: "open",
      invoice_id: "",
    },
    {
      id: "ap-no-date",
      vendor: "Vendor B",
      description: "Customs",
      currency: "USD",
      balance_amount: "120",
      due_date: "",
      status: "open",
      invoice_id: "inv-3",
    },
  ],
});
const cashRisk = buildCashRiskScore(result, { profitRiskCount: 1 });
const settlementReadiness = buildSettlementReadiness(result, { profitRiskCount: 1 });
const cleanReadiness = buildSettlementReadiness(
  buildSettlementAging({
    receivables: [
      {
        id: "ar-clean",
        customer: "Customer C",
        order_no: "OD3",
        currency: "USD",
        balance_amount: "800",
        due_date: "2026-07-20",
        status: "open",
        invoice_no: "INV-3",
      },
    ],
    payables: [
      {
        id: "ap-clean",
        vendor: "Vendor C",
        description: "Warehouse",
        currency: "USD",
        balance_amount: "300",
        due_date: "2026-07-25",
        status: "open",
        bill_no: "BILL-1",
      },
    ],
  }),
  { profitRiskCount: 0 },
);
const cleanInvoiceTaxControl = buildInvoiceTaxReconciliationControl({
  aging: buildSettlementAging({
    receivables: [
      {
        id: "ar-settled",
        customer: "Customer D",
        order_no: "OD4",
        currency: "USD",
        balance_amount: "0",
        due_date: "2026-07-05",
        status: "closed",
        invoice_no: "INV-4",
      },
    ],
    payables: [
      {
        id: "ap-settled",
        vendor: "Vendor D",
        description: "Trucking",
        currency: "USD",
        balance_amount: "0",
        due_date: "2026-07-06",
        status: "paid",
        bill_no: "BILL-4",
      },
    ],
  }),
  orderCosts: [
    { id: "cost-clean", amount: "120", tax_rate: "0.2", tax_amount: "20", amount_ex_tax: "100" },
  ],
});
const riskyInvoiceTaxControl = buildInvoiceTaxReconciliationControl({
  aging: result,
  orderCosts: [
    { id: "cost-missing-tax", amount: "200", tax_rate: "", tax_amount: "", amount_ex_tax: "200" },
    { id: "cost-mismatch", amount: "120", tax_rate: "0.2", tax_amount: "10", amount_ex_tax: "100" },
  ],
});
const openBalanceInvoiceTaxControl = buildInvoiceTaxReconciliationControl({
  aging: buildSettlementAging({
    receivables: [
      {
        id: "ar-open",
        customer: "Customer E",
        order_no: "OD5",
        currency: "USD",
        balance_amount: "400",
        due_date: "2026-07-20",
        status: "open",
        invoice_no: "INV-5",
      },
    ],
    payables: [],
  }),
  orderCosts: [
    { id: "cost-ok", amount: "108", tax_rate: "0.08", tax_amount: "8", amount_ex_tax: "100" },
  ],
});
const riskyFinancialRuleExportControl = buildFinancialRuleExportControl({
  aging: buildSettlementAging({
    receivables: [
      {
        id: "ar-long-overdue",
        customer: "Customer F",
        order_no: "OD6",
        currency: "USD",
        balance_amount: "900",
        due_date: "2026-05-20",
        status: "open",
        invoice_no: "INV-6",
      },
    ],
    payables: [
      {
        id: "ap-no-invoice",
        vendor: "Vendor F",
        description: "Delivery",
        currency: "USD",
        balance_amount: "300",
        due_date: "2026-07-03",
        status: "open",
        bill_no: "",
      },
    ],
  }),
  receivables: [
    { id: "ar-long-overdue", order_no: "OD6", currency: "USD", amount_due: "900", due_date: "2026-05-20", invoice_no: "INV-6" },
  ],
  payables: [
    { id: "ap-no-invoice", description: "Delivery", currency: "USD", amount: "300", due_date: "2026-07-03", bill_no: "" },
  ],
  orderCosts: [
    { id: "cost-draft", description: "Delivery", fee_code: "delivery", currency: "USD", amount: "300", occurred_at: "2026-07-01", status: "draft", is_estimated: true },
  ],
  summary: { profitRiskCount: 1 },
});
const adjustedFinancialRuleExportControl = buildFinancialRuleExportControl({
  aging: buildSettlementAging({
    receivables: [
      {
        id: "ar-adjusted",
        customer: "Customer G",
        order_no: "OD7",
        currency: "USD",
        balance_amount: "700",
        due_date: "2026-05-15",
        status: "open",
        invoice_no: "INV-7",
        bad_debt_amount: "100",
        adjustment_reason: "partial write-off approved",
      },
    ],
    payables: [],
  }),
  receivables: [
    { id: "ar-adjusted", order_no: "OD7", currency: "USD", amount_due: "700", due_date: "2026-05-15", invoice_no: "INV-7", fx_rate: "7.1", bad_debt_amount: "100", adjustment_reason: "partial write-off approved" },
  ],
  payables: [],
  orderCosts: [],
  summary: { profitRiskCount: 0 },
});
const cleanFinancialRuleExportControl = buildFinancialRuleExportControl({
  aging: buildSettlementAging({
    receivables: [
      {
        id: "ar-export-clean",
        customer: "Customer H",
        order_no: "OD8",
        currency: "USD",
        balance_amount: "600",
        due_date: "2026-07-20",
        status: "open",
        invoice_no: "INV-8",
      },
    ],
    payables: [
      {
        id: "ap-export-clean",
        vendor: "Vendor H",
        description: "Warehouse",
        currency: "EUR",
        balance_amount: "240",
        due_date: "2026-07-22",
        status: "open",
        bill_no: "BILL-8",
      },
    ],
  }),
  receivables: [
    { id: "ar-export-clean", order_no: "OD8", currency: "USD", amount_due: "600", due_date: "2026-07-20", invoice_no: "INV-8", fx_rate: "7.1" },
  ],
  payables: [
    { id: "ap-export-clean", description: "Warehouse", currency: "EUR", amount: "240", due_date: "2026-07-22", bill_no: "BILL-8", fx_rate: "7.7" },
  ],
  orderCosts: [
    { id: "cost-export-clean", description: "Warehouse", fee_code: "warehouse", currency: "CNY", amount: "1800", occurred_at: "2026-07-01", bill_no: "COST-8", status: "approved" },
  ],
  summary: { profitRiskCount: 0 },
});

const checks = [
  ["overdue amount", result.overdueAmount === 1000],
  ["due soon amount", result.dueSoonAmount === 500],
  ["no due date count", result.noDueDateCount === 1],
  ["missing invoice count", result.missingInvoiceCount === 1],
  ["closed rows excluded from open items", result.openItems.every((item) => item.id !== "ar-closed")],
  ["priority starts with overdue receivable", result.priorityItems[0]?.id === "ar-overdue"],
  ["cash risk score includes overdue due soon invoice due date and profit risk", cashRisk.score === 22 && cashRisk.grade === "D"],
  ["cash risk reasons explain top drivers", cashRisk.reasons.includes("逾期应收 $1000") && cashRisk.reasons.includes("1 项缺票据")],
  ["settlement readiness captures invoice due date timing and margin risk", settlementReadiness.score === 62 && settlementReadiness.grade === "C" && settlementReadiness.priority === "P1"],
  ["settlement readiness explains blocking risks", settlementReadiness.risks.includes("逾期应收需催收") && settlementReadiness.risks.includes("票据/账单缺失")],
  ["clean settlement readiness stays grade A", cleanReadiness.score === 100 && cleanReadiness.grade === "A" && cleanReadiness.priority === "P3"],
  ["clean invoice tax reconciliation control stays grade A", cleanInvoiceTaxControl.score === 100 && cleanInvoiceTaxControl.grade === "A" && cleanInvoiceTaxControl.priority === "P3"],
  ["invoice tax reconciliation catches missing invoice and tax mismatch", riskyInvoiceTaxControl.score === 39 && riskyInvoiceTaxControl.grade === "D" && riskyInvoiceTaxControl.priority === "P1" && riskyInvoiceTaxControl.risks.includes("1 条税额不平")],
  ["open balance reconciliation becomes P2 even with valid invoice and tax", openBalanceInvoiceTaxControl.score === 75 && openBalanceInvoiceTaxControl.grade === "B" && openBalanceInvoiceTaxControl.priority === "P2" && openBalanceInvoiceTaxControl.risks.includes("1 项余额未核销")],
  ["financial rule export catches fx writeoff and export blockers", riskyFinancialRuleExportControl.score === 22 && riskyFinancialRuleExportControl.grade === "D" && riskyFinancialRuleExportControl.priority === "P1" && riskyFinancialRuleExportControl.risks.includes("长期逾期未设置坏账/折扣策略")],
  ["financial rule export recognizes bad debt policy", adjustedFinancialRuleExportControl.metrics.find((metric) => metric.label === "坏账/折扣")?.value === 100 && !adjustedFinancialRuleExportControl.risks.includes("长期逾期未设置坏账/折扣策略")],
  ["clean financial rule export stays grade A", cleanFinancialRuleExportControl.score === 100 && cleanFinancialRuleExportControl.grade === "A" && cleanFinancialRuleExportControl.priority === "P3"],
];

let failures = 0;
for (const [name, passed] of checks) {
  if (passed) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}`);
  }
}

if (failures > 0) {
  console.error(`\nFinance aging check: ${failures} failed, ${checks.length} total.`);
  process.exit(1);
}

console.log(`\nFinance aging check: 0 failed, ${checks.length} total.`);
