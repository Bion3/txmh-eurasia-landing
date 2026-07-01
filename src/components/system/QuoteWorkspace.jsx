import { useEffect, useMemo, useState } from "react";
import { useConvertQuoteToOrder, useCreateQuote, useQuoteDetail, useQuoteList, useRecordQuoteOutput, useSendQuote, useSubmitQuoteApproval } from "../../hooks/useQuotes";
import { useRecalculatePricing } from "../../hooks/usePricing";
import { useRpcConvertQuoteToOrder } from "../../hooks/useSystemRpc";
import { priceManagementModules, quotePreviewByMode } from "../../system/mockData";

function InfoChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-900">{value || "-"}</div>
    </div>
  );
}

function CurrencyLine({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

function resolveCustomerId(context) {
  if (context?.customer_id) return context.customer_id;
  if (context?.customer_no && context?.id) return context.id;
  return undefined;
}

function resolveContactId(context) {
  if (context?.contact_id) return context.contact_id;
  if (context?.contacts?.[0]?.id) return context.contacts[0].id;
  return undefined;
}

function resolveLeadId(context) {
  if (context?.lead_id) return context.lead_id;
  if (context?.lead_no && context?.id) return context.id;
  return undefined;
}

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
    }
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

function isPersistedQuote(quote) {
  return Boolean(quote?.id && !String(quote.id).startsWith("local-"));
}

function appendRemark(quote, text) {
  return [quote?.remarks, text].filter(Boolean).join("\n");
}

function transportModeLabel(mode) {
  const labels = {
    rail: "Rail",
    sea: "Sea",
    air: "Air",
  };
  return labels[mode] || mode || "Rail";
}

function formatQuoteMoney(value, currency = "USD") {
  return `${currency} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseQuoteDateMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function quoteAgeLabel(value) {
  const ms = parseQuoteDateMs(value);
  if (!ms) return "时间待补";
  const ageDays = Math.max(0, Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000)));
  if (ageDays === 0) return "今天";
  if (ageDays === 1) return "1天前";
  return `${ageDays}天前`;
}

function quoteRoute(quote) {
  return [quote?.origin, quote?.destination].filter(Boolean).join(" -> ") || "路线待补";
}

function quoteCustomerName(quote) {
  return quote?.customer_name || quote?.company_name || quote?.customer?.company_name || quote?.quote_no || "未命名报价";
}

function quoteMarginValue(quote) {
  const direct = Number(quote?.estimated_profit_margin);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const revenue = Number(quote?.estimated_revenue_total || 0);
  const profit = Number(quote?.estimated_profit_total || revenue - Number(quote?.estimated_cost_total || 0));
  return revenue > 0 ? profit / revenue : 0;
}

function normalizeQuoteQueueRow(quote, source = "remote") {
  const margin = quoteMarginValue(quote);
  const status = quote?.status || "draft";
  const pricingStatus = quote?.pricing_status || "pending";
  const approvalStatus = quote?.approval_status || "pending";
  const createdAt = quote?.created_at || quote?.updated_at || "";
  const row = {
    id: quote?.id || `${source}-${quote?.quote_no || Date.now()}`,
    quoteNo: quote?.quote_no || (source === "current" ? "当前报价预览" : "报价号待生成"),
    customerName: quoteCustomerName(quote),
    route: quoteRoute(quote),
    cargo: quote?.cargo_desc || "货物待补",
    status,
    pricingStatus,
    approvalStatus,
    currency: quote?.currency || "USD",
    revenue: Number(quote?.estimated_revenue_total || 0),
    profit: Number(quote?.estimated_profit_total || 0),
    margin,
    marginLabel: `${(margin * 100).toFixed(1)}%`,
    validUntil: quote?.valid_until || "",
    createdAt,
    ageLabel: quoteAgeLabel(createdAt),
    isCurrent: source === "current",
    isLocal: String(quote?.id || "").startsWith("local-") || source === "current",
    raw: quote,
  };

  return {
    ...row,
    action: getQuoteFollowUpAction(row),
  };
}

function getQuoteFollowUpAction(row) {
  const isLowMargin = row.margin > 0 && row.margin < 0.18;
  const isApprovalRequested = row.pricingStatus === "approval_requested" || row.approvalStatus === "pending_approval";

  if (isLowMargin || isApprovalRequested) {
    return {
      priority: "P1",
      label: "审批低毛利",
      tone: "rose",
      nextAction: "先确认成本、卖价和服务范围，低毛利报价必须复核后再发给客户。",
    };
  }

  if (row.status === "draft" || row.status === "pricing_preview") {
    return {
      priority: "P1",
      label: "今天发出",
      tone: "amber",
      nextAction: "复制客户报价邮件或保存 PDF，今天发给客户并记录首次报价时间。",
    };
  }

  if (row.status === "sent") {
    return {
      priority: "P1",
      label: "追客户回复",
      tone: "sky",
      nextAction: "用邮件或 WhatsApp 追问是否接受价格、发货时间和收货地址，48小时内推进接受/修改/丢失。",
    };
  }

  if (["accepted", "approved", "won"].includes(row.status) || row.approvalStatus === "approved") {
    return {
      priority: "P1",
      label: "转订单",
      tone: "emerald",
      nextAction: "立即转订单，锁定成本快照并把操作节点、应收应付带入后续链路。",
    };
  }

  return {
    priority: "P2",
    label: "复盘报价",
    tone: "slate",
    nextAction: "确认该报价是否还有效，补客户反馈、失效原因或下一版价格。",
  };
}

function quoteActionClass(tone) {
  switch (tone) {
    case "rose":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function quotePriorityRank(priority) {
  if (priority === "P1") return 1;
  if (priority === "P2") return 2;
  return 3;
}

function buildQuoteFollowUpPlan(rows, summary) {
  if (!rows.length) return "";

  const today = new Date().toISOString().slice(0, 10);
  const sortedRows = [...rows].sort(
    (a, b) =>
      quotePriorityRank(a.action.priority) - quotePriorityRank(b.action.priority) ||
      (a.margin || 1) - (b.margin || 1) ||
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );

  return [
    `报价跟进行动清单 ${today}`,
    `总报价：${summary.total}｜草稿待发：${summary.draftCount}｜待审批/低毛利：${summary.riskCount}｜已发送待追：${summary.sentCount}｜可转订单：${summary.readyToOrderCount}`,
    "",
    ...sortedRows.slice(0, 12).map((row, index) => [
      `${index + 1}. ${row.quoteNo}｜${row.customerName}｜${row.action.priority} ${row.action.label}`,
      `   路线：${row.route}`,
      `   货物：${row.cargo}`,
      `   金额/毛利：${formatQuoteMoney(row.revenue, row.currency)} / ${row.marginLabel}`,
      `   状态：${row.status} / ${row.pricingStatus} / ${row.approvalStatus}｜${row.ageLabel}`,
      `   下一步：${row.action.nextAction}`,
    ].join("\n")),
    "",
    "执行建议：先处理低毛利和待审批，再把草稿发出，最后追踪 sent 报价是否接受；已接受报价当天转订单。",
  ].join("\n");
}

function quoteVersionKey(row) {
  return [
    row.customerName || "customer",
    row.route || "route",
    row.cargo || "cargo",
  ].join("|").toLowerCase();
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
  const isReadyToOrder = row.action.label === "转订单";

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

  const nextAction =
    priority === "P1"
      ? "先完成审批、金额和客户版报价校验，再输出邮件/PDF 或转订单。"
      : priority === "P2"
        ? "本周锁定报价编号、有效期和客户版输出，避免多版本混用。"
        : isReadyToOrder
          ? "当天转订单并锁定成本快照。"
          : "保持客户跟进节奏，记录回复并在有效期前复盘。";

  return {
    score: normalizedScore,
    grade,
    priority,
    versionCount: sameVersions.length,
    hasNewerVersion,
    outputStatus,
    risks: risks.length ? risks : ["版本、审批、客户版输出和转单状态健康"],
    nextAction,
    metrics: [
      { label: "版本锁定", value: hasQuoteNo && !hasNewerVersion ? 100 : hasQuoteNo ? 75 : 45 },
      { label: "审批状态", value: isLowMargin || isApprovalPending ? 40 : 100 },
      { label: "客户输出", value: hasCustomer && hasRoute && hasRevenue && hasValidUntil ? 100 : 60 },
      { label: "转单准备", value: isReadyToOrder ? 100 : isSent ? 75 : isDraft ? 45 : 65 },
    ],
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

function buildQuoteVersionOutputPlan(rows) {
  const actionRows = rows.filter((row) => row.output.priority !== "P3");
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `报价版本/正式输出清单 ${today}`,
    `P1 ${rows.filter((row) => row.output.priority === "P1").length} 项 · P2 ${rows.filter((row) => row.output.priority === "P2").length} 项`,
    "",
  ];

  if (!actionRows.length) {
    lines.push("当前报价版本、审批和客户版输出状态稳定。");
  } else {
    actionRows.slice(0, 10).forEach((row, index) => {
      lines.push(`${index + 1}. [${row.output.priority}] ${row.quoteNo}｜${row.customerName}｜${row.output.outputStatus}｜${row.output.score}/${row.output.grade}`);
      lines.push(`   路线：${row.route}`);
      lines.push(`   风险：${row.output.risks.join("、")}`);
      lines.push(`   下一步：${row.output.nextAction}`);
    });
  }

  lines.push("");
  lines.push("输出建议：正式发客户前确认报价编号、有效期、审批状态、客户版 PDF/邮件内容；已接受报价当天转订单。");
  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function QuoteWorkspace({ lead, selectedQuoteId, onBackToLeads, onOpenQuote, onNotify }) {
  const [form, setForm] = useState(() => ({
    customer_name: lead?.company_name || "",
    contact_name: lead?.contact_name || "",
    transport_mode: lead?.transport_mode_interest || "rail",
    shipment_type: lead?.shipment_type_interest || "LCL",
    incoterm: "EXW",
    origin: lead?.origin || "",
    destination: lead?.destination || "",
    cargo_desc: lead?.cargo_desc || "",
    volume_cbm: lead?.volume_cbm || "",
    weight_kg: lead?.weight_kg || "",
    service_customs: true,
    service_delivery: true,
  }));
  const [pricingPreview, setPricingPreview] = useState(() => buildFallbackPricing({
    transport_mode: lead?.transport_mode_interest || "rail",
  }));
  const [savedQuote, setSavedQuote] = useState(null);
  const [quoteFollowUpPlanText, setQuoteFollowUpPlanText] = useState("");
  const [quoteOutputPlanText, setQuoteOutputPlanText] = useState("");

  const recalculateMutation = useRecalculatePricing();
  const createQuoteMutation = useCreateQuote();
  const sendQuoteMutation = useSendQuote();
  const submitApprovalMutation = useSubmitQuoteApproval();
  const recordQuoteOutputMutation = useRecordQuoteOutput();
  const convertQuoteMutation = useConvertQuoteToOrder(savedQuote?.id);
  const convertQuoteRpcMutation = useRpcConvertQuoteToOrder();
  const quoteListQuery = useMemo(() => ({ page: 1, page_size: 12 }), []);
  const {
    data: quoteListData,
    isError: quoteListError,
    isLoading: isQuoteListLoading,
  } = useQuoteList(quoteListQuery);
  const { data: selectedQuoteDetail } = useQuoteDetail(selectedQuoteId);

  useEffect(() => {
    if (!lead) return;

    setForm({
      customer_name: lead.company_name || "",
      contact_name: lead.contact_name || "",
      transport_mode: lead.transport_mode_interest || "rail",
      shipment_type: lead.shipment_type_interest || "LCL",
      incoterm: "EXW",
      origin: lead.origin || "",
      destination: lead.destination || "",
      cargo_desc: lead.cargo_desc || "",
      volume_cbm: lead.volume_cbm || "",
      weight_kg: lead.weight_kg || "",
      service_customs: true,
      service_delivery: true,
    });

    setPricingPreview(
      buildFallbackPricing({
        transport_mode: lead.transport_mode_interest || "rail",
      })
    );
    setSavedQuote(null);
  }, [lead]);

  useEffect(() => {
    if (!selectedQuoteDetail) return;

    setSavedQuote(selectedQuoteDetail);
    setForm({
      customer_name: quoteCustomerName(selectedQuoteDetail),
      contact_name: selectedQuoteDetail.contact_name || "",
      transport_mode: selectedQuoteDetail.transport_mode || "rail",
      shipment_type: selectedQuoteDetail.shipment_type || "LCL",
      incoterm: selectedQuoteDetail.incoterm || "EXW",
      origin: selectedQuoteDetail.origin || "",
      destination: selectedQuoteDetail.destination || "",
      cargo_desc: selectedQuoteDetail.cargo_desc || "",
      volume_cbm: selectedQuoteDetail.volume_cbm || "",
      weight_kg: selectedQuoteDetail.weight_kg || "",
      service_customs: true,
      service_delivery: true,
    });
    setPricingPreview({
      matched_rate_sheet_name: selectedQuoteDetail.rate_sheet_name || selectedQuoteDetail.matched_rate_sheet_name || "已保存报价",
      pricing_status: selectedQuoteDetail.pricing_status || "saved",
      currency: selectedQuoteDetail.currency || "USD",
      items: selectedQuoteDetail.items || [],
      summary: {
        estimated_revenue_total: Number(selectedQuoteDetail.estimated_revenue_total || 0),
        estimated_cost_total: Number(selectedQuoteDetail.estimated_cost_total || 0),
        estimated_profit_total: Number(selectedQuoteDetail.estimated_profit_total || 0),
        estimated_profit_margin: quoteMarginValue(selectedQuoteDetail),
      },
      warnings: selectedQuoteDetail.pricing_status === "approval_requested"
        ? ["该报价已提交审批，发送或转订单前请确认审批结果。"]
        : ["正在查看已保存报价；如需重新核价，请点击重新核价后再保存新版草稿。"],
    });
  }, [selectedQuoteDetail]);

  const marginPercent = useMemo(() => {
    const margin = pricingPreview?.summary?.estimated_profit_margin || 0;
    return `${(margin * 100).toFixed(1)}%`;
  }, [pricingPreview]);

  const quoteQueueRows = useMemo(() => {
    const currentQuote = pricingPreview
      ? {
          ...(savedQuote || {}),
          id: savedQuote?.id || "current-pricing-preview",
          quote_no: savedQuote?.quote_no || "当前报价预览",
          status: savedQuote?.status || "pricing_preview",
          pricing_status: savedQuote?.pricing_status || pricingPreview.pricing_status || "preview",
          approval_status: savedQuote?.approval_status || "pending",
          customer_name: form.customer_name,
          contact_name: form.contact_name,
          origin: form.origin,
          destination: form.destination,
          cargo_desc: form.cargo_desc,
          currency: pricingPreview.currency || savedQuote?.currency || "USD",
          estimated_revenue_total: pricingPreview.summary?.estimated_revenue_total || savedQuote?.estimated_revenue_total || 0,
          estimated_cost_total: pricingPreview.summary?.estimated_cost_total || savedQuote?.estimated_cost_total || 0,
          estimated_profit_total: pricingPreview.summary?.estimated_profit_total || savedQuote?.estimated_profit_total || 0,
          estimated_profit_margin: pricingPreview.summary?.estimated_profit_margin || savedQuote?.estimated_profit_margin || 0,
          created_at: savedQuote?.created_at || new Date().toISOString(),
        }
      : null;
    const remoteQuotes = quoteListData?.items || [];
    const seen = new Set();
    const rows = [
      currentQuote ? normalizeQuoteQueueRow(currentQuote, "current") : null,
      ...remoteQuotes.map((quote) => normalizeQuoteQueueRow(quote, "remote")),
    ].filter(Boolean);

    return rows.filter((row) => {
      const key = row.id || row.quoteNo;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort(
      (a, b) =>
        quotePriorityRank(a.action.priority) - quotePriorityRank(b.action.priority) ||
        Number(b.isCurrent) - Number(a.isCurrent) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
  }, [form.cargo_desc, form.customer_name, form.destination, form.origin, pricingPreview, quoteListData?.items, savedQuote]);

  const quoteQueueSummary = useMemo(() => {
    const draftCount = quoteQueueRows.filter((row) => ["draft", "pricing_preview"].includes(row.status)).length;
    const riskCount = quoteQueueRows.filter((row) => row.action.label === "审批低毛利").length;
    const sentCount = quoteQueueRows.filter((row) => row.status === "sent").length;
    const readyToOrderCount = quoteQueueRows.filter((row) => row.action.label === "转订单").length;

    return {
      total: quoteQueueRows.length,
      draftCount,
      riskCount,
      sentCount,
      readyToOrderCount,
    };
  }, [quoteQueueRows]);
  const quoteOutputRows = useMemo(() => buildQuoteVersionOutputRows(quoteQueueRows), [quoteQueueRows]);
  const quoteOutputSummary = useMemo(
    () => ({
      p1: quoteOutputRows.filter((row) => row.output.priority === "P1").length,
      p2: quoteOutputRows.filter((row) => row.output.priority === "P2").length,
      outputReady: quoteOutputRows.filter((row) => ["可正式发送", "已发待追", "可转订单"].includes(row.output.outputStatus)).length,
      newerVersionRisk: quoteOutputRows.filter((row) => row.output.hasNewerVersion).length,
    }),
    [quoteOutputRows],
  );

  const matchedPriceModules = useMemo(() => {
    if (form.shipment_type === "FCL") {
      return priceManagementModules.filter((module) =>
        ["fcl_rail_cost", "fcl_rail_sell", "fcl_trailer", "delivery_oversea"].includes(module.id)
      );
    }

    if (form.shipment_type === "LCL") {
      return priceManagementModules.filter((module) =>
        ["lcl_freight", "lcl_line", "delivery_oversea"].includes(module.id)
      );
    }

    return priceManagementModules.filter((module) => module.id === "delivery_oversea");
  }, [form.shipment_type]);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRecalculate = async () => {
    const payload = {
      transport_mode: form.transport_mode,
      shipment_type: form.shipment_type,
      incoterm: form.incoterm,
      origin: form.origin,
      destination: form.destination,
      cargo_desc: form.cargo_desc,
      container_type: form.container_type,
      volume_cbm: Number(form.volume_cbm || 0),
      weight_kg: Number(form.weight_kg || 0),
      customer_id: resolveCustomerId(lead),
      min_margin: 0.18,
      service_options: {
        customs: form.service_customs,
        delivery: form.service_delivery,
      },
    };

    try {
      const result = await recalculateMutation.mutateAsync(payload);
      setPricingPreview(result);
    } catch (error) {
      setPricingPreview(buildFallbackPricing(payload));
    }
  };

  const saveQuoteDraft = async () => {
    if (!pricingPreview) return null;

    const resolvedCustomerId = resolveCustomerId(lead);
    const resolvedContactId = resolveContactId(lead);

    const payload = {
      lead_id: resolveLeadId(lead),
      customer_id: resolvedCustomerId,
      contact_id: resolvedContactId,
      customer_name: form.customer_name,
      contact_name: form.contact_name,
      email: lead?.email,
      phone: lead?.phone,
      source_type: lead?.source_type,
      transport_mode: form.transport_mode,
      shipment_type: form.shipment_type,
      incoterm: form.incoterm,
      origin: form.origin,
      destination: form.destination,
      cargo_desc: form.cargo_desc,
      container_type: form.container_type,
      volume_cbm: Number(form.volume_cbm || 0),
      weight_kg: Number(form.weight_kg || 0),
      currency: pricingPreview.currency || "USD",
      valid_until: "2026-06-30",
      remarks: "Draft generated from system workspace MVP",
      rate_sheet_id: pricingPreview.matched_rate_sheet_id,
      pricing_status: pricingPreview.pricing_status || "auto_calculated",
      items: (pricingPreview.items || []).map((item) => ({
        rate_sheet_item_id: item.rate_sheet_item_id,
        fee_code: item.fee_code,
        fee_name: item.fee_name,
        qty: item.qty,
        unit: item.unit,
        unit_price: item.unit_price,
        revenue_amount: item.revenue_amount,
        estimated_cost_amount: item.estimated_cost_amount,
      })),
    };

    try {
      const result = await createQuoteMutation.mutateAsync(payload);
      setSavedQuote(result);
      return result;
    } catch (error) {
      const localQuote = {
        ...payload,
        id: `local-quote-${Date.now()}`,
        quote_no: "LOCAL-QT-DRAFT",
        status: "draft",
        approval_status: "pending",
      };
      setSavedQuote(localQuote);
      return localQuote;
    }
  };

  const handleSaveDraft = async () => {
    const result = await saveQuoteDraft();
    if (!result) return;

    onNotify?.({
      type: isPersistedQuote(result) ? "success" : "info",
      title: isPersistedQuote(result) ? "报价草稿已保存" : "报价草稿已暂存本地",
      message: isPersistedQuote(result)
        ? `草稿 ${result.quote_no || result.id || "quote"} 已生成，可进入审核或发送流程。`
        : `${form.customer_name || "当前线索"} 的报价草稿已在工作台生成，连接数据库后可直接持久化。`,
    });

    if (isPersistedQuote(result)) {
      onOpenQuote?.(result.id);
    }
  };

  const ensureQuoteDraft = async () => savedQuote || saveQuoteDraft();

  const handleCopyQuoteFollowUpPlan = async () => {
    const text = buildQuoteFollowUpPlan(quoteQueueRows, quoteQueueSummary);

    if (!text) {
      onNotify?.({
        type: "info",
        title: "暂无报价队列",
        message: "先核算或保存一个报价后，再生成报价跟进行动清单。",
      });
      return;
    }

    setQuoteFollowUpPlanText(text);

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "报价行动清单已复制",
        message: "已按低毛利、草稿待发、已发送待追和可转订单整理，可直接发给销售执行。",
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，已在页面展开行动清单，可手动选中复制。",
      });
    }
  };

  const handleOpenQuoteRow = (row) => {
    if (!row || row.isCurrent || row.isLocal) return;

    setSavedQuote(row.raw);
    onOpenQuote?.(row.id);
  };

  const handleCopyQuoteOutputPlan = async () => {
    const text = buildQuoteVersionOutputPlan(quoteOutputRows);

    setQuoteOutputPlanText(text);

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "报价输出清单已复制",
        message: "已按报价版本、审批状态、客户版输出和转单准备整理，可同步给销售或主管。",
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，已在页面展开正式输出清单，可手动复制。",
      });
    }
  };

  const buildCustomerQuote = (quote = savedQuote) => {
    const currency = pricingPreview?.currency || quote?.currency || "USD";
    const quoteNo = quote?.quote_no || (quote?.id && !String(quote.id).startsWith("local-") ? quote.id : "DRAFT");
    const validUntil = quote?.valid_until || "2026-06-30";
    const items = pricingPreview?.items || quote?.items || [];
    const total = pricingPreview?.summary?.estimated_revenue_total || items.reduce((sum, item) => sum + Number(item.revenue_amount || 0), 0);
    const route = [form.origin || "-", form.destination || "-"].join(" -> ");
    const subject = `EurasiaGo quotation ${quoteNo} - ${route}`;
    const itemLines = items.length
      ? items.map((item) => {
          const qty = `${item.qty || 1} ${item.unit || "unit"}`;
          return `- ${item.fee_name || item.fee_code || "Service"}: ${qty} x ${formatQuoteMoney(item.unit_price, currency)} = ${formatQuoteMoney(item.revenue_amount, currency)}`;
        })
      : ["- Service fee: pending final pricing confirmation"];
    const body = [
      form.contact_name ? `Hi ${form.contact_name},` : "Hi,",
      "",
      "Thank you for your logistics inquiry. Please find our quotation below:",
      "",
      `Quote No: ${quoteNo}`,
      `Customer: ${form.customer_name || "-"}`,
      `Route: ${route}`,
      `Service: ${transportModeLabel(form.transport_mode)} / ${form.shipment_type || "LCL"} / ${form.incoterm || "EXW"}`,
      `Cargo: ${form.cargo_desc || "To be confirmed"}`,
      `Volume / Weight: ${form.volume_cbm || 0} CBM / ${form.weight_kg || 0} KG`,
      `Valid Until: ${validUntil}`,
      "",
      "Charges:",
      ...itemLines,
      "",
      `Total Estimated Amount: ${formatQuoteMoney(total, currency)}`,
      "",
      "Notes:",
      "- Final price is subject to cargo details, space availability, exchange rate, and carrier/supplier confirmation.",
      "- Customs duty, tax, inspection, storage, demurrage, and special handling are excluded unless clearly listed above.",
      "- Please confirm cargo ready date, pickup address, delivery address, and consignee details before booking.",
      "",
      "Best regards,",
      "EurasiaGo Logistics Team",
    ].join("\n");

    return {
      subject,
      body,
      currency,
      quoteNo,
      validUntil,
      items,
      total,
      route,
    };
  };

  const recordFormalQuoteOutput = async (quote, channel, customerQuote) => {
    if (!isPersistedQuote(quote)) return null;

    const result = await recordQuoteOutputMutation.mutateAsync({
      quoteId: quote.id,
      output_type: "customer_pdf",
      channel,
      recipient_email: form.email || null,
      content_hash: `${quote.quote_no || quote.id}-${quote.version_no || 1}-${customerQuote.total || 0}`,
      remarks: `客户版报价${channel === "email" ? "邮件" : "PDF"}已生成：${customerQuote.quoteNo}`,
    });
    setSavedQuote({ ...quote, ...result });
    return result;
  };

  const handleCopyQuoteEmail = async () => {
    if (!pricingPreview) {
      onNotify?.({
        type: "info",
        title: "请先核算报价",
        message: "生成客户邮件前需要先有报价预览。",
      });
      return;
    }

    const quote = savedQuote || (await saveQuoteDraft());
    const customerQuote = buildCustomerQuote(quote);
    const { subject, body } = customerQuote;
    const text = [`Subject: ${subject}`, "", body].join("\n");

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，请使用打印报价单或手动复制页面内容。",
      });
      return;
    }

    try {
      await recordFormalQuoteOutput(quote, "email", customerQuote);
      onNotify?.({
        type: "success",
        title: "报价邮件已复制",
        message: `${quote?.quote_no || "当前报价"} 的客户版主题和正文已复制，并已归档正式输出记录。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "报价邮件已复制，归档未同步",
        message: error.message || "剪贴板已复制成功，但正式输出归档写入失败，请确认登录权限。",
      });
    }
  };

  const handlePrintQuote = async () => {
    if (!pricingPreview) {
      onNotify?.({
        type: "info",
        title: "请先核算报价",
        message: "打印客户报价单前需要先有报价预览。",
      });
      return;
    }

    const quote = savedQuote || (await saveQuoteDraft());
    const customerQuote = buildCustomerQuote(quote);
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      onNotify?.({
        type: "info",
        title: "浏览器阻止了报价单窗口",
        message: "请允许弹窗后重试，或先复制报价邮件。",
      });
      return;
    }

    const itemRows = customerQuote.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.fee_name || item.fee_code || "Service")}</td>
        <td>${escapeHtml(item.qty || 1)} ${escapeHtml(item.unit || "unit")}</td>
        <td>${escapeHtml(formatQuoteMoney(item.unit_price, customerQuote.currency))}</td>
        <td>${escapeHtml(formatQuoteMoney(item.revenue_amount, customerQuote.currency))}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(customerQuote.subject)}</title>
          <style>
            body { color: #0f172a; font-family: Georgia, "Times New Roman", serif; margin: 0; padding: 40px; }
            .quote { border: 1px solid #dbe4f0; border-radius: 24px; padding: 32px; }
            .brand { color: #0f766e; font-size: 13px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
            h1 { font-size: 34px; margin: 12px 0 8px; }
            .muted { color: #64748b; }
            .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 28px 0; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; }
            .label { color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
            .value { font-size: 15px; font-weight: 700; margin-top: 6px; }
            table { border-collapse: collapse; margin-top: 20px; width: 100%; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            th { color: #64748b; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
            .total { background: #0f172a; border-radius: 18px; color: white; margin-top: 24px; padding: 18px; text-align: right; }
            .notes { color: #475569; font-size: 13px; line-height: 1.7; margin-top: 24px; }
            @media print { body { padding: 0; } .quote { border: 0; border-radius: 0; } }
          </style>
        </head>
        <body>
          <main class="quote">
            <div class="brand">EurasiaGo Logistics</div>
            <h1>Customer Quotation</h1>
            <p class="muted">${escapeHtml(customerQuote.subject)}</p>
            <section class="grid">
              <div class="box"><div class="label">Quote No</div><div class="value">${escapeHtml(customerQuote.quoteNo)}</div></div>
              <div class="box"><div class="label">Customer</div><div class="value">${escapeHtml(form.customer_name || "-")}</div></div>
              <div class="box"><div class="label">Route</div><div class="value">${escapeHtml(customerQuote.route)}</div></div>
              <div class="box"><div class="label">Service</div><div class="value">${escapeHtml(`${transportModeLabel(form.transport_mode)} / ${form.shipment_type || "LCL"} / ${form.incoterm || "EXW"}`)}</div></div>
              <div class="box"><div class="label">Cargo</div><div class="value">${escapeHtml(form.cargo_desc || "To be confirmed")}</div></div>
              <div class="box"><div class="label">Valid Until</div><div class="value">${escapeHtml(customerQuote.validUntil)}</div></div>
            </section>
            <table>
              <thead><tr><th>Charge</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
              <tbody>${itemRows}</tbody>
            </table>
            <div class="total">
              <div class="label">Total Estimated Amount</div>
              <div class="value">${escapeHtml(formatQuoteMoney(customerQuote.total, customerQuote.currency))}</div>
            </div>
            <div class="notes">
              <strong>Notes</strong>
              <p>Final price is subject to cargo details, space availability, exchange rate, and carrier/supplier confirmation. Customs duty, tax, inspection, storage, demurrage, and special handling are excluded unless clearly listed above.</p>
            </div>
          </main>
          <script>window.addEventListener("load", () => window.print());</script>
        </body>
      </html>
    `);
    printWindow.document.close();

    try {
      await recordFormalQuoteOutput(quote, "browser_print", customerQuote);
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "报价单已打开，归档未同步",
        message: error.message || "PDF 打印窗口已打开，但正式输出归档写入失败，请确认登录权限。",
      });
      return;
    }

    onNotify?.({
      type: "success",
      title: "客户报价单已打开",
      message: "可在浏览器打印窗口中选择保存为 PDF，系统已记录客户版输出归档。",
    });
  };

  const handleSendQuote = async () => {
    const quote = await ensureQuoteDraft();
    if (!quote) return;

    if (!isPersistedQuote(quote)) {
      const nextQuote = {
        ...quote,
        status: "sent",
        remarks: appendRemark(quote, `报价已标记发送：${new Date().toISOString().slice(0, 16).replace("T", " ")}`),
      };
      setSavedQuote(nextQuote);
      onNotify?.({
        type: "info",
        title: "报价已在本地标记发送",
        message: `${nextQuote.quote_no || "本地报价"} 已标记为已发送；登录并保存后可同步到数据库。`,
      });
      return;
    }

    try {
      const result = await sendQuoteMutation.mutateAsync({
        quoteId: quote.id,
        remarks: appendRemark(quote, `报价发送给客户：${form.customer_name || "客户"}`),
      });
      setSavedQuote({ ...quote, ...result });
      onNotify?.({
        type: "success",
        title: "报价已标记发送",
        message: `${result.quote_no || quote.quote_no || "报价"} 已更新为 sent，可继续跟进成交或转订单。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "真实报价状态更新失败",
        message: error.message || "数据库未更新，请确认登录账号具备报价编辑权限。",
      });
    }
  };

  const handleSubmitApproval = async () => {
    const quote = await ensureQuoteDraft();
    if (!quote) return;

    const approvalRemark = appendRemark(quote, `报价提交审批：毛利率 ${marginPercent}`);

    if (!isPersistedQuote(quote)) {
      const nextQuote = {
        ...quote,
        pricing_status: "approval_requested",
        approval_status: "pending",
        remarks: approvalRemark,
      };
      setSavedQuote(nextQuote);
      onNotify?.({
        type: "info",
        title: "审批请求已本地暂存",
        message: `${nextQuote.quote_no || "本地报价"} 已进入待审批状态；登录后可同步审批流。`,
      });
      return;
    }

    try {
      const result = await submitApprovalMutation.mutateAsync({
        quoteId: quote.id,
        remarks: approvalRemark,
      });
      setSavedQuote({ ...quote, ...result });
      onNotify?.({
        type: "success",
        title: "报价已提交审批",
        message: `${result.quote_no || quote.quote_no || "报价"} 已进入审批复核，重点检查毛利率 ${marginPercent}。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "真实审批状态更新失败",
        message: error.message || "数据库未更新，请确认登录账号具备报价编辑权限。",
      });
    }
  };

  const buildOrderDraft = (overrides = {}) => ({
    order_id: overrides.order_id,
    order_no: overrides.order_no || "OD202605270001",
    quote_id: savedQuote?.id || overrides.quote_id,
    quote_no: savedQuote?.quote_no || overrides.quote_no,
    customer_id: savedQuote?.customer_id || resolveCustomerId(lead),
    contact_id: savedQuote?.contact_id || resolveContactId(lead),
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
  });

  const handleConvertToOrder = async () => {
    if (!pricingPreview) return;

    if (savedQuote?.id) {
      try {
        const result = await convertQuoteRpcMutation.mutateAsync({
          quoteId: savedQuote.id,
        });
        onNotify?.({
          type: "success",
          title: "报价已转订单",
          message: `${result.order_no || result.order_id || "订单"} 已进入操作执行与财务结算链路。`,
          orderDraft: buildOrderDraft({
            order_id: result.order_id,
            order_no: result.order_no,
          }),
        });
        return;
      } catch (rpcError) {
        try {
          const result = await convertQuoteMutation.mutateAsync({});
          onNotify?.({
            type: "success",
            title: "报价已转订单",
            message: `${result.order_no || result.order_id || "订单"} 已进入操作执行与财务结算链路。`,
            orderDraft: buildOrderDraft({
              order_id: result.order_id,
              order_no: result.order_no,
            }),
          });
          return;
        } catch (restError) {
          onNotify?.({
            type: "info",
            title: "订单草稿已暂存本地",
            message: `实时转单暂不可用，已将 ${form.customer_name || "当前客户"} 作为订单草稿交给操作模块。`,
            orderDraft: buildOrderDraft(),
          });
          return;
        }
      }
    }

    onNotify?.({
      type: "success",
      title: "订单草稿已创建",
      message: `${form.customer_name || "当前客户"} 已进入订单管理模块。`,
      orderDraft: buildOrderDraft(),
    });
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
            报价中心
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">创建报价</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            报价中心把获客线索或客户资料转成结构化报价流程，支持手工调整、成本自动核算、毛利预览和一键转订单。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onBackToLeads}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            返回获客池
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            {createQuoteMutation.isPending ? "保存中..." : "保存报价草稿"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">报价跟进工作台</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              把当前报价和最近报价合成一个销售队列，优先处理低毛利/待审批、草稿未发、已发送待追和已接受待转订单，避免报价后没人跟。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyQuoteFollowUpPlan}
                className="rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                复制报价行动清单
              </button>
              <button
                type="button"
                onClick={handleCopyQuoteEmail}
                disabled={!pricingPreview || createQuoteMutation.isPending}
                className="rounded-2xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                复制当前报价邮件
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            <InfoChip label="报价队列" value={quoteQueueSummary.total} />
            <InfoChip label="草稿待发" value={quoteQueueSummary.draftCount} />
            <InfoChip label="待审/低毛利" value={quoteQueueSummary.riskCount} />
            <InfoChip label="已发待追" value={quoteQueueSummary.sentCount} />
            <InfoChip label="可转订单" value={quoteQueueSummary.readyToOrderCount} />
          </div>
        </div>

        {quoteListError ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            当前无法读取真实报价列表，工作台先使用当前报价预览/本地草稿。登录并分配报价权限后可查看完整队列。
          </div>
        ) : null}

        {quoteFollowUpPlanText ? (
          <section className="mt-5 rounded-3xl border border-sky-200 bg-white/80 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h4 className="text-base font-bold text-sky-950">报价行动清单</h4>
                <p className="mt-1 text-sm text-sky-700">
                  如果浏览器不允许自动复制，可以在这里选中文本同步给销售、主管或操作同事。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuoteFollowUpPlanText("")}
                className="self-start rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800"
              >
                收起
              </button>
            </div>
            <textarea
              readOnly
              value={quoteFollowUpPlanText}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-3 min-h-56 w-full rounded-2xl border border-sky-200 bg-white p-4 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </section>
        ) : null}

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {quoteQueueRows.slice(0, 3).map((row) => (
            <article key={`quote-action-${row.id}`} className={`rounded-3xl border p-4 ${quoteActionClass(row.action.tone)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{row.action.priority}</div>
                  <h4 className="mt-1 text-base font-bold">{row.action.label}</h4>
                </div>
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold">
                  {row.marginLabel} 毛利
                </span>
              </div>
              <div className="mt-3 font-semibold">{row.quoteNo}</div>
              <p className="mt-2 text-sm leading-6 opacity-85">{row.action.nextAction}</p>
              <p className="mt-2 text-xs leading-5 opacity-75">{row.customerName} · {row.route}</p>
            </article>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto rounded-3xl border border-sky-100 bg-white">
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="border-b border-sky-100 bg-sky-50/70 text-left text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
                <th className="px-4 py-3">报价</th>
                <th className="px-4 py-3">客户 / 路线</th>
                <th className="px-4 py-3 text-right">金额</th>
                <th className="px-4 py-3 text-right">毛利</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">建议</th>
              </tr>
            </thead>
            <tbody>
              {quoteQueueRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => handleOpenQuoteRow(row)}
                  className={`border-b border-slate-100 align-top text-slate-700 ${
                    row.isCurrent || row.isLocal ? "" : "cursor-pointer transition hover:bg-sky-50/70"
                  }`}
                >
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-950">{row.quoteNo}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.isCurrent ? "当前报价" : `${row.ageLabel} · 点击查看`}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-900">{row.customerName}</div>
                    <div className="mt-1 max-w-xs text-xs text-slate-500">{row.route}</div>
                    <div className="mt-1 max-w-xs text-xs text-slate-400">{row.cargo}</div>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-950">{formatQuoteMoney(row.revenue, row.currency)}</td>
                  <td className="px-4 py-4 text-right text-emerald-700">{row.marginLabel}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-800">{row.status}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.pricingStatus} / {row.approvalStatus}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${quoteActionClass(row.action.tone)}`}>
                      {row.action.priority} · {row.action.label}
                    </span>
                    <div className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{row.action.nextAction}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isQuoteListLoading ? (
          <div className="mt-3 text-xs text-slate-500">正在加载最近报价...</div>
        ) : null}
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Quote governance</div>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">报价版本 / 正式输出</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              把报价编号、审批状态、客户版邮件/PDF 和转单准备集中检查，避免多版本混用、低毛利未审或草稿报价直接发给客户。
            </p>
            <button
              type="button"
              onClick={handleCopyQuoteOutputPlan}
              className="mt-4 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              复制正式输出清单
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <InfoChip label="P1 阻断" value={quoteOutputSummary.p1} />
            <InfoChip label="P2 待复核" value={quoteOutputSummary.p2} />
            <InfoChip label="可输出/转单" value={quoteOutputSummary.outputReady} />
            <InfoChip label="旧版风险" value={quoteOutputSummary.newerVersionRisk} />
          </div>
        </div>

        {quoteOutputPlanText ? (
          <section className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-950">正式输出清单</h4>
                <p className="mt-1 text-sm text-slate-500">用于发客户前复核报价编号、审批、PDF/邮件和转单准备。</p>
              </div>
              <button
                type="button"
                onClick={() => setQuoteOutputPlanText("")}
                className="self-start rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                收起
              </button>
            </div>
            <textarea
              readOnly
              value={quoteOutputPlanText}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-3 min-h-48 w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </section>
        ) : null}

        <div className="mt-5 grid gap-3">
          {quoteOutputRows.slice(0, 5).map((row) => (
            <article key={`quote-output-${row.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.2fr_auto] lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${quoteActionClass(row.action.tone)}`}>
                      {row.output.priority}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {row.output.outputStatus}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-slate-950">{row.quoteNo}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{row.customerName} · {row.route}</div>
                  <div className="mt-1 text-xs text-slate-400">版本 {row.output.versionCount} · {row.marginLabel} 毛利</div>
                </div>

                <div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {row.output.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="text-[11px] font-semibold text-slate-500">{metric.label}</div>
                        <div className="mt-1 text-lg font-black text-slate-950">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.output.risks.map((risk) => (
                      <span key={risk} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {risk}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{row.output.nextAction}</p>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpenQuoteRow(row)}
                    disabled={row.isCurrent || row.isLocal}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    查看报价
                  </button>
                  <button
                    type="button"
                    onClick={
                      row.isCurrent || row.isLocal || row.id === savedQuote?.id
                        ? row.output.outputStatus === "可转订单"
                          ? handleConvertToOrder
                          : handleCopyQuoteEmail
                        : () => handleOpenQuoteRow(row)
                    }
                    className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                  >
                    {row.isCurrent || row.isLocal || row.id === savedQuote?.id
                      ? row.output.outputStatus === "可转订单"
                        ? "转订单"
                        : "输出客户版"
                      : "先查看报价"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-bold text-slate-900">线索上下文</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <InfoChip label="客户" value={form.customer_name} />
              <InfoChip label="联系人" value={form.contact_name} />
              <InfoChip label="路线" value={`${form.origin} → ${form.destination}`} />
              <InfoChip label="货物" value={form.cargo_desc} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-bold text-slate-900">运输方案</h3>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">运输方式</span>
                  <select
                    value={form.transport_mode}
                    onChange={(event) => handleChange("transport_mode", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="rail">铁路</option>
                    <option value="sea">海运</option>
                    <option value="air">空运</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">货型</span>
                  <select
                    value={form.shipment_type}
                    onChange={(event) => handleChange("shipment_type", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="LCL">拼箱</option>
                    <option value="FCL">整箱</option>
                    <option value="air_cargo">空运货物</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Incoterm</span>
                  <select
                    value={form.incoterm}
                    onChange={(event) => handleChange("incoterm", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="EXW">EXW</option>
                    <option value="FOB">FOB</option>
                    <option value="DDP">DDP</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-bold text-slate-900">货物数据</h3>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Volume (CBM)</span>
                  <input
                    value={form.volume_cbm}
                    onChange={(event) => handleChange("volume_cbm", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Weight (KG)</span>
                  <input
                    value={form.weight_kg}
                    onChange={(event) => handleChange("weight_kg", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.service_customs}
                    onChange={(event) => handleChange("service_customs", event.target.checked)}
                  />
                  包含报关服务
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.service_delivery}
                    onChange={(event) => handleChange("service_delivery", event.target.checked)}
                  />
                  包含末端派送
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">报价核算预览</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {pricingPreview?.matched_rate_sheet_name || "基础报价预览"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRecalculate}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {recalculateMutation.isPending ? "核算中..." : "重新核算"}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="py-3 pr-4">费用项</th>
                    <th className="py-3 pr-4">数量</th>
                    <th className="py-3 pr-4">单价</th>
                    <th className="py-3 pr-4">收入</th>
                    <th className="py-3 pr-4">成本</th>
                    <th className="py-3">利润</th>
                  </tr>
                </thead>
                <tbody>
                  {(pricingPreview?.items || []).map((item) => (
                    <tr key={item.fee_code} className="border-b border-slate-100 text-sm text-slate-700">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-slate-900">{item.fee_name}</div>
                        <div className="mt-1 text-xs text-slate-400">{item.fee_code}</div>
                      </td>
                      <td className="py-4 pr-4">{item.qty} {item.unit}</td>
                      <td className="py-4 pr-4">${item.unit_price}</td>
                      <td className="py-4 pr-4 font-medium text-slate-900">${item.revenue_amount}</td>
                      <td className="py-4 pr-4 text-slate-500">${item.estimated_cost_amount}</td>
                      <td className="py-4 font-semibold text-emerald-700">${item.profit_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">价格管理匹配</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  参考成熟系统，报价核算应先读取价格基础库，再生成收入、成本和毛利快照。
                </p>
              </div>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                {form.shipment_type} · {matchedPriceModules.length} 个价格库
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              {matchedPriceModules.map((module) => (
                <div key={module.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{module.title}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-500">{module.scope}</div>
                    </div>
                    <div className="max-w-sm rounded-2xl bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                      {module.quoteRole}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <h3 className="text-xl font-bold">毛利汇总</h3>
            <div className="mt-5 space-y-3">
              <CurrencyLine
                label="预计收入"
                value={`$${pricingPreview?.summary?.estimated_revenue_total?.toFixed?.(0) || 0}`}
                tone="text-white"
              />
              <CurrencyLine
                label="预计成本"
                value={`$${pricingPreview?.summary?.estimated_cost_total?.toFixed?.(0) || 0}`}
                tone="text-slate-300"
              />
              <CurrencyLine
                label="预计利润"
                value={`$${pricingPreview?.summary?.estimated_profit_total?.toFixed?.(0) || 0}`}
                tone="text-emerald-300"
              />
              <div className="rounded-2xl bg-white/5 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">毛利率</div>
                <div className="mt-2 text-3xl font-bold">{marginPercent}</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">风险提醒与下一步</h3>
            <div className="mt-4 grid gap-3">
              <InfoChip label="报价单号" value={savedQuote?.quote_no || "保存后生成"} />
              <InfoChip label="报价状态" value={savedQuote?.status || "draft"} />
              <InfoChip label="审批状态" value={savedQuote?.pricing_status === "approval_requested" ? "待审批复核" : savedQuote?.approval_status || "pending"} />
              <InfoChip label="版本锁定" value={selectedQuoteDetail?.versions?.length ? `${selectedQuoteDetail.versions.length} 个版本` : "保存后生成"} />
              <InfoChip label="审批审计" value={selectedQuoteDetail?.approval_events?.length ? `${selectedQuoteDetail.approval_events.length} 条记录` : "暂无记录"} />
              <InfoChip label="输出归档" value={selectedQuoteDetail?.output_documents?.length ? `${selectedQuoteDetail.output_documents.length} 份客户版` : "暂无归档"} />
            </div>

            <div className="mt-4 space-y-3">
              {(pricingPreview?.warnings || []).map((warning) => (
                <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {warning}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-3xl border border-sky-100 bg-sky-50 p-4">
              <div className="text-sm font-bold text-sky-950">客户报价输出</div>
              <p className="mt-1 text-xs leading-5 text-sky-700">
                生成给客户看的报价内容，只包含收入价格、路线和条款，不暴露成本与毛利。
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={handleCopyQuoteEmail}
                  disabled={createQuoteMutation.isPending}
                  className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  复制报价邮件
                </button>
                <button
                  type="button"
                  onClick={handlePrintQuote}
                  disabled={createQuoteMutation.isPending}
                  className="rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  打印/保存 PDF
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={handleSendQuote}
                disabled={createQuoteMutation.isPending || sendQuoteMutation.isPending}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendQuoteMutation.isPending ? "发送中..." : "发送报价草稿"}
              </button>
              <button
                type="button"
                onClick={handleSubmitApproval}
                disabled={createQuoteMutation.isPending || submitApprovalMutation.isPending}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitApprovalMutation.isPending ? "提交中..." : "提交审批"}
              </button>
              <button
                type="button"
                onClick={handleConvertToOrder}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              >
                {convertQuoteMutation.isPending || convertQuoteRpcMutation.isPending ? "转单中..." : "转为订单"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
