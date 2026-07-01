const quotePreviewByMode = {
  rail: [
    { fee_code: "rail_lcl", revenue_amount: 1800, estimated_cost_amount: 1320, profit_amount: 480 },
    { fee_code: "customs", revenue_amount: 220, estimated_cost_amount: 150, profit_amount: 70 },
    { fee_code: "delivery", revenue_amount: 460, estimated_cost_amount: 330, profit_amount: 130 },
  ],
  sea: [
    { fee_code: "sea_fcl", revenue_amount: 2400, estimated_cost_amount: 1980, profit_amount: 420 },
    { fee_code: "documentation", revenue_amount: 120, estimated_cost_amount: 70, profit_amount: 50 },
  ],
  air: [
    { fee_code: "air_freight", revenue_amount: 3200, estimated_cost_amount: 2750, profit_amount: 450 },
    { fee_code: "airport_handling", revenue_amount: 260, estimated_cost_amount: 180, profit_amount: 80 },
  ],
  low_margin: [
    { fee_code: "main_freight", revenue_amount: 1000, estimated_cost_amount: 910, profit_amount: 90 },
    { fee_code: "delivery", revenue_amount: 200, estimated_cost_amount: 170, profit_amount: 30 },
  ],
};

function buildFallbackPricing(values) {
  const items = quotePreviewByMode[values.transport_mode] || quotePreviewByMode.rail;
  const summary = items.reduce(
    (acc, item) => {
      acc.estimated_revenue_total += item.revenue_amount;
      acc.estimated_cost_total += item.estimated_cost_amount;
      acc.estimated_profit_total += item.profit_amount;
      return acc;
    },
    {
      estimated_revenue_total: 0,
      estimated_cost_total: 0,
      estimated_profit_total: 0,
      estimated_profit_margin: 0,
    },
  );

  summary.estimated_profit_margin = summary.estimated_revenue_total
    ? summary.estimated_profit_total / summary.estimated_revenue_total
    : 0;

  return {
    matched_rate_sheet_name: `${values.transport_mode.toUpperCase()} MVP Seed Rate`,
    pricing_status: "local_demo",
    currency: "USD",
    items,
    summary,
    warnings:
      summary.estimated_profit_margin < 0.18
        ? ["毛利率低于建议目标，建议主管复核后再发报价。"]
        : ["本地演示价格，仅用于流程预览；真实报价请登录并重新核算。"],
  };
}

function buildOrderDraft({ form, pricingPreview, savedQuote = {}, lead = {}, overrides = {} }) {
  return {
    order_id: overrides.order_id,
    order_no: overrides.order_no || "OD202605270001",
    quote_id: savedQuote.id || overrides.quote_id,
    quote_no: savedQuote.quote_no || overrides.quote_no,
    customer_id: savedQuote.customer_id || lead.customer_id,
    contact_id: savedQuote.contact_id || lead.contact_id,
    company_name: form.customer_name,
    customer: form.customer_name,
    contact_name: form.contact_name,
    transport_mode: form.transport_mode,
    shipment_type: form.shipment_type,
    origin: form.origin,
    destination: form.destination,
    volume_cbm: Number(form.volume_cbm || 0),
    weight_kg: Number(form.weight_kg || 0),
    estimated_revenue_total: pricingPreview?.summary?.estimated_revenue_total || 0,
    estimated_cost_total: pricingPreview?.summary?.estimated_cost_total || 0,
    estimated_profit_total: pricingPreview?.summary?.estimated_profit_total || 0,
  };
}

function parseQuoteDateMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function quoteVersionKey(row) {
  return [
    row.customerName || "customer",
    row.route || "route",
    row.cargo || "cargo",
  ].join("|").toLowerCase();
}

function quotePriorityRank(priority) {
  if (priority === "P1") return 1;
  if (priority === "P2") return 2;
  return 3;
}

function scoreQuoteVersionOutput(row, allRows) {
  const sameVersions = allRows.filter((item) => quoteVersionKey(item) === quoteVersionKey(row));
  const hasNewerVersion = sameVersions.some((item) => {
    const currentMs = parseQuoteDateMs(row.createdAt) || 0;
    const nextMs = parseQuoteDateMs(item.createdAt) || 0;
    return item.id !== row.id && nextMs > currentMs;
  });
  const hasQuoteNo = Boolean(row.quoteNo && !["当前报价预览", "报价号待生成"].includes(row.quoteNo));
  const hasCustomer = Boolean(row.customerName && row.customerName !== "未命名报价");
  const hasRoute = Boolean(row.route && row.route !== "路线待补");
  const hasRevenue = row.revenue > 0;
  const hasValidUntil = Boolean(row.validUntil);
  const isLowMargin = row.margin > 0 && row.margin < 0.18;
  const isApprovalPending = row.pricingStatus === "approval_requested" || row.approvalStatus === "pending_approval";
  const isDraft = ["draft", "pricing_preview"].includes(row.status);
  const isSent = row.status === "sent";
  const isReadyToOrder = row.action?.label === "转订单";

  let score = 100;
  const risks = [];

  if (!hasQuoteNo) {
    score -= 12;
    risks.push("报价单号未锁定");
  }
  if (!hasCustomer || !hasRoute) {
    score -= 18;
    risks.push("客户或路线不完整");
  }
  if (!hasRevenue) {
    score -= 25;
    risks.push("金额未生成");
  }
  if (!hasValidUntil) {
    score -= 8;
    risks.push("有效期未设置");
  }
  if (isLowMargin) {
    score -= 24;
    risks.push("低毛利待审批");
  }
  if (isApprovalPending) {
    score -= 18;
    risks.push("审批未完成");
  }
  if (isDraft) {
    score -= 14;
    risks.push("草稿未正式发送");
  }
  if (hasNewerVersion && (isSent || row.status === "accepted")) {
    score -= 16;
    risks.push("已有更新版本，旧版需复核");
  }

  const normalizedScore = Math.max(Math.min(score, 100), 0);
  const grade = normalizedScore >= 85 ? "A" : normalizedScore >= 70 ? "B" : normalizedScore >= 55 ? "C" : "D";
  const priority =
    grade === "D" || isLowMargin || isApprovalPending || !hasRevenue
      ? "P1"
      : grade === "C" || isDraft || hasNewerVersion || !hasQuoteNo
        ? "P2"
        : "P3";

  const outputStatus =
    isReadyToOrder
      ? "可转订单"
      : isSent
        ? "已发待追"
        : isApprovalPending || isLowMargin
          ? "待审批"
          : isDraft
            ? "待正式输出"
            : "可正式发送";

  return {
    score: normalizedScore,
    grade,
    priority,
    versionCount: sameVersions.length,
    hasNewerVersion,
    outputStatus,
    risks: risks.length ? risks : ["版本、审批、客户版输出和转单状态健康"],
  };
}

function buildQuoteVersionOutputRows(rows) {
  return (rows || [])
    .map((row) => ({
      ...row,
      output: scoreQuoteVersionOutput(row, rows || []),
    }))
    .sort((first, second) => {
      const priorityDifference = quotePriorityRank(first.output.priority) - quotePriorityRank(second.output.priority);
      if (priorityDifference) return priorityDifference;
      return first.output.score - second.output.score || String(second.createdAt || "").localeCompare(String(first.createdAt || ""));
    });
}

const railPricing = buildFallbackPricing({ transport_mode: "rail" });
const lowMarginPricing = buildFallbackPricing({ transport_mode: "low_margin" });
const orderDraft = buildOrderDraft({
  form: {
    customer_name: "Acme GmbH",
    contact_name: "Anna",
    transport_mode: "rail",
    shipment_type: "LCL",
    origin: "Xi'an",
    destination: "Duisburg",
    volume_cbm: "12.5",
    weight_kg: "2800",
  },
  pricingPreview: railPricing,
  savedQuote: { id: "quote-1", quote_no: "QT2026", customer_id: "customer-1" },
  lead: { contact_id: "contact-1" },
});
const versionRows = buildQuoteVersionOutputRows([
  {
    id: "qt-low",
    quoteNo: "QT-LOW",
    customerName: "Acme GmbH",
    route: "Xi'an -> Duisburg",
    cargo: "Retail goods",
    status: "draft",
    pricingStatus: "approval_requested",
    approvalStatus: "pending",
    revenue: 1200,
    margin: 0.1,
    validUntil: "2026-07-31",
    createdAt: "2026-07-01T08:00:00Z",
    action: { label: "审批低毛利" },
  },
  {
    id: "qt-old",
    quoteNo: "QT-OLD",
    customerName: "Nordic Retail",
    route: "Ningbo -> Hamburg",
    cargo: "FCL furniture",
    status: "sent",
    pricingStatus: "auto_calculated",
    approvalStatus: "approved",
    revenue: 2400,
    margin: 0.22,
    validUntil: "2026-07-20",
    createdAt: "2026-06-28T08:00:00Z",
    action: { label: "追客户回复" },
  },
  {
    id: "qt-new",
    quoteNo: "QT-NEW",
    customerName: "Nordic Retail",
    route: "Ningbo -> Hamburg",
    cargo: "FCL furniture",
    status: "draft",
    pricingStatus: "auto_calculated",
    approvalStatus: "pending",
    revenue: 2500,
    margin: 0.24,
    validUntil: "2026-07-31",
    createdAt: "2026-07-01T09:00:00Z",
    action: { label: "今天发出" },
  },
  {
    id: "qt-accepted",
    quoteNo: "QT-WON",
    customerName: "Baltic Buyer",
    route: "PVG -> FRA",
    cargo: "Air cargo",
    status: "accepted",
    pricingStatus: "auto_calculated",
    approvalStatus: "approved",
    revenue: 3200,
    margin: 0.25,
    validUntil: "2026-07-30",
    createdAt: "2026-07-01T10:00:00Z",
    action: { label: "转订单" },
  },
]);

const checks = [
  [
    "rail pricing totals revenue cost and profit",
    railPricing.summary.estimated_revenue_total === 2480 &&
      railPricing.summary.estimated_cost_total === 1800 &&
      railPricing.summary.estimated_profit_total === 680,
  ],
  [
    "rail pricing margin uses profit over revenue",
    Number(railPricing.summary.estimated_profit_margin.toFixed(4)) === 0.2742,
  ],
  [
    "healthy margin gets demo warning not approval warning",
    railPricing.warnings[0].includes("本地演示价格"),
  ],
  [
    "low margin pricing triggers approval warning",
    Number(lowMarginPricing.summary.estimated_profit_margin.toFixed(2)) === 0.1 &&
      lowMarginPricing.warnings[0].includes("毛利率低于建议目标"),
  ],
  [
    "order draft carries pricing snapshot into order lifecycle",
    orderDraft.estimated_revenue_total === 2480 &&
      orderDraft.estimated_cost_total === 1800 &&
      orderDraft.estimated_profit_total === 680,
  ],
  [
    "order draft preserves customer route and cargo measures",
    orderDraft.customer === "Acme GmbH" &&
      orderDraft.origin === "Xi'an" &&
      orderDraft.destination === "Duisburg" &&
      orderDraft.volume_cbm === 12.5 &&
      orderDraft.weight_kg === 2800,
  ],
  [
    "quote version output ranks low margin approval first",
    versionRows[0].id === "qt-low" &&
      versionRows[0].output.priority === "P1" &&
      versionRows[0].output.outputStatus === "待审批" &&
      versionRows[0].output.risks.includes("低毛利待审批"),
  ],
  [
    "quote version output catches stale sent version",
    versionRows.find((row) => row.id === "qt-old").output.hasNewerVersion === true &&
      versionRows.find((row) => row.id === "qt-old").output.risks.includes("已有更新版本，旧版需复核"),
  ],
  [
    "quote version output marks accepted quote ready to order",
    versionRows.find((row) => row.id === "qt-accepted").output.outputStatus === "可转订单" &&
      versionRows.find((row) => row.id === "qt-accepted").output.priority === "P3",
  ],
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
  console.error(`\nQuote pricing check: ${failures} failed, ${checks.length} total.`);
  process.exit(1);
}

console.log(`\nQuote pricing check: 0 failed, ${checks.length} total.`);
