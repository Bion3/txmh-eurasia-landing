import { useEffect, useMemo, useState } from "react";
import {
  useCreateOrderCost,
  useOrderCosts,
  usePayables,
  useReceivables,
  useRecordPayablePayment,
  useRecordReceivablePayment,
} from "../../hooks/useFinance";
import { useVendorList } from "../../hooks/useCostCenter";

function SummaryTile({ label, value, hint, tone = "slate" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="mt-2 text-sm opacity-80">{hint}</div>
    </div>
  );
}

function isLocalRow(row) {
  return String(row?.id || "").startsWith("local-");
}

function financeErrorMessage(error) {
  const message = error?.message || "";
  if (message.includes("payment_exceeds")) return "付款金额超过当前余额，系统已阻止登记。";
  if (message.includes("duplicate_payment_reference")) return "相同流水号已经登记过，系统已阻止重复付款。";
  if (message.includes("already_closed")) return "该应收/应付已关闭，不能继续登记。";
  if (message.includes("insufficient_finance_role")) return "当前账号没有财务收付款权限。";
  if (message.includes("currency_mismatch")) return "付款币种与单据币种不一致。";
  return message || "数据库未写入，请确认登录账号具备财务权限。";
}

function csvValue(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers.map(csvValue).join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
  ].join("\n");
}

function downloadCsv(filename, rows) {
  const csv = toCsv(rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildPaymentDraft(kind, row, financeDraft) {
  const balance = Number(row?.balance_amount || row?.amount_due || row?.amount || 0);
  const referencePrefix = kind === "receivable" ? "RCV" : "PAY";
  const referenceTarget = row?.order_no || financeDraft?.order_no || row?.id || "ORDER";

  return {
    kind,
    rowId: row?.id,
    amount: balance > 0 ? String(balance) : "",
    currency: row?.currency || "USD",
    payment_date: todayDate(),
    payment_method: "bank_transfer",
    reference_no: `${referencePrefix}-${referenceTarget}-${Date.now().toString().slice(-6)}`,
    fx_rate: "",
    base_currency_amount: "",
    allow_overpayment: false,
  };
}

function buildCostDraft(financeDraft, vendors = []) {
  const firstVendor = vendors[0];
  return {
    vendor_id: firstVendor?.id || "",
    fee_code: "manual_cost",
    cost_category: "Main Freight",
    description: `${financeDraft?.origin || "Origin"} to ${financeDraft?.destination || "Destination"} supplier cost`,
    currency: financeDraft?.currency || "USD",
    amount: "",
    tax_rate: "0",
    is_estimated: false,
    status: "draft",
    occurred_at: todayDate(),
  };
}

const paymentMethodOptions = [
  { value: "bank_transfer", label: "银行转账" },
  { value: "cash", label: "现金" },
  { value: "card", label: "银行卡" },
  { value: "online", label: "线上支付" },
  { value: "offset", label: "往来抵扣" },
];

const costCategoryOptions = [
  "Main Freight",
  "Customs",
  "Warehouse",
  "Trucking",
  "Documentation",
  "Insurance",
  "Other",
];

const costStatusOptions = [
  { value: "draft", label: "草稿" },
  { value: "confirmed", label: "已确认" },
  { value: "approved", label: "已审批" },
];

function parseDateMs(value) {
  if (!value || value === "-") return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function daysUntil(value) {
  const timestamp = parseDateMs(value);
  if (!timestamp) return null;
  const today = new Date(todayDate()).getTime();
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

function actionPriorityClass(priority) {
  if (priority === "P1") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "P2") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getReceivableSettlementAction(row) {
  const balance = financeAmount(row, "balance_amount", "amount_due");
  if (balance <= 0 || row?.status === "closed") return null;

  const dueDate = row.due_date || row.occurred_at;
  const dueInDays = daysUntil(dueDate);
  if (dueInDays !== null && dueInDays < 0) {
    return {
      priority: "P1",
      queue: "overdue_receivable",
      label: "逾期催收",
      nextAction: "今天联系客户确认付款时间，登记流水号或升级销售负责人跟进。",
    };
  }
  if (dueInDays !== null && dueInDays <= 3) {
    return {
      priority: "P1",
      queue: "due_receivable",
      label: "到期收款",
      nextAction: "发送到期提醒并准备收款登记，避免账期拖延。",
    };
  }
  return {
    priority: "P3",
    queue: "open_receivable",
    label: "待收跟踪",
    nextAction: "保留在本周收款清单，账期前 3 天再升级提醒。",
  };
}

function getPayableSettlementAction(row) {
  const balance = financeAmount(row, "balance_amount", "amount", "amount_due");
  if (balance <= 0 || row?.status === "closed") return null;

  const dueInDays = daysUntil(row.occurred_at || row.due_date);
  if (dueInDays !== null && dueInDays <= 3) {
    return {
      priority: "P2",
      queue: "due_payable",
      label: "安排付款",
      nextAction: "核对供应商账单、发票和付款账户，确认后登记付款。",
    };
  }
  return {
    priority: "P3",
    queue: "open_payable",
    label: "应付排期",
    nextAction: "保留在应付计划，付款前先完成供应商对账。",
  };
}

function getCostSettlementAction(row) {
  if (row?.is_estimated) {
    return {
      priority: "P1",
      queue: "estimated_cost",
      label: "确认预估成本",
      nextAction: "向操作或供应商确认最终成本，避免毛利被预估数误导。",
    };
  }
  if (!row?.vendor_id && row?.data_source === "database") {
    return {
      priority: "P2",
      queue: "missing_vendor",
      label: "关联供应商",
      nextAction: "补充供应商后再进入应付生成和对账流程。",
    };
  }
  if (row?.status === "draft") {
    return {
      priority: "P2",
      queue: "draft_cost",
      label: "审批成本",
      nextAction: "复核费项、金额和税率，确认后再用于正式毛利。",
    };
  }
  return null;
}

function financeActionRank(row) {
  const priorityRank = { P1: 0, P2: 1, P3: 2 };
  const queueRank = {
    negative_profit: 0,
    low_margin: 1,
    overdue_receivable: 2,
    due_receivable: 3,
    estimated_cost: 4,
    due_payable: 5,
  };
  return (priorityRank[row.priority] ?? 9) * 100 + (queueRank[row.queue] ?? 50);
}

function buildFinanceActionPlan(rows, summary, financeDraft) {
  const lines = [
    `财务结算行动清单 ${todayDate()}`,
    `订单：${financeDraft?.order_no || "当前财务包"}｜客户：${financeDraft?.customer || "客户"}`,
    `未收应收：$${summary.receivableOpen.toFixed(0)}｜未付应付：$${summary.payableOpen.toFixed(0)}｜预估成本：${summary.estimatedCostCount}｜毛利风险：${summary.profitRiskCount}`,
    "",
  ];

  if (!rows.length) {
    lines.push("暂无高优先级财务动作：继续保持收付款登记和成本确认节奏。");
  } else {
    rows.slice(0, 8).forEach((row, index) => {
      lines.push(
        `${index + 1}. [${row.priority}] ${row.label}｜${row.target}｜金额 ${row.currency} ${row.amount.toFixed(2)}｜${row.timing}｜下一步：${row.nextAction}`,
      );
    });
  }

  lines.push("");
  lines.push("执行建议：先处理逾期/到期应收和预估成本，再安排到期应付；低毛利或负毛利订单当天同步销售、操作和负责人。");
  return lines.join("\n");
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

function cashRiskClass(tone) {
  if (tone === "emerald") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (tone === "sky") return "border-sky-300/20 bg-sky-300/10 text-sky-100";
  if (tone === "amber") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  return "border-rose-300/20 bg-rose-300/10 text-rose-100";
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
      { label: "票据准备", value: invoiceReady, hint: `${openItems.filter((item) => item.hasInvoice).length}/${openCount} 已关联` },
      { label: "账期准备", value: dueDateReady, hint: `${openItems.filter((item) => Boolean(item.dueDate)).length}/${openCount} 有到期日` },
      { label: "时效压力", value: timingReady, hint: `逾期 ${overdueCount} · 临期 ${dueSoonCount}` },
      { label: "毛利确认", value: marginReady, hint: summary?.profitRiskCount > 0 ? `${summary.profitRiskCount} 项毛利风险` : "毛利风险可控" },
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

  let nextAction = "发票、税率和余额核销状态稳定，可以按月末流程导出对账包。";
  if (priority === "P1") {
    nextAction = "先补发票/账单号、修正税额不平和逾期应收，再做月末核销或外部系统导出。";
  } else if (priority === "P2") {
    nextAction = "本周补齐成本税率、到期日和未核销余额，再安排客户/供应商对账确认。";
  }

  return {
    score,
    grade,
    priority,
    metrics: [
      { label: "发票/账单", value: invoiceReady, hint: `${financeItems.filter((item) => item.hasInvoice || item.bucket === "closed").length}/${financeItems.length || 0} 已关联` },
      { label: "税率校验", value: taxReady, hint: `${taxConsistentRows.length}/${orderCostRows.length || 0} 成本税额平衡` },
      { label: "余额核销", value: reconciliationReady, hint: `${settledItems.length}/${financeItems.length || 0} 已结清` },
      { label: "账期控制", value: dueControl, hint: `逾期 ${overdueCount} · 无到期 ${aging.noDueDateCount}` },
    ],
    risks: risks.length ? risks : ["发票、税率、余额和账期控制良好"],
    nextAction,
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

  let nextAction = "财务规则、汇率、调整策略和导出字段稳定，可以导出外部系统对账包。";
  if (priority === "P1") {
    nextAction = "先补齐长期逾期处理策略、外币汇率/本位币金额和关键导出字段，再导出 ERP 或月末包。";
  } else if (priority === "P2") {
    nextAction = "本周补齐草稿成本、缺票据字段和毛利复核，再安排外部系统导出。";
  }

  return {
    score,
    grade,
    priority,
    metrics: [
      { label: "账期规则", value: ruleReady, hint: `${openItems.filter((item) => Boolean(item.dueDate) && item.hasInvoice).length}/${openItems.length || 0} 规则完整` },
      { label: "汇率准备", value: fxReady, hint: `${fxRows.filter(hasFxReference).length}/${fxRows.length || 0} 外币有汇率` },
      { label: "坏账/折扣", value: adjustmentReady, hint: `${staleReceivablesWithPolicy.length}/${staleReceivables.length || 0} 长逾期有策略` },
      { label: "外部导出", value: externalReady, hint: `${exportableRows.length ? Math.round((externalReady / 100) * exportableRows.length) : 0}/${exportableRows.length || 0} 字段完整` },
    ],
    risks: risks.length ? risks : ["规则、汇率、调整和导出字段准备良好"],
    nextAction,
  };
}

function buildFinancialRuleExportPlan(control, financeDraft) {
  if (!control) return "";

  return [
    `财务规则/外部导出清单 ${todayDate()}`,
    `订单：${financeDraft?.order_no || "当前财务包"}｜客户：${financeDraft?.customer || "客户"}｜${control.priority}｜${control.score}/${control.grade}`,
    "",
    "指标：",
    ...control.metrics.map((metric) => `- ${metric.label}: ${metric.value}/100｜${metric.hint}`),
    "",
    "风险：",
    ...control.risks.map((risk) => `- ${risk}`),
    "",
    `下一步：${control.nextAction}`,
  ].join("\n");
}

function PaymentForm({ draft, row, onChange, onSubmit, onCancel, isPending }) {
  if (!draft || !row) return null;

  const isReceivable = draft.kind === "receivable";
  const balance = Number(row.balance_amount || row.amount_due || row.amount || 0);
  const partyName = isReceivable ? row.customer || "客户" : row.vendor || "供应商";
  const targetName = isReceivable ? row.order_no || "订单" : row.cost_category || row.description || "成本项";
  const accentClass = isReceivable
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <form
      className={`mb-5 rounded-3xl border p-5 ${accentClass}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(row, draft);
      }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
            {isReceivable ? "收款登记" : "付款登记"}
          </div>
          <h4 className="mt-2 text-lg font-bold text-slate-950">
            {partyName} · {targetName}
          </h4>
          <p className="mt-1 text-sm opacity-80">
            当前余额 {draft.currency || row.currency || "USD"} {balance.toFixed(2)}，提交后由数据库事务校验余额、币种和流水号。
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-2xl border border-white/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          取消
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">
          金额
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.amount}
            onChange={(event) => onChange("amount", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          币种
          <input
            type="text"
            value={draft.currency}
            onChange={(event) => onChange("currency", event.target.value.toUpperCase())}
            className="mt-2 w-full rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          日期
          <input
            type="date"
            value={draft.payment_date}
            onChange={(event) => onChange("payment_date", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          方式
          <select
            value={draft.payment_method}
            onChange={(event) => onChange("payment_method", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            {paymentMethodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
          银行/平台流水号
          <input
            type="text"
            value={draft.reference_no}
            onChange={(event) => onChange("reference_no", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          汇率
          <input
            type="number"
            min="0"
            step="0.0001"
            value={draft.fx_rate}
            onChange={(event) => onChange("fx_rate", event.target.value)}
            placeholder="选填"
            className="mt-2 w-full rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          本位币金额
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.base_currency_amount}
            onChange={(event) => onChange("base_currency_amount", event.target.value)}
            placeholder="选填"
            className="mt-2 w-full rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={draft.allow_overpayment}
            onChange={(event) => onChange("allow_overpayment", event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          允许超额登记
        </label>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          暂不登记
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "提交中..." : isReceivable ? "确认收款" : "确认付款"}
        </button>
      </div>
    </form>
  );
}

function CostForm({ draft, vendors, onChange, onSubmit, onCancel, isPending, hasRealOrder }) {
  if (!draft) return null;

  return (
    <form
      className="mb-5 rounded-3xl border border-slate-200 bg-slate-50 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">成本录入</div>
          <h4 className="mt-2 text-lg font-bold text-slate-950">新增供应商成本明细</h4>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            保存到 `order_costs` 后可用于毛利核算；选择真实供应商后，后续才能汇总生成应付账款。
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          取消
        </button>
      </div>

      {!hasRealOrder ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          当前订单还未真实入库，保存后只会进入本地草稿，避免把演示成本伪装成数据库记录。
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">
          供应商
          <select
            value={draft.vendor_id}
            onChange={(event) => onChange("vendor_id", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            <option value="">暂不关联供应商</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.vendor_name || vendor.name || vendor.id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          费用类别
          <select
            value={draft.cost_category}
            onChange={(event) => onChange("cost_category", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            {costCategoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          费项代码
          <input
            type="text"
            value={draft.fee_code}
            onChange={(event) => onChange("fee_code", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
          费用说明
          <input
            type="text"
            value={draft.description}
            onChange={(event) => onChange("description", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          发生日期
          <input
            type="date"
            value={draft.occurred_at}
            onChange={(event) => onChange("occurred_at", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          币种
          <input
            type="text"
            value={draft.currency}
            onChange={(event) => onChange("currency", event.target.value.toUpperCase())}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          含税金额
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.amount}
            onChange={(event) => onChange("amount", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          税率 %
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.tax_rate}
            onChange={(event) => onChange("tax_rate", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          状态
          <select
            value={draft.status}
            onChange={(event) => onChange("status", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            {costStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={draft.is_estimated}
            onChange={(event) => onChange("is_estimated", event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          预估成本
        </label>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          暂不保存
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "保存中..." : "保存成本"}
        </button>
      </div>
    </form>
  );
}

export default function FinanceWorkspace({ financeDraft, onBackToOrders, onNotify }) {
  const [activeTab, setActiveTab] = useState(financeDraft?.focus === "costs" ? "costs" : "receivables");
  const [localReceivableState, setLocalReceivableState] = useState({});
  const [localPayableState, setLocalPayableState] = useState({});
  const [localOrderCostRows, setLocalOrderCostRows] = useState([]);
  const [paymentDraft, setPaymentDraft] = useState(null);
  const [costDraft, setCostDraft] = useState(null);
  const [financeActionPlanText, setFinanceActionPlanText] = useState("");
  const [financialRuleExportPlanText, setFinancialRuleExportPlanText] = useState("");
  const { data: vendorData } = useVendorList({ page_size: 100, status: "active" });
  const vendors = vendorData?.items || [];
  const vendorNameById = useMemo(
    () => Object.fromEntries(vendors.map((vendor) => [vendor.id, vendor.vendor_name || vendor.name || vendor.id])),
    [vendors]
  );
  const { data: liveOrderCosts, isError: orderCostError } = useOrderCosts(
    financeDraft?.order_id ? { order_id: financeDraft.order_id, page_size: 100 } : undefined
  );
  const { data: liveReceivables, isError: receivableError } = useReceivables(
    financeDraft?.customer_id ? { customer_id: financeDraft.customer_id } : undefined
  );
  const { data: livePayables, isError: payableError } = usePayables(
    financeDraft?.order_id ? { order_id: financeDraft.order_id } : undefined
  );
  const createOrderCostMutation = useCreateOrderCost();
  const recordReceivableMutation = useRecordReceivablePayment(liveReceivables?.items?.[0]?.id);
  const recordPayableMutation = useRecordPayablePayment(livePayables?.items?.[0]?.id);

  useEffect(() => {
    setActiveTab(financeDraft?.focus === "costs" ? "costs" : "receivables");
  }, [financeDraft?.focus, financeDraft?.order_id, financeDraft?.receivable_id]);

  useEffect(() => {
    if (liveOrderCosts?.items?.length) {
      setLocalOrderCostRows([]);
    }
  }, [liveOrderCosts?.items?.length]);

  const orderCostRows = useMemo(
    () => {
      if (liveOrderCosts?.items?.length) {
        return liveOrderCosts.items.map((item) => ({
          id: item.id,
          data_source: "database",
          row_type: "order_cost",
          vendor_id: item.vendor_id || "",
          vendor: vendorNameById[item.vendor_id] || item.vendor_id || "未关联供应商",
          cost_category: item.cost_category || "Cost",
          fee_code: item.fee_code,
          description: item.description || item.fee_code,
          currency: item.currency || "USD",
          amount: String(item.amount || 0),
          tax_rate: String(item.tax_rate || 0),
          tax_amount: String(item.tax_amount || 0),
          amount_ex_tax: String(item.amount_ex_tax || item.amount || 0),
          is_estimated: item.is_estimated === true,
          status: item.status || "draft",
          occurred_at: item.occurred_at ? String(item.occurred_at).slice(0, 10) : "-",
        }));
      }

      return financeDraft?.costRows || [
        {
          id: "local-cost-main",
          data_source: "local_draft",
          row_type: "order_cost",
          vendor_id: "",
          cost_category: "Main Freight",
          description: "Initial supplier estimate imported from quote",
          vendor: "TX Rail Partner",
          fee_code: "main_freight",
          currency: "USD",
          amount: String(financeDraft?.payableOpen || 0),
          tax_rate: "0",
          tax_amount: "0",
          amount_ex_tax: String(financeDraft?.payableOpen || 0),
          is_estimated: true,
          status: "draft",
          occurred_at: "2026-06-03",
        },
        {
          id: "local-cost-customs",
          data_source: "local_draft",
          row_type: "order_cost",
          vendor_id: "",
          cost_category: "Customs",
          description: "Destination customs handling estimate",
          vendor: "EU Broker Desk",
          fee_code: "customs",
          currency: "USD",
          amount: "55",
          tax_rate: "0",
          tax_amount: "0",
          amount_ex_tax: "55",
          is_estimated: true,
          status: "draft",
          occurred_at: "2026-06-18",
        },
      ];
    },
    [financeDraft, liveOrderCosts, vendorNameById]
  );

  const payableRows = useMemo(
    () => {
      if (livePayables?.items?.length) {
        return livePayables.items.map((item) => ({
          id: item.id,
          data_source: "database",
          row_type: "payable",
          cost_category: "Supplier Payable",
          description: `Linked payable ${item.invoice_id || item.id}`,
          vendor_id: item.vendor_id || "",
          vendor: item.vendor_name || vendorNameById[item.vendor_id] || item.vendor_id || "Vendor",
          currency: item.currency || "USD",
          amount: String(item.amount_due || 0),
          amount_paid: String(item.amount_paid || 0),
          balance_amount: String(item.balance_amount || 0),
          status: item.status || "open",
          invoice_id: item.invoice_id || "",
          due_date: item.due_date || "-",
          occurred_at: item.due_date || "-",
        }));
      }

      return financeDraft?.payableRows || [
        {
          id: "local-payable-main",
          data_source: "local_draft",
          row_type: "payable",
          cost_category: "Supplier Payable",
          description: "Payable preview based on current cost lines",
          vendor_id: "",
          vendor: "待生成供应商应付",
          currency: "USD",
          amount: String(financeDraft?.payableOpen || 0),
          amount_paid: "0",
          balance_amount: String(financeDraft?.payableOpen || 0),
          status: "draft",
          invoice_id: financeDraft?.payable_invoice_id || "",
          due_date: financeDraft?.payableDueDate || "2026-06-18",
          occurred_at: financeDraft?.payableDueDate || "2026-06-18",
        },
      ];
    },
    [financeDraft, livePayables, vendorNameById]
  );

  const receivableRows = useMemo(
    () => {
      if (liveReceivables?.items?.length) {
        return liveReceivables.items.map((item) => ({
          id: item.id,
          data_source: "database",
          customer: financeDraft?.customer || item.customer_id || "客户",
          order_no: financeDraft?.order_no || item.order_id || "订单",
          currency: item.currency || "USD",
          amount_due: String(item.amount_due || 0),
          amount_received: String(item.amount_received || 0),
          balance_amount: String(item.balance_amount || 0),
          status: item.status || "open",
          invoice_id: item.invoice_id || "",
          due_date: item.due_date || item.invoice_date || "-",
        }));
      }

      return financeDraft?.receivableRows || [
        {
          id: "local-receivable-main",
          data_source: "local_draft",
          customer: financeDraft?.customer || "客户",
          order_no: financeDraft?.order_no || "OD202605270001",
          currency: "USD",
          amount_due: String(financeDraft?.receivableOpen || 0),
          amount_received: "0",
          balance_amount: String(financeDraft?.receivableOpen || 0),
          status: "open",
          invoice_id: financeDraft?.receivable_invoice_id || financeDraft?.invoice_id || "",
          due_date: financeDraft?.receivableDueDate || financeDraft?.due_date || todayDate(),
        },
      ];
    },
    [financeDraft, liveReceivables]
  );

  const displayedReceivableRows = useMemo(
    () =>
      receivableRows.map((item) => ({
        ...item,
        ...(localReceivableState[item.id] || {}),
      })),
    [localReceivableState, receivableRows]
  );

  const displayedOrderCostRows = useMemo(
    () =>
      [...orderCostRows, ...localOrderCostRows].map((item) => ({
        ...item,
      })),
    [localOrderCostRows, orderCostRows]
  );

  const displayedPayableRows = useMemo(
    () =>
      payableRows.map((item) => ({
        ...item,
        ...(localPayableState[item.id] || {}),
      })),
    [localPayableState, payableRows]
  );
  const settlementAging = useMemo(
    () => buildSettlementAging({ receivables: displayedReceivableRows, payables: displayedPayableRows }),
    [displayedPayableRows, displayedReceivableRows],
  );

  const totals = useMemo(() => {
    const quotedRevenue = displayedReceivableRows.reduce((sum, item) => sum + Number(item.balance_amount ?? item.amount_due ?? 0), 0);
    const costBasisRows = displayedOrderCostRows.length ? displayedOrderCostRows : displayedPayableRows;
    const quotedCost = costBasisRows.reduce((sum, item) => sum + Number(item.amount ?? item.amount_due ?? item.balance_amount ?? 0), 0);
    return {
      quotedRevenue,
      quotedCost,
      projectedProfit: quotedRevenue - quotedCost,
    };
  }, [displayedOrderCostRows, displayedPayableRows, displayedReceivableRows]);

  const financeCommandRows = useMemo(() => {
    const receivableActions = displayedReceivableRows
      .map((row) => {
        const action = getReceivableSettlementAction(row);
        if (!action) return null;
        return {
          ...action,
          id: row.id,
          kind: "receivable",
          target: `${row.customer || "客户"} · ${row.order_no || financeDraft?.order_no || "订单"}`,
          currency: row.currency || "USD",
          amount: financeAmount(row, "balance_amount", "amount_due"),
          timing: financeDueLabel(row.due_date || row.occurred_at),
          row,
        };
      })
      .filter(Boolean);

    const payableActions = displayedPayableRows
      .map((row) => {
        const action = getPayableSettlementAction(row);
        if (!action) return null;
        return {
          ...action,
          id: row.id,
          kind: "payable",
          target: row.vendor || row.description || "供应商",
          currency: row.currency || "USD",
          amount: financeAmount(row, "balance_amount", "amount", "amount_due"),
          timing: financeDueLabel(row.occurred_at || row.due_date),
          row,
        };
      })
      .filter(Boolean);

    const costActions = displayedOrderCostRows
      .map((row) => {
        const action = getCostSettlementAction(row);
        if (!action) return null;
        return {
          ...action,
          id: row.id,
          kind: "cost",
          target: `${row.cost_category || "成本"} · ${row.description || row.fee_code || "费用项"}`,
          currency: row.currency || "USD",
          amount: financeAmount(row, "amount", "amount_ex_tax"),
          timing: row.occurred_at && row.occurred_at !== "-" ? `发生日 ${row.occurred_at}` : "待补日期",
          row,
        };
      })
      .filter(Boolean);

    const profitMargin = totals.quotedRevenue > 0 ? totals.projectedProfit / totals.quotedRevenue : 0;
    const profitAction =
      totals.quotedRevenue > 0 && (totals.projectedProfit <= 0 || profitMargin < 0.12)
        ? [
            {
              id: "profit-risk",
              kind: "profit",
              priority: totals.projectedProfit <= 0 ? "P1" : "P2",
              queue: totals.projectedProfit <= 0 ? "negative_profit" : "low_margin",
              label: totals.projectedProfit <= 0 ? "负毛利预警" : "低毛利复核",
              target: financeDraft?.order_no || "当前订单",
              currency: "USD",
              amount: Math.abs(totals.projectedProfit),
              timing: `毛利率 ${(profitMargin * 100).toFixed(1)}%`,
              nextAction: "复核收入、供应商成本、附加费和汇率，必要时同步销售补差价。",
              row: null,
            },
          ]
        : [];

    return [...profitAction, ...receivableActions, ...costActions, ...payableActions].sort(
      (first, second) => financeActionRank(first) - financeActionRank(second),
    );
  }, [displayedOrderCostRows, displayedPayableRows, displayedReceivableRows, financeDraft?.order_no, totals]);

  const financeCommandSummary = useMemo(
    () => ({
      total: financeCommandRows.length,
      p1Count: financeCommandRows.filter((row) => row.priority === "P1").length,
      p2Count: financeCommandRows.filter((row) => row.priority === "P2").length,
      receivableOpen: displayedReceivableRows.reduce((sum, row) => sum + financeAmount(row, "balance_amount", "amount_due"), 0),
      payableOpen: displayedPayableRows.reduce((sum, row) => sum + financeAmount(row, "balance_amount", "amount", "amount_due"), 0),
      estimatedCostCount: displayedOrderCostRows.filter((row) => row.is_estimated).length,
      profitRiskCount: financeCommandRows.filter((row) => row.queue === "negative_profit" || row.queue === "low_margin").length,
    }),
    [displayedOrderCostRows, displayedPayableRows, displayedReceivableRows, financeCommandRows]
  );
  const cashRiskScore = useMemo(
    () => buildCashRiskScore(settlementAging, financeCommandSummary),
    [financeCommandSummary, settlementAging]
  );
  const settlementReadiness = useMemo(
    () => buildSettlementReadiness(settlementAging, financeCommandSummary),
    [financeCommandSummary, settlementAging]
  );
  const invoiceTaxControl = useMemo(
    () => buildInvoiceTaxReconciliationControl({ aging: settlementAging, orderCosts: displayedOrderCostRows }),
    [displayedOrderCostRows, settlementAging]
  );
  const financialRuleExportControl = useMemo(
    () => buildFinancialRuleExportControl({
      aging: settlementAging,
      orderCosts: displayedOrderCostRows,
      receivables: displayedReceivableRows,
      payables: displayedPayableRows,
      summary: financeCommandSummary,
    }),
    [displayedOrderCostRows, displayedPayableRows, displayedReceivableRows, financeCommandSummary, settlementAging]
  );

  const activePaymentRow = useMemo(() => {
    if (!paymentDraft) return null;
    const rows = paymentDraft.kind === "receivable" ? displayedReceivableRows : displayedPayableRows;
    return rows.find((row) => row.id === paymentDraft.rowId) || null;
  }, [displayedPayableRows, displayedReceivableRows, paymentDraft]);

  const isPaymentPending =
    paymentDraft?.kind === "receivable" ? recordReceivableMutation.isPending : recordPayableMutation.isPending;

  const applyReceivablePaymentLocally = (row, amount) => {
    const received = Number(row.amount_received || 0) + amount;
    const balance = Math.max(Number(row.amount_due || 0) - received, 0);
    setLocalReceivableState((prev) => ({
      ...prev,
      [row.id]: {
        amount_received: String(received),
        balance_amount: String(balance),
        status: balance === 0 ? "closed" : "partial",
      },
    }));
  };

  const applyPayablePaymentLocally = (row, amount) => {
    const paid = Number(row.amount_paid || 0) + amount;
    const balance = Math.max(Number(row.amount || row.amount_due || 0) - paid, 0);
    setLocalPayableState((prev) => ({
      ...prev,
      [row.id]: {
        amount_paid: String(paid),
        balance_amount: String(balance),
        status: balance === 0 ? "closed" : "partial",
      },
    }));
  };

  const openPaymentForm = (kind, row) => {
    if (!row) return;
    setPaymentDraft(buildPaymentDraft(kind, row, financeDraft));
  };

  const updatePaymentDraft = (field, value) => {
    setPaymentDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const closePaymentForm = () => {
    setPaymentDraft(null);
  };

  const openCostForm = () => {
    setCostDraft(buildCostDraft(financeDraft, vendors));
  };

  const updateCostDraft = (field, value) => {
    setCostDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const closeCostForm = () => {
    setCostDraft(null);
  };

  const handleRegisterReceivable = async (row, draft = paymentDraft) => {
    if (!row || !draft) return;

    const amount = Number(draft.amount || 0);
    const balance = Number(row.balance_amount || row.amount_due || 0);

    if (amount <= 0 || Number.isNaN(amount)) {
      onNotify?.({
        type: "info",
        title: "收款金额无效",
        message: "请输入大于 0 的收款金额。",
      });
      return;
    }

    if (!draft.allow_overpayment && amount > balance) {
      onNotify?.({
        type: "info",
        title: "收款超过余额",
        message: "收款金额不能超过当前余额；如确需超收，请勾选允许超额。",
      });
      return;
    }

    if (!String(draft.reference_no || "").trim()) {
      onNotify?.({
        type: "info",
        title: "缺少收款流水号",
        message: "请填写银行流水号或客户付款参考号，避免重复登记。",
      });
      return;
    }

    if (row.id && !isLocalRow(row)) {
      try {
        await recordReceivableMutation.mutateAsync({
          receivableId: row.id,
          payment_type: "receipt",
          currency: draft.currency || row.currency || "USD",
          amount,
          payment_method: draft.payment_method || "bank_transfer",
          payment_date: draft.payment_date || todayDate(),
          reference_no: draft.reference_no.trim(),
          fx_rate: draft.fx_rate ? Number(draft.fx_rate) : null,
          base_currency_amount: draft.base_currency_amount ? Number(draft.base_currency_amount) : null,
          allow_overpayment: draft.allow_overpayment,
        });
        applyReceivablePaymentLocally(row, amount);
        closePaymentForm();
        onNotify?.({
          type: "success",
          title: "收款记录已登记",
          message: `${row.order_no || financeDraft?.order_no || "订单"} 已登记 ${draft.currency || row.currency || "USD"} ${amount.toFixed(2)}，数据库已防重复和防超额校验。`,
        });
        return;
      } catch (error) {
        onNotify?.({
          type: "info",
          title: "真实收款登记失败",
          message: financeErrorMessage(error),
        });
        return;
      }
    }

    applyReceivablePaymentLocally(row, amount);
    closePaymentForm();
    onNotify?.({
      type: "success",
      title: "本地草稿已模拟收款",
      message: `${row.order_no || financeDraft?.order_no || "订单"} 还未入库，本次只更新本地草稿；流水号 ${draft.reference_no}。`,
    });
  };

  const handleRegisterPayable = async (row, draft = paymentDraft) => {
    if (!row || !draft) return;

    const amount = Number(draft.amount || 0);
    const balance = Number(row.balance_amount || row.amount || row.amount_due || 0);

    if (amount <= 0 || Number.isNaN(amount)) {
      onNotify?.({
        type: "info",
        title: "付款金额无效",
        message: "请输入大于 0 的付款金额。",
      });
      return;
    }

    if (!draft.allow_overpayment && amount > balance) {
      onNotify?.({
        type: "info",
        title: "付款超过余额",
        message: "付款金额不能超过当前应付余额；如确需超付，请勾选允许超额。",
      });
      return;
    }

    if (!String(draft.reference_no || "").trim()) {
      onNotify?.({
        type: "info",
        title: "缺少付款流水号",
        message: "请填写银行流水号或供应商付款参考号，避免重复登记。",
      });
      return;
    }

    if (row.id && !isLocalRow(row)) {
      try {
        await recordPayableMutation.mutateAsync({
          payableId: row.id,
          payment_type: "payment",
          currency: draft.currency || row.currency || "USD",
          amount,
          payment_method: draft.payment_method || "bank_transfer",
          payment_date: draft.payment_date || todayDate(),
          reference_no: draft.reference_no.trim(),
          fx_rate: draft.fx_rate ? Number(draft.fx_rate) : null,
          base_currency_amount: draft.base_currency_amount ? Number(draft.base_currency_amount) : null,
          allow_overpayment: draft.allow_overpayment,
        });
        applyPayablePaymentLocally(row, amount);
        closePaymentForm();
        onNotify?.({
          type: "success",
          title: "付款记录已登记",
          message: `${row.vendor || "供应商"} 已登记 ${draft.currency || row.currency || "USD"} ${amount.toFixed(2)}，数据库已防重复和防超额校验。`,
        });
        return;
      } catch (error) {
        onNotify?.({
          type: "info",
          title: "真实付款登记失败",
          message: financeErrorMessage(error),
        });
        return;
      }
    }

    applyPayablePaymentLocally(row, amount);
    closePaymentForm();
    onNotify?.({
      type: "success",
      title: "本地草稿已模拟付款",
      message: `${row.vendor || "供应商"} 还未入库，本次只更新本地草稿；流水号 ${draft.reference_no}。`,
    });
  };

  const handleSaveCostLine = async (draft = costDraft) => {
    if (!draft) return;

    const amount = Number(draft.amount || 0);
    const taxRatePercent = Number(draft.tax_rate || 0);

    if (amount <= 0 || Number.isNaN(amount)) {
      onNotify?.({
        type: "info",
        title: "成本金额无效",
        message: "请输入大于 0 的供应商成本金额。",
      });
      return;
    }

    if (!String(draft.fee_code || "").trim() || !String(draft.description || "").trim()) {
      onNotify?.({
        type: "info",
        title: "成本信息不完整",
        message: "请填写费项代码和费用说明，方便后续对账和生成应付。",
      });
      return;
    }

    const taxRate = Math.max(taxRatePercent, 0) / 100;
    const taxAmount = Number((amount * taxRate).toFixed(2));
    const amountExTax = Number(Math.max(amount - taxAmount, 0).toFixed(2));
    const selectedVendorName = vendorNameById[draft.vendor_id] || "未关联供应商";
    const normalizedCost = {
      vendor_id: draft.vendor_id || null,
      fee_code: draft.fee_code.trim(),
      cost_category: draft.cost_category || "Other",
      description: draft.description.trim(),
      currency: draft.currency || "USD",
      amount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      amount_ex_tax: amountExTax,
      status: draft.status || "draft",
      is_estimated: draft.is_estimated === true,
      occurred_at: draft.occurred_at ? `${draft.occurred_at}T00:00:00Z` : null,
    };

    if (financeDraft?.order_id) {
      try {
        const savedCost = await createOrderCostMutation.mutateAsync({
          order_id: financeDraft.order_id,
          ...normalizedCost,
        });
        closeCostForm();
        onNotify?.({
          type: "success",
          title: "成本明细已创建",
          message: `${financeDraft.order_no || "订单"} 已新增 ${normalizedCost.currency} ${amount.toFixed(2)} 成本；${draft.vendor_id ? "可用于后续生成应付。" : "未关联供应商，暂不会自动生成应付。"}`,
        });
        if (!liveOrderCosts?.items?.length && savedCost?.id) {
          setLocalOrderCostRows((prev) => [
            ...prev.filter((item) => !String(item.id).startsWith("local-cost-")),
            {
              id: savedCost.id,
              data_source: "database",
              row_type: "order_cost",
              vendor_id: draft.vendor_id || "",
              vendor: selectedVendorName,
              fee_code: normalizedCost.fee_code,
              cost_category: normalizedCost.cost_category,
              description: normalizedCost.description,
              currency: normalizedCost.currency,
              amount: String(amount),
              tax_rate: String(taxRate),
              tax_amount: String(taxAmount),
              amount_ex_tax: String(amountExTax),
              is_estimated: normalizedCost.is_estimated,
              status: normalizedCost.status,
              occurred_at: draft.occurred_at || "-",
            },
          ]);
        }
        return;
      } catch (error) {
        onNotify?.({
          type: "info",
          title: "真实成本保存失败",
          message: error?.message || "数据库未写入，请确认当前账号具备成本录入权限。",
        });
        return;
      }
    }

    setLocalOrderCostRows((prev) => [
      ...prev,
      {
        id: `local-cost-${Date.now()}`,
        data_source: "local_draft",
        row_type: "order_cost",
        vendor: selectedVendorName,
        ...normalizedCost,
        vendor_id: draft.vendor_id || "",
        tax_rate: String(taxRate),
        tax_amount: String(taxAmount),
        amount_ex_tax: String(amountExTax),
        amount: String(amount),
        occurred_at: draft.occurred_at || "-",
      },
    ]);
    closeCostForm();
    onNotify?.({
      type: "info",
      title: "本地成本草稿已添加",
      message: `${financeDraft?.order_no || "订单"} 还未入库，本次只暂存 ${normalizedCost.currency} ${amount.toFixed(2)} 成本。`,
    });
  };

  const handleCopyFinanceActionPlan = async () => {
    const text = buildFinanceActionPlan(financeCommandRows, financeCommandSummary, financeDraft);

    try {
      await navigator.clipboard.writeText(text);
      setFinanceActionPlanText("");
      onNotify?.({
        type: "success",
        title: "财务行动清单已复制",
        message: "已按应收、成本、应付和毛利风险优先级整理，可直接同步给销售、操作或财务。",
      });
    } catch (error) {
      setFinanceActionPlanText(text);
      onNotify?.({
        type: "info",
        title: "浏览器阻止自动复制",
        message: "行动清单已展开在页面中，可以手动选中复制。",
      });
    }
  };

  const handleCopyFinancialRuleExportPlan = async () => {
    const text = buildFinancialRuleExportPlan(financialRuleExportControl, financeDraft);

    if (!text) {
      onNotify?.({
        type: "info",
        title: "暂无导出治理清单",
        message: "当前没有可整理的财务规则和外部导出内容。",
      });
      return;
    }

    setFinancialRuleExportPlanText(text);

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "财务规则导出清单已复制",
        message: "已按账期、汇率、坏账/折扣和外部导出字段整理，可同步给财务和管理层。",
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，已在页面展开财务规则导出清单。",
      });
    }
  };

  const handleFocusFinanceAction = (actionRow) => {
    if (!actionRow) return;

    if (actionRow.kind === "receivable") {
      setActiveTab("receivables");
      openPaymentForm("receivable", actionRow.row);
      return;
    }

    if (actionRow.kind === "payable") {
      setActiveTab("costs");
      openPaymentForm("payable", actionRow.row);
      return;
    }

    setActiveTab("costs");
    if (actionRow.kind === "profit") {
      onNotify?.({
        type: "info",
        title: "毛利风险处理建议",
        message: actionRow.nextAction,
      });
    }
  };

  const handleExportFinance = (scope) => {
    const exportedAt = new Date().toISOString();
    const orderNo = financeDraft?.order_no || "finance";
    const receivableExportRows = displayedReceivableRows.map((item) => ({
      type: "receivable",
      customer: item.customer,
      order_no: item.order_no,
      currency: item.currency,
      amount_due: item.amount_due,
      amount_received: item.amount_received,
      balance_amount: item.balance_amount,
      status: item.status,
      data_source: item.data_source || "local_draft",
      exported_at: exportedAt,
    }));
    const orderCostExportRows = displayedOrderCostRows.map((item) => ({
      type: "order_cost",
      vendor: item.vendor,
      order_no: financeDraft?.order_no || "",
      cost_category: item.cost_category,
      fee_code: item.fee_code,
      description: item.description,
      currency: item.currency,
      amount: item.amount || 0,
      tax_rate: item.tax_rate || 0,
      tax_amount: item.tax_amount || 0,
      amount_ex_tax: item.amount_ex_tax || item.amount || 0,
      status: item.status,
      is_estimated: item.is_estimated === true,
      occurred_at: item.occurred_at,
      data_source: item.data_source || "local_draft",
      exported_at: exportedAt,
    }));
    const payableExportRows = displayedPayableRows.map((item) => ({
      type: "payable",
      vendor: item.vendor,
      order_no: financeDraft?.order_no || "",
      cost_category: item.cost_category,
      description: item.description,
      currency: item.currency,
      amount_due: item.amount || item.amount_due || 0,
      amount_paid: item.amount_paid || 0,
      balance_amount: item.balance_amount || item.amount || 0,
      status: item.status,
      occurred_at: item.occurred_at,
      data_source: item.data_source || "local_draft",
      exported_at: exportedAt,
    }));
    const rows =
      scope === "receivables"
        ? receivableExportRows
        : scope === "payables"
        ? payableExportRows
        : [...receivableExportRows, ...orderCostExportRows, ...payableExportRows];

    if (!rows.length) {
      onNotify?.({
        type: "info",
        title: "暂无可导出数据",
        message: "当前财务包还没有应收或应付明细。",
      });
      return;
    }

    downloadCsv(`${orderNo}-${scope}-statement.csv`, rows);
    onNotify?.({
      type: "success",
      title: "财务对账单已导出",
      message: `${rows.length} 行${scope === "receivables" ? "应收" : scope === "payables" ? "应付" : "财务"}明细已生成 CSV。`,
    });
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
            成本与结算
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">财务结算</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            财务结算承接订单执行结果，集中处理成本录入、应收应付、收款登记和毛利核算，让销售、操作和财务在同一条业务链路上协同。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleExportFinance("receivables")}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
          >
            导出应收
          </button>
          <button
            type="button"
            onClick={() => handleExportFinance("payables")}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700"
          >
            导出应付
          </button>
          <button
            type="button"
            onClick={() => handleExportFinance("all")}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            导出财务包
          </button>
          <button
            type="button"
            onClick={onBackToOrders}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            返回订单
          </button>
          <button
            type="button"
            onClick={() =>
              onNotify?.({
                type: "info",
                title: "财务包检查结果",
                message: `${financeDraft?.order_no || "订单"} 当前有 ${displayedReceivableRows.length} 条应收、${displayedOrderCostRows.length} 条成本、${displayedPayableRows.length} 条应付；真实入库和本地草稿已在表格中标注。`,
              })
            }
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            检查财务包
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
              Finance Command
            </div>
            <h3 className="mt-3 text-2xl font-bold">财务结算指挥台</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              自动把应收、应付、成本确认和毛利异常整理成当天财务动作，先处理会影响现金流和利润的项目。
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyFinanceActionPlan}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm"
          >
            复制财务行动清单
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">行动项</div>
            <div className="mt-2 text-3xl font-bold">{financeCommandSummary.total}</div>
            <div className="mt-1 text-xs text-slate-400">P1 {financeCommandSummary.p1Count} · P2 {financeCommandSummary.p2Count}</div>
          </div>
          <div className={`rounded-2xl border p-4 ${cashRiskClass(cashRiskScore.tone)}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">现金风险</div>
                <div className="mt-2 text-3xl font-bold">{cashRiskScore.score}</div>
              </div>
              <div className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-black">Grade {cashRiskScore.grade}</div>
            </div>
            <div className="mt-2 text-xs leading-5 opacity-80">{cashRiskScore.reasons[0]}</div>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">待收现金</div>
            <div className="mt-2 text-3xl font-bold">${financeCommandSummary.receivableOpen.toFixed(0)}</div>
            <div className="mt-1 text-xs text-emerald-100/70">客户应收余额</div>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">待付供应商</div>
            <div className="mt-2 text-3xl font-bold">${financeCommandSummary.payableOpen.toFixed(0)}</div>
            <div className="mt-1 text-xs text-amber-100/70">应付余额</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">预估成本</div>
            <div className="mt-2 text-3xl font-bold">{financeCommandSummary.estimatedCostCount}</div>
            <div className="mt-1 text-xs text-slate-400">需确认后锁定毛利</div>
          </div>
          <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-100">毛利风险</div>
            <div className="mt-2 text-3xl font-bold">{financeCommandSummary.profitRiskCount}</div>
            <div className="mt-1 text-xs text-rose-100/70">负毛利/低毛利</div>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {financeCommandRows.length ? (
            financeCommandRows.slice(0, 6).map((row) => (
              <div
                key={`${row.kind}-${row.id}-${row.queue}`}
                className="rounded-2xl border border-white/10 bg-white p-4 text-slate-900 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${actionPriorityClass(row.priority)}`}>
                        {row.priority}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {row.label}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{row.timing}</span>
                    </div>
                    <div className="mt-2 text-base font-bold text-slate-950">{row.target}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {row.currency} {row.amount.toFixed(2)} · {row.nextAction}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFocusFinanceAction(row)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    聚焦处理
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 text-sm text-slate-300">
              当前没有高优先级财务动作。继续保持收付款登记、成本确认和导出对账节奏就好。
            </div>
          )}
        </div>

        {financeActionPlanText ? (
          <textarea
            className="mt-5 min-h-56 w-full rounded-2xl border border-white/10 bg-white/95 p-4 text-sm leading-6 text-slate-900 outline-none"
            value={financeActionPlanText}
            onChange={(event) => setFinanceActionPlanText(event.target.value)}
          />
        ) : null}
      </div>

      <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">A/R A/P aging</div>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">账期与发票控制台</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              按应收、应付的到期日和发票/账单状态聚合风险，先处理逾期收款、临期付款和缺票据项目。
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                  cashRiskScore.tone === "emerald"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : cashRiskScore.tone === "sky"
                      ? "border-sky-200 bg-sky-50 text-sky-700"
                      : cashRiskScore.tone === "amber"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                }`}>
                  现金风险 {cashRiskScore.score} / {cashRiskScore.grade}
                </span>
                <span className="text-xs font-semibold text-slate-500">优先修复会影响回款、付款排期和毛利确认的项目</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {cashRiskScore.reasons.map((reason) => (
                  <span key={reason} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <SummaryTile
              label="逾期金额"
              value={`$${settlementAging.overdueAmount.toFixed(0)}`}
              hint="应收/应付已过到期日"
              tone={settlementAging.overdueAmount > 0 ? "amber" : "emerald"}
            />
            <SummaryTile
              label="3天内到期"
              value={`$${settlementAging.dueSoonAmount.toFixed(0)}`}
              hint="需要本周处理"
              tone="amber"
            />
            <SummaryTile
              label="无到期日"
              value={settlementAging.noDueDateCount}
              hint="账期规则待补"
            />
            <SummaryTile
              label="缺票据"
              value={settlementAging.missingInvoiceCount}
              hint="invoice/bill 待关联"
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="mb-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Settlement readiness</div>
                <h4 className="mt-1 text-lg font-bold text-slate-950">对账 / 开票 / 核销准备度</h4>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  把票据、账期、时效压力和毛利风险合成结算准备度，先补会卡住客户对账、供应商付款或月末核销的项目。
                </p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-center ${
                settlementReadiness.priority === "P1"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : settlementReadiness.priority === "P2"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}>
                <div className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{settlementReadiness.priority}</div>
                <div className="mt-1 text-3xl font-black">{settlementReadiness.score}</div>
                <div className="text-xs font-bold">Grade {settlementReadiness.grade}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {settlementReadiness.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold text-slate-500">{metric.label}</div>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-2xl font-black text-slate-950">{metric.value}</span>
                    <span className="pb-1 text-xs font-semibold text-slate-400">/100</span>
                  </div>
                  <div className="mt-1 text-xs leading-4 text-slate-500">{metric.hint}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">准备度风险</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {settlementReadiness.risks.map((risk) => (
                    <span key={risk} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {risk}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">财务下一步</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{settlementReadiness.nextAction}</div>
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Invoice VAT Control</div>
                <h4 className="mt-1 text-lg font-bold text-slate-950">发票税率 / 核销控制台</h4>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  把发票/账单号、成本税率、税额平衡和余额核销放在一起检查，避免月末对账和外部财务系统导出时才发现缺口。
                </p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-center ${
                invoiceTaxControl.priority === "P1"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : invoiceTaxControl.priority === "P2"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}>
                <div className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{invoiceTaxControl.priority}</div>
                <div className="mt-1 text-3xl font-black">{invoiceTaxControl.score}</div>
                <div className="text-xs font-bold">Grade {invoiceTaxControl.grade}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {invoiceTaxControl.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">{metric.label}</div>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-2xl font-black text-slate-950">{metric.value}</span>
                    <span className="pb-1 text-xs font-semibold text-slate-400">/100</span>
                  </div>
                  <div className="mt-1 text-xs leading-4 text-slate-500">{metric.hint}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">发票 / 税率风险</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {invoiceTaxControl.risks.map((risk) => (
                    <span key={risk} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                      {risk}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">核销下一步</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{invoiceTaxControl.nextAction}</div>
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-3xl border border-slate-200 bg-slate-950 p-4 text-white">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Finance Rules / ERP Export</div>
                <h4 className="mt-1 text-lg font-bold">财务规则 / 外部导出控制台</h4>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  把账期规则、汇率/本位币、坏账折扣和外部系统导出字段统一检查，避免导出 ERP、用友或月末财务包时才发现缺规则。
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <div className={`rounded-2xl border px-4 py-3 text-center ${
                  financialRuleExportControl.priority === "P1"
                    ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
                    : financialRuleExportControl.priority === "P2"
                      ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                      : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                }`}>
                  <div className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{financialRuleExportControl.priority}</div>
                  <div className="mt-1 text-3xl font-black">{financialRuleExportControl.score}</div>
                  <div className="text-xs font-bold">Grade {financialRuleExportControl.grade}</div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyFinancialRuleExportPlan}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950"
                >
                  复制导出治理清单
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {financialRuleExportControl.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold text-slate-300">{metric.label}</div>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-2xl font-black text-white">{metric.value}</span>
                    <span className="pb-1 text-xs font-semibold text-slate-400">/100</span>
                  </div>
                  <div className="mt-1 text-xs leading-4 text-slate-400">{metric.hint}</div>
                </div>
              ))}
            </div>

            {financialRuleExportPlanText ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm font-bold text-white">财务规则导出清单</div>
                <textarea
                  readOnly
                  value={financialRuleExportPlanText}
                  onChange={(event) => setFinancialRuleExportPlanText(event.target.value)}
                  className="mt-3 h-44 w-full rounded-2xl border border-white/10 bg-white p-3 text-sm leading-6 text-slate-700 outline-none"
                />
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">规则 / 导出风险</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {financialRuleExportControl.risks.map((risk) => (
                    <span key={risk} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-slate-200">
                      {risk}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">导出下一步</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{financialRuleExportControl.nextAction}</div>
              </div>
            </div>
          </div>

          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="px-3 py-3">类型</th>
                <th className="px-3 py-3">对象</th>
                <th className="px-3 py-3">单据/订单</th>
                <th className="px-3 py-3 text-right">余额</th>
                <th className="px-3 py-3">到期</th>
                <th className="px-3 py-3">票据</th>
                <th className="px-3 py-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlementAging.priorityItems.slice(0, 8).map((item) => (
                <tr key={`${item.kind}-${item.id}`} className="align-top text-slate-700">
                  <td className="px-3 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      item.kind === "receivable" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {item.kind === "receivable" ? "应收" : "应付"}
                    </span>
                  </td>
                  <td className="px-3 py-4 font-semibold text-slate-950">{item.party}</td>
                  <td className="px-3 py-4 text-slate-500">{item.target}</td>
                  <td className="px-3 py-4 text-right font-bold text-slate-950">
                    {item.currency} {item.balance.toFixed(2)}
                  </td>
                  <td className="px-3 py-4">
                    <div className={`font-semibold ${
                      item.bucket === "overdue"
                        ? "text-rose-700"
                        : item.bucket === "due_soon"
                          ? "text-amber-700"
                          : "text-slate-700"
                    }`}>
                      {item.dueLabel}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{item.dueDate || "未设置"}</div>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      item.hasInvoice ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}>
                      {item.hasInvoice ? "已关联" : "缺票据"}
                    </span>
                  </td>
                  <td className="px-3 py-4">{item.status}</td>
                </tr>
              ))}
              {!settlementAging.priorityItems.length ? (
                <tr>
                  <td colSpan="7" className="px-3 py-8 text-center text-sm text-slate-500">
                    当前没有逾期、临期、缺到期日或缺票据项目。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <SummaryTile
              label="未收应收"
              value={`$${totals.quotedRevenue.toFixed(0)}`}
              hint="客户账单待收款"
              tone="emerald"
            />
            <SummaryTile
              label="未付应付"
              value={`$${totals.quotedCost.toFixed(0)}`}
              hint="供应商成本待结算"
              tone="amber"
            />
          </div>

          <SummaryTile
            label="预计利润"
            value={`$${totals.projectedProfit.toFixed(0)}`}
            hint="基于报价转订单后的收入与成本"
          />

          <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <h3 className="text-xl font-bold">订单上下文</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div>订单: {financeDraft?.order_no || "OD202605270001"}</div>
              <div>客户: {financeDraft?.customer || "客户"}</div>
              <div>路线: {financeDraft?.origin || "-"} → {financeDraft?.destination || "-"}</div>
              <div>
                运输: {financeDraft?.transport_mode?.toUpperCase() || "RAIL"} · {financeDraft?.shipment_type || "LCL"}
              </div>
              <div>
                数据来源: {receivableError || payableError || orderCostError ? "本地草稿/演示数据" : liveReceivables?.items?.length || livePayables?.items?.length || liveOrderCosts?.items?.length ? "真实数据库" : "订单草稿交接"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("receivables")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === "receivables"
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              应收管理
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("costs")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === "costs"
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              成本录入
            </button>
          </div>

          {activeTab === "receivables" ? (
            <div className="mt-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">应收队列</h3>
                  <p className="mt-1 text-sm text-slate-500">由订单交接生成的客户账单与收款项目。</p>
                </div>
                <button
                  type="button"
                  onClick={() => openPaymentForm("receivable", displayedReceivableRows[0])}
                  disabled={recordReceivableMutation.isPending || !displayedReceivableRows.length}
                  className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  {recordReceivableMutation.isPending ? "登记中..." : "登记收款"}
                </button>
              </div>

              {paymentDraft?.kind === "receivable" && activePaymentRow ? (
                <PaymentForm
                  draft={paymentDraft}
                  row={activePaymentRow}
                  onChange={updatePaymentDraft}
                  onSubmit={handleRegisterReceivable}
                  onCancel={closePaymentForm}
                  isPending={isPaymentPending}
                />
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="py-3 pr-4">客户</th>
                      <th className="py-3 pr-4">订单</th>
                      <th className="py-3 pr-4">币种</th>
                      <th className="py-3 pr-4">应收</th>
                      <th className="py-3 pr-4">已收</th>
                      <th className="py-3 pr-4">余额</th>
                      <th className="py-3 pr-4">状态</th>
                      <th className="py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedReceivableRows.map((item) => (
                      <tr key={`${item.id}-${item.order_no}-${item.customer}`} className="border-b border-slate-100 text-sm text-slate-700">
                        <td className="py-4 pr-4 font-medium text-slate-900">{item.customer}</td>
                        <td className="py-4 pr-4">{item.order_no}</td>
                        <td className="py-4 pr-4">{item.currency}</td>
                        <td className="py-4 pr-4">${item.amount_due}</td>
                        <td className="py-4 pr-4">${item.amount_received}</td>
                        <td className="py-4 pr-4">${item.balance_amount}</td>
                        <td className="py-4 pr-4">
                          <div>{item.status}</div>
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            item.data_source === "database"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}>
                            {item.data_source === "database" ? "真实入库" : "本地草稿"}
                          </span>
                        </td>
                        <td className="py-4">
                          <button
                            type="button"
                            onClick={() => openPaymentForm("receivable", item)}
                            disabled={recordReceivableMutation.isPending || Number(item.balance_amount || 0) <= 0}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            登记收款
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">成本明细</h3>
                  <p className="mt-1 text-sm text-slate-500">录入真实供应商成本，作为毛利核算和应付生成依据。</p>
                </div>
                <button
                  type="button"
                  onClick={openCostForm}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  新增成本
                </button>
              </div>

              {costDraft ? (
                <CostForm
                  draft={costDraft}
                  vendors={vendors}
                  onChange={updateCostDraft}
                  onSubmit={handleSaveCostLine}
                  onCancel={closeCostForm}
                  isPending={createOrderCostMutation.isPending}
                  hasRealOrder={Boolean(financeDraft?.order_id)}
                />
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="py-3 pr-4">类别</th>
                      <th className="py-3 pr-4">供应商</th>
                      <th className="py-3 pr-4">币种</th>
                      <th className="py-3 pr-4">金额</th>
                      <th className="py-3 pr-4">税额</th>
                      <th className="py-3 pr-4">不含税</th>
                      <th className="py-3 pr-4">状态</th>
                      <th className="py-3 pr-4">日期</th>
                      <th className="py-3">来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedOrderCostRows.map((item, index) => (
                      <tr key={`${item.id}-${item.vendor}-${index}`} className="border-b border-slate-100 text-sm text-slate-700">
                        <td className="py-4 pr-4">
                          <div className="font-medium text-slate-900">{item.cost_category}</div>
                          <div className="mt-1 text-xs text-slate-400">{item.fee_code} · {item.description}</div>
                        </td>
                        <td className="py-4 pr-4">{item.vendor}</td>
                        <td className="py-4 pr-4">{item.currency}</td>
                        <td className="py-4 pr-4">${item.amount}</td>
                        <td className="py-4 pr-4">${item.tax_amount || 0}</td>
                        <td className="py-4 pr-4">${item.amount_ex_tax || item.amount}</td>
                        <td className="py-4 pr-4">
                          <div>{item.status}</div>
                          {item.is_estimated ? (
                            <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              预估
                            </span>
                          ) : null}
                        </td>
                        <td className="py-4 pr-4">{item.occurred_at}</td>
                        <td className="py-4">
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            item.data_source === "database"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}>
                            {item.data_source === "database" ? "真实入库" : "本地草稿"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 rounded-3xl border border-amber-100 bg-amber-50/60 p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">应付结算队列</h3>
                    <p className="mt-1 text-sm text-slate-500">已生成的供应商应付在这里登记付款；成本明细本身不会直接付款。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPaymentForm("payable", displayedPayableRows[0])}
                    disabled={recordPayableMutation.isPending || !displayedPayableRows.length}
                    className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {recordPayableMutation.isPending ? "登记中..." : "登记付款"}
                  </button>
                </div>

                {paymentDraft?.kind === "payable" && activePaymentRow ? (
                  <PaymentForm
                    draft={paymentDraft}
                    row={activePaymentRow}
                    onChange={updatePaymentDraft}
                    onSubmit={handleRegisterPayable}
                    onCancel={closePaymentForm}
                    isPending={isPaymentPending}
                  />
                ) : null}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="border-b border-amber-200 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <th className="py-3 pr-4">供应商</th>
                        <th className="py-3 pr-4">币种</th>
                        <th className="py-3 pr-4">应付</th>
                        <th className="py-3 pr-4">已付</th>
                        <th className="py-3 pr-4">余额</th>
                        <th className="py-3 pr-4">状态</th>
                        <th className="py-3 pr-4">到期日</th>
                        <th className="py-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedPayableRows.map((item, index) => (
                        <tr key={`${item.id}-${item.vendor}-${index}`} className="border-b border-amber-100 text-sm text-slate-700">
                          <td className="py-4 pr-4">
                            <div className="font-medium text-slate-900">{item.vendor}</div>
                            <div className="mt-1 text-xs text-slate-400">{item.description}</div>
                          </td>
                          <td className="py-4 pr-4">{item.currency}</td>
                          <td className="py-4 pr-4">${item.amount}</td>
                          <td className="py-4 pr-4">${item.amount_paid || 0}</td>
                          <td className="py-4 pr-4">${item.balance_amount || item.amount}</td>
                          <td className="py-4 pr-4">
                            <div>{item.status}</div>
                            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              item.data_source === "database"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {item.data_source === "database" ? "真实入库" : "本地草稿"}
                            </span>
                          </td>
                          <td className="py-4 pr-4">{item.occurred_at}</td>
                        <td className="py-4">
                          <button
                            type="button"
                            onClick={() => openPaymentForm("payable", item)}
                            disabled={recordPayableMutation.isPending || Number(item.balance_amount || item.amount || 0) <= 0}
                            className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            登记付款
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
