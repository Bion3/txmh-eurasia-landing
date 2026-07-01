import { useEffect, useMemo, useState } from "react";
import {
  useCreateCustomer,
  useCreateCustomerActivity,
  useCreateCustomerContact,
  useCustomerDetail,
  useCustomerList,
  useUpdateCustomer,
  useUpdateCustomerContact,
} from "../../hooks/useCustomers";
import { currentUserId } from "../../api/supabaseAdapter";

const customerStages = [
  ["all", "全部客户"],
  ["prospect", "潜在客户"],
  ["active", "成交客户"],
  ["inactive", "沉默客户"],
];

const emptyForm = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  customer_type: "direct",
  source_primary: "manual",
  status: "prospect",
};

const emptyEditForm = {
  company_name: "",
  company_name_en: "",
  customer_type: "direct",
  industry: "",
  country: "",
  city: "",
  address: "",
  website: "",
  tax_no: "",
  source_primary: "manual",
  status: "prospect",
  contact_name: "",
  contact_title: "",
  email: "",
  phone: "",
  whatsapp: "",
};

const customerTypeLabels = {
  direct: "直客",
  forwarder: "同行/货代",
  ecommerce: "跨境电商",
  agent: "代理",
};

const sourceLabels = {
  manual: "手工录入",
  website_form: "网站询盘",
  google_seo: "Google SEO",
  google_ads: "Google Ads",
  referral: "转介绍",
};

function buildEditForm(customer) {
  if (!customer) return emptyEditForm;

  const primaryContact = customer.contacts?.[0] || {};

  return {
    company_name: customer.company_name || "",
    company_name_en: customer.company_name_en || "",
    customer_type: customer.customer_type || "direct",
    industry: customer.industry || "",
    country: customer.country || "",
    city: customer.city || "",
    address: customer.address || "",
    website: customer.website || "",
    tax_no: customer.tax_no || "",
    source_primary: customer.source_primary || customer.source_type || "manual",
    status: customer.status || "prospect",
    contact_name: primaryContact.name || customer.contact_name || "",
    contact_title: primaryContact.title || customer.contact_title || "",
    email: primaryContact.email || customer.email || "",
    phone: primaryContact.phone || customer.phone || "",
    whatsapp: primaryContact.whatsapp || customer.whatsapp || "",
  };
}

function getCustomerTier(customer) {
  const quoteCount = customer?.quotes?.length || 0;
  const orderCount = customer?.orders?.length || 0;

  if (customer?.status === "active" || orderCount > 0) {
    return {
      label: "A类成交客户",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      action: "维护复购节奏，优先推送新价格和舱位。",
    };
  }

  if (quoteCount > 0 || customer?.status === "prospect") {
    return {
      label: "B类潜力客户",
      tone: "border-sky-200 bg-sky-50 text-sky-700",
      action: "报价后 3-7 天内二次邮件跟进，补路线偏好。",
    };
  }

  return {
    label: "C类待唤醒客户",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    action: "用价格更新或案例邮件重新激活。",
  };
}

function customerMissingFields(customer) {
  if (!customer) return [];

  return [
    ["联系人", customer.contact_name],
    ["邮箱", customer.email],
    ["国家", customer.country],
    ["行业", customer.industry],
    ["税号", customer.tax_no],
  ]
    .filter(([, value]) => !value)
    .map(([label]) => label);
}

function normalizeCustomerText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(limited|ltd|gmbh|inc|co|company|corp|corporation|llc|sarl|sas|spzoo|bv)\b/g, "")
    .replace(/有限公司|有限责任公司|物流|货运|国际|供应链/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function normalizeCustomerPhone(value) {
  return String(value || "").replace(/\D/g, "").replace(/^00/, "");
}

function customerIdentity(customer) {
  const primaryContact = customer?.contacts?.[0] || {};

  return {
    id: customer?.id || customer?.customer_id || customer?.customer_no || customer?.company_name,
    name: customer?.company_name || customer?.company_name_en || customer?.customer_no || "未命名客户",
    normalizedName: normalizeCustomerText(customer?.company_name || customer?.company_name_en),
    email: String(primaryContact.email || customer?.email || "").trim().toLowerCase(),
    phone: normalizeCustomerPhone(primaryContact.phone || customer?.phone || customer?.whatsapp),
    taxNo: normalizeCustomerText(customer?.tax_no),
    country: normalizeCustomerText(customer?.country),
    city: normalizeCustomerText(customer?.city),
  };
}

function sharedCustomerSignals(first, second) {
  const signals = [];

  if (first.email && first.email === second.email) signals.push(["同邮箱", 45]);
  if (first.phone && first.phone.length >= 7 && first.phone === second.phone) signals.push(["同电话", 35]);
  if (first.taxNo && first.taxNo === second.taxNo) signals.push(["同税号/VAT", 50]);

  if (first.normalizedName && second.normalizedName) {
    if (first.normalizedName === second.normalizedName) {
      signals.push(["公司名一致", 45]);
    } else {
      const shorter = first.normalizedName.length <= second.normalizedName.length ? first.normalizedName : second.normalizedName;
      const longer = first.normalizedName.length > second.normalizedName.length ? first.normalizedName : second.normalizedName;
      if (shorter.length >= 6 && longer.includes(shorter)) {
        signals.push(["公司名高度相似", 28]);
      }
    }
  }

  if (first.country && first.country === second.country) signals.push(["同国家", 8]);
  if (first.city && first.city === second.city) signals.push(["同城市", 6]);

  return signals;
}

function scoreCustomerDuplicatePair(primary, candidate) {
  const first = customerIdentity(primary);
  const second = customerIdentity(candidate);
  if (!first.id || !second.id || first.id === second.id) return null;

  const signals = sharedCustomerSignals(first, second);
  const score = Math.min(signals.reduce((sum, [, value]) => sum + value, 0), 100);
  if (score < 45) return null;

  const priority = score >= 75 ? "P1" : score >= 55 ? "P2" : "P3";

  return {
    primary,
    candidate,
    primaryId: first.id,
    candidateId: second.id,
    primaryName: first.name,
    candidateName: second.name,
    score,
    priority,
    reasons: signals.map(([label]) => label),
    suggestion:
      priority === "P1"
        ? "先核对税号、联系人、报价和订单归属，确认后进入合并审批。"
        : "补齐联系人和账务主体后再判断是否需要合并。",
  };
}

function buildCustomerDuplicateCandidates(customers) {
  const candidates = [];
  const list = customers || [];

  for (let firstIndex = 0; firstIndex < list.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < list.length; secondIndex += 1) {
      const result = scoreCustomerDuplicatePair(list[firstIndex], list[secondIndex]);
      if (result) candidates.push(result);
    }
  }

  return candidates
    .sort((first, second) => second.score - first.score || first.primaryName.localeCompare(second.primaryName))
    .slice(0, 8);
}

function duplicatePriorityClass(priority) {
  if (priority === "P1") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "P2") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function businessDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseCustomerDate(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function customerAgeDays(customer) {
  const timestamp =
    parseCustomerDate(customer?.last_activity_at) ||
    parseCustomerDate(customer?.updated_at) ||
    parseCustomerDate(customer?.created_at);
  if (!timestamp) return null;
  return Math.max(Math.floor((Date.now() - timestamp) / 86400000), 0);
}

function customerContactChannel(customer) {
  if (customer?.whatsapp || customer?.phone) return "WhatsApp / 电话";
  if (customer?.email) return "邮件";
  return "补联系人";
}

function getCustomerGrowthAction(customer) {
  const ageDays = customerAgeDays(customer);
  const ageLabel = ageDays === null ? "最近互动未知" : `${ageDays} 天未更新`;

  if (customer?.status === "inactive") {
    return {
      priority: "P1",
      queue: "reactivation",
      label: "唤醒沉睡客户",
      timing: ageLabel,
      nextAction: "发送新价格、热门线路或同行案例，询问未来 30 天是否有中国到欧洲货量。",
    };
  }

  if (customer?.status === "prospect" && (ageDays === null || ageDays >= 7)) {
    return {
      priority: "P1",
      queue: "stale_prospect",
      label: "推进潜在客户",
      timing: ageLabel,
      nextAction: "补齐路线、货量和发货窗口，给出一个可回复的具体方案并推动首次报价。",
    };
  }

  if (customer?.status === "active" && (ageDays === null || ageDays >= 14)) {
    return {
      priority: "P2",
      queue: "repurchase",
      label: "争取复购",
      timing: ageLabel,
      nextAction: "同步近期价格和舱位，询问下一批补货计划，并直接准备复购报价。",
    };
  }

  if (!customer?.country || !customer?.customer_type) {
    return {
      priority: "P3",
      queue: "profile_gap",
      label: "补齐客户画像",
      timing: ageLabel,
      nextAction: "补国家、客户类型和行业，方便匹配线路、报价策略和后续营销内容。",
    };
  }

  return {
    priority: "P3",
    queue: "maintain",
    label: "保持关系",
    timing: ageLabel,
    nextAction: "维持当前跟进节奏，记录客户下一次采购窗口和偏好线路。",
  };
}

function customerActionClass(priority) {
  if (priority === "P1") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "P2") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function customerActionRank(row) {
  const priorityRank = { P1: 0, P2: 1, P3: 2 };
  const queueRank = { reactivation: 0, stale_prospect: 1, repurchase: 2, profile_gap: 3, maintain: 4 };
  return (priorityRank[row.action.priority] ?? 9) * 100 + (queueRank[row.action.queue] ?? 50);
}

function buildCustomerGrowthPlan(rows, summary) {
  const lines = [
    `客户复购/唤醒行动清单 ${businessDate()}`,
    `客户：${summary.total}｜沉睡待唤醒：${summary.inactiveCount}｜成交待复购：${summary.activeCount}｜潜在待推进：${summary.prospectCount}`,
    "",
  ];

  if (!rows.length) {
    lines.push("当前筛选没有可执行客户，请切换到全部客户或先从线索转入客户。");
  } else {
    rows.slice(0, 10).forEach((row, index) => {
      lines.push(
        `${index + 1}. [${row.action.priority}] ${row.customer.company_name || "未命名客户"}｜${row.action.label}｜${row.action.timing}｜渠道：${customerContactChannel(row.customer)}`,
      );
      lines.push(`   下一步：${row.action.nextAction}`);
    });
  }

  lines.push("");
  lines.push("执行建议：先唤醒沉睡客户和停滞潜客，再联系 14 天未互动的成交客户；每次沟通都记录下一次采购窗口和明确动作。");
  return lines.join("\n");
}

function buildCustomerMergeBrief(rows) {
  const lines = [
    `客户去重/合并检查清单 ${businessDate()}`,
    "原则：不自动合并；先人工确认主体、联系人、报价、订单和财务余额，再决定是否进入合并审批。",
    "",
  ];

  if (!rows.length) {
    lines.push("当前筛选没有达到阈值的重复客户候选。");
  } else {
    rows.slice(0, 8).forEach((row, index) => {
      lines.push(`${index + 1}. [${row.priority}] ${row.primaryName} <> ${row.candidateName}｜匹配度 ${row.score}`);
      lines.push(`   信号：${row.reasons.join("、")}`);
      lines.push(`   建议：${row.suggestion}`);
    });
  }

  lines.push("");
  lines.push("检查项：税号/VAT、主联系人、未关闭报价、执行中订单、应收应付余额、历史活动归属。");
  return lines.join("\n");
}

function customerHealthClass(tone) {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "sky") return "border-sky-200 bg-sky-50 text-sky-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function scoreCustomerHealth(customer) {
  if (!customer) {
    return {
      score: 0,
      grade: "N/A",
      tone: "slate",
      reasons: ["未选择客户"],
    };
  }

  let score = 100;
  const reasons = [];
  const missing = customerMissingFields(customer);
  const quoteCount = customer.quotes?.length || 0;
  const orderCount = customer.orders?.length || 0;
  const activityCount = customer.activities?.length || 0;
  const ageDays = customerAgeDays(customer);

  if (missing.length) {
    const penalty = Math.min(missing.length * 7, 35);
    score -= penalty;
    reasons.push(`主数据缺口：${missing.join("、")}`);
  }

  if (!customer.email && !customer.phone && !customer.whatsapp) {
    score -= 18;
    reasons.push("缺少可触达联系方式");
  }

  if (!customer.address) {
    score -= 8;
    reasons.push("合同地址待补");
  }

  if (!customer.tax_no) {
    score -= 10;
    reasons.push("税号/VAT 待补，影响开票和账务");
  }

  if (customer.status === "inactive") {
    score -= 24;
    reasons.push("客户状态为沉默");
  } else if (customer.status === "prospect" && quoteCount === 0) {
    score -= 12;
    reasons.push("潜客尚未形成报价");
  }

  if (orderCount > 0) {
    score += 6;
  } else if (quoteCount === 0) {
    score -= 12;
    reasons.push("暂无报价或订单记录");
  }

  if (activityCount === 0) {
    score -= 8;
    reasons.push("暂无跟进活动记录");
  }

  if (ageDays !== null && ageDays > 30) {
    score -= 14;
    reasons.push(`${ageDays} 天未更新互动`);
  } else if (ageDays !== null && ageDays > 14) {
    score -= 7;
    reasons.push(`${ageDays} 天未更新互动`);
  }

  const normalizedScore = Math.max(Math.min(score, 100), 0);
  const grade = normalizedScore >= 85 ? "A" : normalizedScore >= 70 ? "B" : normalizedScore >= 55 ? "C" : "D";
  const tone = grade === "A" ? "emerald" : grade === "B" ? "sky" : grade === "C" ? "amber" : "rose";

  return {
    score: normalizedScore,
    grade,
    tone,
    reasons: reasons.length ? reasons.slice(0, 4) : ["主数据、联系渠道、业务记录和跟进节奏健康"],
  };
}

function buildCustomerReadiness(customer) {
  if (!customer) return [];

  return [
    ["主联系人", customer.contact_name, "报价和客服触达"],
    ["邮箱/电话", customer.email || customer.phone || customer.whatsapp, "销售跟进"],
    ["国家城市", customer.country && customer.city, "线路匹配"],
    ["公司地址", customer.address, "合同主体"],
    ["税号/VAT", customer.tax_no, "开票和账务"],
    ["行业标签", customer.industry, "营销内容和价格策略"],
  ].map(([label, ready, impact]) => ({
    label,
    ready: Boolean(ready),
    impact,
  }));
}

function hasCustomerValue(customer, keys) {
  return keys.some((key) => {
    const value = customer?.[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

function selectedCustomerDuplicateRows(customer, duplicateRows) {
  const identity = customerIdentity(customer);
  if (!identity.id) return [];
  return (duplicateRows || []).filter((row) => row.primaryId === identity.id || row.candidateId === identity.id);
}

function scoreCustomerCommercialGovernance(customer, duplicateRows = []) {
  if (!customer) {
    return {
      score: 0,
      grade: "N/A",
      priority: "P1",
      metrics: [],
      risks: ["未选择客户"],
      nextAction: "先选择客户，再检查合同账期、合并审批、客户等级和财务主体。",
    };
  }

  const contractChecks = [
    ["合同主体", hasCustomerValue(customer, ["company_name", "company_name_en"])],
    ["合同地址", hasCustomerValue(customer, ["address"])],
    ["税号/VAT", hasCustomerValue(customer, ["tax_no", "vat_no"])],
    ["账期/信用额度", hasCustomerValue(customer, ["payment_term", "credit_days", "credit_limit", "settlement_term"])],
    ["合同/框架协议", hasCustomerValue(customer, ["contract_no", "contract_url", "contract_file_path", "agreement_url"])],
  ];
  const readyContract = contractChecks.filter(([, ready]) => ready).length;
  const contractScore = Math.round((readyContract / contractChecks.length) * 100);

  const relatedDuplicates = selectedCustomerDuplicateRows(customer, duplicateRows);
  const hasMergeApproval = hasCustomerValue(customer, ["merge_approval_status", "merge_review_status", "master_data_review_status"]);
  const mergeScore = relatedDuplicates.length
    ? relatedDuplicates.some((row) => row.priority === "P1")
      ? hasMergeApproval ? 70 : 35
      : hasMergeApproval ? 90 : 60
    : 100;

  const hasTierRule = hasCustomerValue(customer, ["customer_level", "customer_tier", "pricing_tier", "tier_rule_id"]);
  const hasMarkupRule = hasCustomerValue(customer, ["markup_percent", "margin_rate", "pricing_rule_id", "quote_markup_percent"]);
  const hasTypeProfile = Boolean(customer.customer_type && customer.industry);
  const tierScore = hasTierRule && hasMarkupRule ? 100 : hasTierRule || hasMarkupRule ? 75 : hasTypeProfile ? 65 : 35;

  const financeChecks = [
    ["主联系人", customer.contact_name],
    ["触达渠道", customer.email || customer.phone || customer.whatsapp],
    ["国家", customer.country],
    ["币种", customer.currency || customer.preferred_currency],
  ];
  const readyFinance = financeChecks.filter(([, ready]) => ready).length;
  const financeScore = Math.round((readyFinance / financeChecks.length) * 100);
  const score = Math.round((contractScore * 0.35) + (mergeScore * 0.3) + (tierScore * 0.2) + (financeScore * 0.15));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const priority =
    grade === "D" || mergeScore < 50 || contractScore < 50
      ? "P1"
      : grade === "C" || mergeScore < 80 || contractScore < 80 || tierScore < 75
        ? "P2"
        : "P3";
  const risks = [];
  const missingContract = contractChecks.filter(([, ready]) => !ready).map(([label]) => label);
  const missingFinance = financeChecks.filter(([, ready]) => !ready).map(([label]) => label);

  if (missingContract.length) risks.push(`合同账期缺口：${missingContract.join("、")}`);
  if (relatedDuplicates.length && !hasMergeApproval) risks.push(`${relatedDuplicates.length} 组疑似重复未进入合并审批`);
  if (tierScore < 75) risks.push("客户等级/加价规则未配置");
  if (missingFinance.length) risks.push(`财务主体缺口：${missingFinance.join("、")}`);

  let nextAction = "客户合同账期、合并审批、等级规则和财务主体稳定，可进入正式报价、订单和开票链路。";
  if (priority === "P1") {
    nextAction = "先补合同主体、地址、税号、账期或处理重复客户审批，再允许正式报价和财务账期。";
  } else if (priority === "P2") {
    nextAction = "本周补客户等级、加价规则、币种或合并审批记录，形成可审计客户主数据。";
  }

  return {
    score,
    grade,
    priority,
    metrics: [
      { label: "合同账期", value: contractScore, hint: `${readyContract}/${contractChecks.length} 项齐全` },
      { label: "合并审批", value: mergeScore, hint: relatedDuplicates.length ? `${relatedDuplicates.length} 组候选` : "无重复候选" },
      { label: "等级规则", value: tierScore, hint: hasTierRule || hasMarkupRule ? "已配置分层/加价" : "待配置规则" },
      { label: "财务主体", value: financeScore, hint: `${readyFinance}/${financeChecks.length} 项齐全` },
    ],
    risks: risks.length ? risks : ["客户商业治理稳定"],
    nextAction,
  };
}

function buildCustomerCommercialGovernancePlan(customer, control) {
  if (!customer || !control) return "";

  return [
    `客户商业治理清单 ${businessDate()}`,
    `${customer.company_name || "未命名客户"}｜${control.priority}｜${control.score}/${control.grade}`,
    "",
    `治理风险：${control.risks.join("、")}`,
    `下一步：${control.nextAction}`,
    "",
    "执行建议：正式报价前确认合同主体、账期、税号、客户等级和重复客户审批；成交客户进入订单和财务前必须能追溯主数据责任。",
  ].join("\n");
}

function timelineDate(row) {
  return row?.created_at || row?.updated_at || row?.quote_date || row?.order_date || row?.next_follow_up_at || "";
}

function formatTimelineDate(value) {
  const timestamp = parseCustomerDate(value);
  if (!timestamp) return "日期待补";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function buildCustomerTimeline(customer) {
  if (!customer) return [];

  const activities = (customer.activities || []).map((item) => ({
    id: `activity-${item.id || item.created_at || item.subject}`,
    type: "跟进",
    tone: "slate",
    date: timelineDate(item),
    title: item.subject || item.activity_type || "客户跟进",
    detail: item.next_action || item.result || item.content || "待记录结果",
  }));

  const quotes = (customer.quotes || []).map((item) => ({
    id: `quote-${item.id || item.quote_no || item.created_at}`,
    type: "报价",
    tone: "sky",
    date: timelineDate(item),
    title: item.quote_no || item.route || "报价记录",
    detail: item.status || item.total_amount || item.currency || "报价待推进",
  }));

  const orders = (customer.orders || []).map((item) => ({
    id: `order-${item.id || item.order_no || item.created_at}`,
    type: "订单",
    tone: "emerald",
    date: timelineDate(item),
    title: item.order_no || item.route || "订单记录",
    detail: item.status || item.destination_city || item.destination_country || "订单执行中",
  }));

  return [...activities, ...quotes, ...orders]
    .sort((first, second) => (parseCustomerDate(second.date) || 0) - (parseCustomerDate(first.date) || 0))
    .slice(0, 6);
}

function DetailCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-950">{value || "-"}</div>
      {hint ? <div className="mt-2 text-sm text-slate-500">{hint}</div> : null}
    </div>
  );
}

function StatusPill({ status }) {
  const tone =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "inactive"
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status || "prospect"}
    </span>
  );
}

export default function CustomerWorkspace({
  customerDraft,
  selectedCustomerId,
  onBackToLeads,
  onCreateQuote,
  onOpenCustomer,
  onNotify,
}) {
  const [keyword, setKeyword] = useState("");
  const [stage, setStage] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState(customerDraft || null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [customerViewMode, setCustomerViewMode] = useState("risk");
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [localActivities, setLocalActivities] = useState([]);
  const [customerGrowthPlanText, setCustomerGrowthPlanText] = useState("");
  const [customerMergeBriefText, setCustomerMergeBriefText] = useState("");
  const [customerCommercialPlanText, setCustomerCommercialPlanText] = useState("");

  const listQuery = {
    page: 1,
    page_size: 30,
    keyword: keyword || undefined,
    status: stage === "all" ? undefined : stage,
  };

  const createCustomerMutation = useCreateCustomer();
  const createContactMutation = useCreateCustomerContact();
  const updateCustomerMutation = useUpdateCustomer();
  const updateContactMutation = useUpdateCustomerContact();
  const createActivityMutation = useCreateCustomerActivity();
  const isSavingCustomer = createCustomerMutation.isPending || createContactMutation.isPending;
  const isUpdatingCustomer = updateCustomerMutation.isPending || updateContactMutation.isPending;
  const { data: customerList, isError: listError, isLoading } = useCustomerList(listQuery);
  const detailId = selectedCustomer?.customer_id || selectedCustomer?.id;
  const { data: liveCustomer, isError: detailError } = useCustomerDetail(detailId);

  const customers = customerList?.items || [];
  const customerRows = useMemo(
    () =>
      customers.map((customer) => ({
        customer,
        health: scoreCustomerHealth(customer),
        action: getCustomerGrowthAction(customer),
      })),
    [customers]
  );
  const duplicateCandidates = useMemo(() => buildCustomerDuplicateCandidates(customers), [customers]);
  const duplicateCustomerIds = useMemo(
    () => new Set(duplicateCandidates.flatMap((row) => [row.primaryId, row.candidateId])),
    [duplicateCandidates]
  );
  const displayCustomerRows = useMemo(
    () =>
      [...customerRows].sort((first, second) => {
        if (customerViewMode === "risk") {
          const priorityRank = { P1: 0, P2: 1, P3: 2 };
          return (priorityRank[first.action.priority] ?? 9) - (priorityRank[second.action.priority] ?? 9) ||
            first.health.score - second.health.score ||
            customerActionRank(first) - customerActionRank(second);
        }

        return (parseCustomerDate(second.customer.created_at) || 0) - (parseCustomerDate(first.customer.created_at) || 0);
      }),
    [customerRows, customerViewMode]
  );
  const resolvedCustomer = useMemo(() => {
    const base = liveCustomer || selectedCustomer || customerDraft;
    if (!base) return null;

    return {
      ...selectedCustomer,
      ...customerDraft,
      ...base,
      contact_name: base.contacts?.[0]?.name || base.contact_name || selectedCustomer?.contact_name,
      contact_title: base.contacts?.[0]?.title || base.contact_title || selectedCustomer?.contact_title,
      email: base.contacts?.[0]?.email || base.email || selectedCustomer?.email,
      phone: base.contacts?.[0]?.phone || base.phone || selectedCustomer?.phone,
      whatsapp: base.contacts?.[0]?.whatsapp || base.whatsapp || selectedCustomer?.whatsapp,
      activities: [...(base.activities || []), ...localActivities.filter((item) => item.customer_id === base.id)],
    };
  }, [customerDraft, liveCustomer, localActivities, selectedCustomer]);

  const customerTier = useMemo(() => getCustomerTier(resolvedCustomer), [resolvedCustomer]);
  const missingFields = useMemo(() => customerMissingFields(resolvedCustomer), [resolvedCustomer]);
  const customerHealth = useMemo(() => scoreCustomerHealth(resolvedCustomer), [resolvedCustomer]);
  const customerReadiness = useMemo(() => buildCustomerReadiness(resolvedCustomer), [resolvedCustomer]);
  const customerTimeline = useMemo(() => buildCustomerTimeline(resolvedCustomer), [resolvedCustomer]);
  const customerGrowthAction = useMemo(() => getCustomerGrowthAction(resolvedCustomer), [resolvedCustomer]);
  const customerCommercialGovernance = useMemo(
    () => scoreCustomerCommercialGovernance(resolvedCustomer, duplicateCandidates),
    [duplicateCandidates, resolvedCustomer],
  );

  useEffect(() => {
    if (!selectedCustomerId) return;
    const currentId = selectedCustomer?.customer_id || selectedCustomer?.id;
    if (currentId === selectedCustomerId) return;
    setSelectedCustomer({ id: selectedCustomerId });
  }, [selectedCustomerId, selectedCustomer?.customer_id, selectedCustomer?.id]);

  useEffect(() => {
    setEditForm(buildEditForm(resolvedCustomer));
    setShowEdit(false);
  }, [resolvedCustomer?.id, resolvedCustomer?.company_name]);

  const metrics = useMemo(() => {
    const prospect = customers.filter((item) => item.status === "prospect").length;
    const active = customers.filter((item) => item.status === "active").length;
    const highRisk = customerRows.filter((row) => row.health.score < 55 || row.action.priority === "P1").length;
    const countries = new Set(customers.map((item) => item.country).filter(Boolean)).size;
    const duplicateRisk = duplicateCandidates.filter((row) => row.priority === "P1").length;

    return [
      ["当前客户", customers.length || "-", listError ? "登录后读取真实客户库" : "当前筛选结果"],
      ["潜在客户", prospect || "-", "需要销售跟进"],
      ["成交客户", active || "-", "可复购/再营销"],
      ["高风险客户", highRisk || "-", "沉睡/资料缺口/停滞"],
      ["疑似重复", duplicateCandidates.length || "-", duplicateRisk ? `${duplicateRisk} 组需优先核对` : "主数据合并候选"],
      ["覆盖国家", countries || "-", "按客户档案统计"],
    ];
  }, [customerRows, customers, duplicateCandidates, listError]);

  const customerGrowthRows = useMemo(
    () =>
      customers
        .map((customer) => ({
          customer,
          action: getCustomerGrowthAction(customer),
        }))
        .sort((first, second) => customerActionRank(first) - customerActionRank(second)),
    [customers]
  );

  const customerGrowthSummary = useMemo(
    () => ({
      total: customers.length,
      p1Count: customerGrowthRows.filter((row) => row.action.priority === "P1").length,
      inactiveCount: customers.filter((customer) => customer.status === "inactive").length,
      activeCount: customers.filter((customer) => customer.status === "active").length,
      prospectCount: customers.filter((customer) => customer.status === "prospect").length,
    }),
    [customerGrowthRows, customers]
  );

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateEditForm = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateCustomer = async (event) => {
    event.preventDefault();

    try {
      const created = await createCustomerMutation.mutateAsync({
        company_name: form.company_name.trim(),
        customer_type: form.customer_type,
        country: form.country || null,
        city: form.city || null,
        source_primary: form.source_primary,
        status: form.status,
        owner_id: await currentUserId(),
      });

      let primaryContact = null;
      const hasContact = [form.contact_name, form.email, form.phone].some((value) => value.trim());

      if (hasContact) {
        primaryContact = await createContactMutation.mutateAsync({
          customerId: created.id,
          name: form.contact_name.trim() || form.company_name.trim(),
          email: form.email || null,
          phone: form.phone || null,
          is_primary: true,
          status: "active",
        });
      }

      setSelectedCustomer({
        ...created,
        contacts: primaryContact ? [primaryContact] : [],
        contact_name: primaryContact?.name || form.contact_name,
        email: primaryContact?.email || form.email,
        phone: primaryContact?.phone || form.phone,
      });
      setShowCreate(false);
      setForm(emptyForm);
      onNotify?.({
        type: "success",
        title: "客户已创建",
        message: `${created.company_name} 已进入客户库${primaryContact ? "，主联系人已同步" : ""}，可以继续创建报价。`,
      });
    } catch (error) {
      const localCustomer = {
        ...form,
        id: null,
        customer_id: null,
        customer_no: null,
        company_name: form.company_name.trim(),
        country: form.country || null,
        city: form.city || null,
        source_primary: form.source_primary,
        contacts: [form.contact_name || form.email || form.phone ? {
          id: `local-contact-${Date.now()}`,
          name: form.contact_name.trim() || form.company_name.trim(),
          email: form.email || null,
          phone: form.phone || null,
          is_primary: true,
          status: "active",
        } : null].filter(Boolean),
        quotes: [],
        orders: [],
        activities: [],
        created_at: new Date().toISOString(),
      };

      setSelectedCustomer(localCustomer);
      setShowCreate(false);
      setForm(emptyForm);
      onNotify?.({
        type: "info",
        title: "客户已在本地工作台暂存",
        message: error.message || "未登录或无客户创建权限，资料先保留在当前页面，登录后可写入客户库。",
      });
    }
  };

  const handleSaveCustomer = async (event) => {
    event.preventDefault();

    const customerId = resolvedCustomer?.id || resolvedCustomer?.customer_id;
    const primaryContact = resolvedCustomer?.contacts?.[0] || null;
    const customerPayload = {
      company_name: editForm.company_name.trim(),
      company_name_en: editForm.company_name_en.trim() || null,
      customer_type: editForm.customer_type,
      industry: editForm.industry.trim() || null,
      country: editForm.country.trim() || null,
      city: editForm.city.trim() || null,
      address: editForm.address.trim() || null,
      website: editForm.website.trim() || null,
      tax_no: editForm.tax_no.trim() || null,
      source_primary: editForm.source_primary,
      status: editForm.status,
    };
    const contactPayload = {
      name: editForm.contact_name.trim() || editForm.company_name.trim(),
      title: editForm.contact_title.trim() || null,
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      whatsapp: editForm.whatsapp.trim() || null,
      is_primary: true,
      status: "active",
    };

    if (!customerId) {
      setSelectedCustomer((prev) => ({ ...prev, ...customerPayload, ...contactPayload }));
      setShowEdit(false);
      onNotify?.({
        type: "info",
        title: "客户资料已暂存",
        message: "当前客户还没有数据库 ID，资料先保留在工作台内，可创建正式客户后同步。",
      });
      return;
    }

    try {
      const updatedCustomer = await updateCustomerMutation.mutateAsync({ customerId, ...customerPayload });
      let updatedContact = primaryContact;
      const hasContact = [editForm.contact_name, editForm.email, editForm.phone, editForm.whatsapp].some((value) => value.trim());

      if (hasContact && primaryContact?.id) {
        updatedContact = await updateContactMutation.mutateAsync({
          contactId: primaryContact.id,
          customerId,
          ...contactPayload,
        });
      } else if (hasContact) {
        updatedContact = await createContactMutation.mutateAsync({
          customerId,
          ...contactPayload,
        });
      }

      setSelectedCustomer({
        ...resolvedCustomer,
        ...updatedCustomer,
        contacts: updatedContact ? [updatedContact, ...(resolvedCustomer.contacts || []).filter((item) => item.id !== updatedContact.id)] : resolvedCustomer.contacts,
        contact_name: updatedContact?.name || editForm.contact_name,
        contact_title: updatedContact?.title || editForm.contact_title,
        email: updatedContact?.email || editForm.email,
        phone: updatedContact?.phone || editForm.phone,
        whatsapp: updatedContact?.whatsapp || editForm.whatsapp,
      });
      setShowEdit(false);
      onNotify?.({
        type: "success",
        title: "客户资料已更新",
        message: `${updatedCustomer.company_name} 的档案、分层和联系人已同步。`,
      });
    } catch (error) {
      setSelectedCustomer((prev) => ({
        ...prev,
        ...customerPayload,
        contact_name: editForm.contact_name,
        contact_title: editForm.contact_title,
        email: editForm.email,
        phone: editForm.phone,
        whatsapp: editForm.whatsapp,
      }));
      setShowEdit(false);
      onNotify?.({
        type: "info",
        title: "客户资料已在页面暂存",
        message: error.message || "数据库未写入，请确认已登录且具备客户编辑权限。",
      });
    }
  };

  const handleScheduleRepurchase = async (targetCustomer = resolvedCustomer) => {
    const customer = targetCustomer || resolvedCustomer;
    if (!customer) return;

    setSelectedCustomer(customer);
    const customerId = customer.id || customer.customer_id;
    const activity = {
      customer_id: customerId,
      activity_type: "email_follow_up",
      subject: "复购/二次邮件跟进",
      content: `${customer.company_name || "客户"} 进入客户复购邮件跟进。`,
      result: "pending",
      next_action: "发送价格更新、路线案例或舱位提醒邮件",
      next_follow_up_at: daysFromNow(customer.status === "active" ? 14 : 7),
      owner_id: await currentUserId(),
      created_at: new Date().toISOString(),
    };

    if (!customerId) {
      setLocalActivities((prev) => [{ ...activity, id: `local-${Date.now()}` }, ...prev]);
      onNotify?.({
        type: "info",
        title: "跟进任务已暂存",
        message: "当前客户还未入库，复购邮件动作先保留在工作台。",
      });
      return;
    }

    try {
      await createActivityMutation.mutateAsync({ customerId, ...activity });
      onNotify?.({
        type: "success",
        title: "复购跟进已安排",
        message: `${customer.company_name} 已加入二次邮件/复购跟进。`,
      });
    } catch (error) {
      setLocalActivities((prev) => [{ ...activity, id: `local-${Date.now()}` }, ...prev]);
      onNotify?.({
        type: "info",
        title: "跟进任务已在页面暂存",
        message: error.message || "数据库未写入，请确认账号具备活动记录权限。",
      });
    }
  };

  const handleCopyCustomerGrowthPlan = async () => {
    const text = buildCustomerGrowthPlan(customerGrowthRows, customerGrowthSummary);

    try {
      await navigator.clipboard.writeText(text);
      setCustomerGrowthPlanText("");
      onNotify?.({
        type: "success",
        title: "客户增长清单已复制",
        message: "已按沉睡唤醒、潜客推进和成交复购优先级整理，可直接同步给销售执行。",
      });
    } catch (error) {
      setCustomerGrowthPlanText(text);
      onNotify?.({
        type: "info",
        title: "浏览器阻止自动复制",
        message: "客户增长清单已展开在页面中，可以手动选中复制。",
      });
    }
  };

  const handleCopyCustomerMergeBrief = async () => {
    const text = buildCustomerMergeBrief(duplicateCandidates);

    try {
      await navigator.clipboard.writeText(text);
      setCustomerMergeBriefText("");
      onNotify?.({
        type: "success",
        title: "合并检查清单已复制",
        message: "已按重复风险整理主数据核对项，可交给销售、客服或财务共同确认。",
      });
    } catch (error) {
      setCustomerMergeBriefText(text);
      onNotify?.({
        type: "info",
        title: "浏览器阻止自动复制",
        message: "合并检查清单已展开在页面中，可以手动选中复制。",
      });
    }
  };

  const handleCopyCustomerCommercialPlan = async () => {
    const text = buildCustomerCommercialGovernancePlan(resolvedCustomer, customerCommercialGovernance);

    if (!text) {
      onNotify?.({
        type: "info",
        title: "暂无客户商业治理清单",
        message: "先选择客户后，再复制合同账期、合并审批和等级规则清单。",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCustomerCommercialPlanText("");
      onNotify?.({
        type: "success",
        title: "客户商业治理清单已复制",
        message: "已按合同账期、合并审批、等级规则和财务主体整理，可同步销售、客服和财务。",
      });
    } catch (error) {
      setCustomerCommercialPlanText(text);
      onNotify?.({
        type: "info",
        title: "浏览器阻止自动复制",
        message: "客户商业治理清单已展开在页面中，可以手动选中复制。",
      });
    }
  };

  const handleFocusCustomerGrowthRow = (row) => {
    if (!row?.customer) return;
    setStage("all");
    setKeyword(row.customer.company_name || "");
    setSelectedCustomer(row.customer);
    onOpenCustomer?.(row.customer.id || row.customer.customer_id);
  };

  const handleOpenCustomer = (customer) => {
    setSelectedCustomer(customer);
    onOpenCustomer?.(customer.id || customer.customer_id);
  };

  return (
    <section className="grid gap-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">客户管理</h2>
            <p className="mt-1 text-sm text-slate-500">客户档案、联系人、报价入口、跟进动作集中处理。</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {showCreate ? "收起新增" : "新增客户"}
            </button>
            <button
              type="button"
              onClick={onBackToLeads}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700"
            >
              从线索转客户
            </button>
            <button
              type="button"
              onClick={() => onCreateQuote?.(resolvedCustomer || { company_name: "", contact_name: "" })}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700"
            >
              创建报价
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {metrics.map(([label, value, hint]) => (
            <DetailCard key={label} label={label} value={value} hint={hint} />
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_36%),linear-gradient(145deg,_#020617,_#0f172a_54%,_#064e3b)] p-6 text-white">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">
              Customer Growth
            </div>
            <h3 className="mt-4 text-2xl font-bold">客户复购 / 唤醒指挥台</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              老客户复购通常比重新买流量更快、更便宜。这里按沉睡唤醒、潜客推进和成交复购自动排优先级。
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">P1 客户</div>
                <div className="mt-2 text-3xl font-bold">{customerGrowthSummary.p1Count}</div>
                <div className="mt-1 text-xs text-slate-400">今天先联系</div>
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-100">沉睡客户</div>
                <div className="mt-2 text-3xl font-bold">{customerGrowthSummary.inactiveCount}</div>
                <div className="mt-1 text-xs text-amber-100/70">价格/案例唤醒</div>
              </div>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">成交客户</div>
                <div className="mt-2 text-3xl font-bold">{customerGrowthSummary.activeCount}</div>
                <div className="mt-1 text-xs text-emerald-100/70">争取复购</div>
              </div>
              <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-sky-100">潜在客户</div>
                <div className="mt-2 text-3xl font-bold">{customerGrowthSummary.prospectCount}</div>
                <div className="mt-1 text-xs text-sky-100/70">推进首次报价</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyCustomerGrowthPlan}
              className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950"
            >
              复制客户增长清单
            </button>
          </div>

          <div className="bg-white p-5">
            <div>
              <h4 className="text-lg font-bold text-slate-950">优先联系队列</h4>
              <p className="mt-1 text-sm text-slate-500">点击聚焦客户查看详情，或直接安排真实复购跟进活动。</p>
            </div>

            <div className="mt-5 grid gap-3">
              {customerGrowthRows.length ? (
                customerGrowthRows.slice(0, 6).map((row) => (
                  <article key={`${row.customer.id || row.customer.company_name}-${row.action.queue}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${customerActionClass(row.action.priority)}`}>
                            {row.action.priority}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                            {row.action.label}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">{row.action.timing}</span>
                        </div>
                        <div className="mt-2 text-base font-bold text-slate-950">{row.customer.company_name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {[row.customer.country, customerContactChannel(row.customer), row.customer.source_primary]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{row.action.nextAction}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => handleFocusCustomerGrowthRow(row)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          聚焦客户
                        </button>
                        <button
                          type="button"
                          onClick={() => handleScheduleRepurchase(row.customer)}
                          disabled={createActivityMutation.isPending}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          安排跟进
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-500">
                  当前没有可见客户。先从线索转客户或新增客户，系统就会自动生成复购和唤醒优先级。
                </div>
              )}
            </div>

            {customerGrowthPlanText ? (
              <textarea
                className="mt-5 min-h-56 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 outline-none"
                value={customerGrowthPlanText}
                onChange={(event) => setCustomerGrowthPlanText(event.target.value)}
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">客户去重 / 合并候选</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              借鉴传统 CRM 主数据治理：按邮箱、电话、税号、公司名和地区识别疑似重复客户；这里只提示和聚焦，不自动合并。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
              P1 {duplicateCandidates.filter((row) => row.priority === "P1").length}
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
              P2 {duplicateCandidates.filter((row) => row.priority === "P2").length}
            </span>
            <button
              type="button"
              onClick={handleCopyCustomerMergeBrief}
              className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-bold text-white"
            >
              复制合并检查清单
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {duplicateCandidates.length ? (
            duplicateCandidates.slice(0, 5).map((row) => (
              <article key={`${row.primaryId}-${row.candidateId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 lg:grid-cols-[0.85fr_0.85fr_1.1fr_auto] lg:items-center">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">主客户</div>
                    <button
                      type="button"
                      onClick={() => handleOpenCustomer(row.primary)}
                      className="mt-1 text-left text-sm font-bold text-slate-950"
                    >
                      {row.primaryName}
                    </button>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">疑似重复</div>
                    <button
                      type="button"
                      onClick={() => handleOpenCustomer(row.candidate)}
                      className="mt-1 text-left text-sm font-bold text-slate-950"
                    >
                      {row.candidateName}
                    </button>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${duplicatePriorityClass(row.priority)}`}>
                        {row.priority} 匹配度 {row.score}
                      </span>
                      {row.reasons.map((reason) => (
                        <span key={reason} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {reason}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{row.suggestion}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => handleOpenCustomer(row.primary)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      聚焦主客户
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCustomer(row.candidate)}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                    >
                      聚焦候选
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-500">
              当前筛选没有达到阈值的重复客户候选。后续客户导入、线索转客户或手工新增后，这里会自动提示需要人工核对的档案。
            </div>
          )}
        </div>

        {customerMergeBriefText ? (
          <textarea
            className="mt-4 min-h-44 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 outline-none"
            value={customerMergeBriefText}
            onChange={(event) => setCustomerMergeBriefText(event.target.value)}
          />
        ) : null}
      </section>

      {showCreate && (
        <form onSubmit={handleCreateCustomer} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">新增客户</h3>
              <p className="mt-1 text-sm text-slate-500">先建客户档案，后续报价、订单、财务都会归集到这里。</p>
            </div>
            {isSavingCustomer && <span className="text-sm text-slate-500">保存中...</span>}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-xs font-semibold text-slate-500">公司名称</span>
              <input
                value={form.company_name}
                onChange={(event) => updateForm("company_name", event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="例如 Nordic Retail GmbH"
                required
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">客户状态</span>
              <select
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              >
                <option value="prospect">潜在客户</option>
                <option value="active">成交客户</option>
                <option value="inactive">沉默客户</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">联系人</span>
              <input
                value={form.contact_name}
                onChange={(event) => updateForm("contact_name", event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="联系人姓名"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">邮箱</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="name@company.com"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">电话 / WhatsApp</span>
              <input
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="+49..."
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">国家</span>
              <input
                value={form.country}
                onChange={(event) => updateForm("country", event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="Germany"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">城市</span>
              <input
                value={form.city}
                onChange={(event) => updateForm("city", event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="Hamburg"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">来源</span>
              <select
                value={form.source_primary}
                onChange={(event) => updateForm("source_primary", event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              >
                <option value="manual">手工录入</option>
                <option value="website_form">网站询盘</option>
                <option value="google_seo">Google SEO</option>
                <option value="google_ads">Google Ads</option>
                <option value="referral">转介绍</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm);
                setShowCreate(false);
              }}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isSavingCustomer}
            >
              {isSavingCustomer ? "保存中..." : "保存客户"}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">客户列表</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {listError ? "当前账号暂无客户表读取权限，登录并分配角色后可查看真实客户。" : "筛选客户并直接进入报价或跟进。"}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1">
                  {[
                    ["risk", "风险优先"],
                    ["recent", "新近优先"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCustomerViewMode(value)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${customerViewMode === value ? "bg-slate-950 text-white" : "text-slate-500"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  placeholder="搜索公司/国家/城市"
                />
                <select
                  value={stage}
                  onChange={(event) => setStage(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                >
                  {customerStages.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">客户数据加载中...</div>
            ) : displayCustomerRows.length ? (
              displayCustomerRows.map(({ customer, health, action }) => (
                <div key={customer.id} className="grid gap-3 px-4 py-4 text-sm hover:bg-slate-50 lg:grid-cols-[1.25fr_0.72fr_0.78fr_0.85fr_auto] lg:items-center">
                  <button
                    type="button"
                    onClick={() => handleOpenCustomer(customer)}
                    className="text-left"
                  >
                    <div className="font-bold text-slate-950">{customer.company_name}</div>
                    <div className="mt-1 text-xs text-slate-500">{customer.customer_no || "未生成客户编号"}</div>
                  </button>
                  <div className="text-slate-600">{[customer.country, customer.city].filter(Boolean).join(" / ") || "国家城市待补"}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={customer.status} />
                    <span className="text-xs text-slate-400">{customer.source_primary || "manual"}</span>
                    {duplicateCustomerIds.has(customer.id || customer.customer_id || customer.customer_no || customer.company_name) ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                        疑似重复
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${customerHealthClass(health.tone)}`}>
                      {health.score} / {health.grade}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${customerActionClass(action.priority)}`}>
                      {action.priority} {action.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => onCreateQuote?.(customer)}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                    >
                      报价
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScheduleRepurchase(customer)}
                      disabled={createActivityMutation.isPending}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {createActivityMutation.isPending ? "排期中..." : "跟进"}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <div className="text-sm font-semibold text-slate-700">暂无可见客户</div>
                <p className="mt-2 text-sm text-slate-500">可以从线索转客户，或点击“新增客户”手工录入。</p>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">客户快照</h3>
                <p className="mt-1 text-sm text-slate-500">选中客户后查看联系人、业务上下文和下一步动作。</p>
              </div>
              {resolvedCustomer?.status && <StatusPill status={resolvedCustomer.status} />}
            </div>

            {resolvedCustomer ? (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xl font-bold text-slate-950">{resolvedCustomer.company_name}</div>
                  <div className="mt-1 text-sm text-slate-500">{resolvedCustomer.customer_no || "客户编号待生成"}</div>
                </div>

                <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${customerTier.tone}`}>
                  <div>{customerTier.label}</div>
                  <div className="mt-1 text-xs font-medium opacity-80">{customerTier.action}</div>
                </div>

                <div className={`rounded-2xl border p-4 ${customerHealthClass(customerHealth.tone)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">Customer Health</div>
                      <div className="mt-2 text-3xl font-black">{customerHealth.score}</div>
                    </div>
                    <div className="rounded-full bg-white/70 px-3 py-1 text-sm font-black">Grade {customerHealth.grade}</div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
                    <div
                      className="h-full rounded-full bg-current"
                      style={{ width: `${customerHealth.score}%` }}
                    />
                  </div>
                  <div className="mt-3 grid gap-1.5 text-xs font-semibold opacity-90">
                    {customerHealth.reasons.map((reason) => (
                      <div key={reason}>{reason}</div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <DetailCard label="联系人" value={resolvedCustomer.contact_name} hint={resolvedCustomer.email || resolvedCustomer.phone} />
                  <DetailCard label="国家城市" value={[resolvedCustomer.country, resolvedCustomer.city].filter(Boolean).join(" / ")} hint={resolvedCustomer.source_primary || resolvedCustomer.source_type} />
                  <DetailCard label="历史报价" value={resolvedCustomer.quotes?.length || "-"} hint="登录后读取实时记录" />
                  <DetailCard label="历史订单" value={resolvedCustomer.orders?.length || "-"} hint={detailError ? "详情权限待确认" : "客户关联订单"} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {customerTypeLabels[resolvedCustomer.customer_type] || resolvedCustomer.customer_type || "客户类型待补"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {resolvedCustomer.industry || "行业待补"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {sourceLabels[resolvedCustomer.source_primary] || resolvedCustomer.source_primary || "来源待补"}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-slate-900">主数据 / 合同账务准备</div>
                    <div className="text-xs font-semibold text-slate-500">
                      {customerReadiness.filter((item) => item.ready).length}/{customerReadiness.length}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {customerReadiness.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{item.label}</span>
                          <span className="ml-2 text-slate-500">{item.impact}</span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 font-bold ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {item.ready ? "已就绪" : "待补"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Customer Governance</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">合同账期 / 合并审批 / 等级规则</div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        把客户主数据、疑似重复、账期信用和客户等级加价规则集中检查，避免未审客户进入正式报价、订单和开票。
                      </p>
                    </div>
                    <div className={`rounded-2xl border px-3 py-2 text-center ${customerActionClass(customerCommercialGovernance.priority)}`}>
                      <div className="text-[11px] font-black">{customerCommercialGovernance.priority}</div>
                      <div className="mt-0.5 text-2xl font-black">{customerCommercialGovernance.score}</div>
                      <div className="text-[11px] font-bold">Grade {customerCommercialGovernance.grade}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {customerCommercialGovernance.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs font-semibold text-slate-500">{metric.label}</div>
                        <div className="mt-1 flex items-end gap-1">
                          <span className="text-xl font-black text-slate-950">{metric.value}</span>
                          <span className="pb-0.5 text-[11px] font-semibold text-slate-400">/100</span>
                        </div>
                        <div className="mt-0.5 text-xs leading-4 text-slate-500">{metric.hint}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">治理风险</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {customerCommercialGovernance.risks.map((risk) => (
                        <span key={risk} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${customerActionClass(customerCommercialGovernance.priority)}`}>
                          {risk}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{customerCommercialGovernance.nextAction}</div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCustomerCommercialPlan}
                    className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    复制客户商业治理清单
                  </button>

                  {customerCommercialPlanText ? (
                    <textarea
                      className="mt-3 min-h-40 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-800 outline-none"
                      value={customerCommercialPlanText}
                      onChange={(event) => setCustomerCommercialPlanText(event.target.value)}
                    />
                  ) : null}
                </div>

                {missingFields.length ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <div className="font-bold">资料缺口</div>
                    <div className="mt-1">还缺：{missingFields.join("、")}。补齐后报价、订单和财务核算会更顺。</div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">下一步动作</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">{customerGrowthAction.timing}</div>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-xs font-bold ${customerActionClass(customerGrowthAction.priority)}`}>
                      {customerGrowthAction.priority}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">{customerGrowthAction.label}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    {customerGrowthAction.nextAction}
                  </div>
                </div>

                {customerTimeline.length ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-bold text-slate-900">业务时间线</div>
                    <div className="mt-3 grid gap-2">
                      {customerTimeline.map((item) => (
                        <div key={item.id} className="grid grid-cols-[3.5rem_1fr] gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <div className="font-bold text-slate-500">{formatTimelineDate(item.date)}</div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 font-bold ${item.tone === "emerald" ? "bg-emerald-100 text-emerald-700" : item.tone === "sky" ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-700"}`}>
                                {item.type}
                              </span>
                              <span className="font-semibold text-slate-800">{item.title}</span>
                            </div>
                            <div className="mt-1 leading-5">{item.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {showEdit ? (
                  <form onSubmit={handleSaveCustomer} className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-bold text-slate-900">编辑客户档案</div>
                      {isUpdatingCustomer ? <span className="text-xs text-slate-500">保存中...</span> : null}
                    </div>

                    <div className="grid gap-3">
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">公司名称</span>
                        <input
                          value={editForm.company_name}
                          onChange={(event) => updateEditForm("company_name", event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          required
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">英文名</span>
                        <input
                          value={editForm.company_name_en}
                          onChange={(event) => updateEditForm("company_name_en", event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          placeholder="Company legal name"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">客户类型</span>
                          <select
                            value={editForm.customer_type}
                            onChange={(event) => updateEditForm("customer_type", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          >
                            <option value="direct">直客</option>
                            <option value="forwarder">同行/货代</option>
                            <option value="ecommerce">跨境电商</option>
                            <option value="agent">代理</option>
                          </select>
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">客户状态</span>
                          <select
                            value={editForm.status}
                            onChange={(event) => updateEditForm("status", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          >
                            <option value="prospect">潜在客户</option>
                            <option value="active">成交客户</option>
                            <option value="inactive">沉默客户</option>
                          </select>
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">行业</span>
                          <input
                            value={editForm.industry}
                            onChange={(event) => updateEditForm("industry", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                            placeholder="Retail / Automotive"
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">来源</span>
                          <select
                            value={editForm.source_primary}
                            onChange={(event) => updateEditForm("source_primary", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          >
                            <option value="manual">手工录入</option>
                            <option value="website_form">网站询盘</option>
                            <option value="google_seo">Google SEO</option>
                            <option value="google_ads">Google Ads</option>
                            <option value="referral">转介绍</option>
                          </select>
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">国家</span>
                          <input
                            value={editForm.country}
                            onChange={(event) => updateEditForm("country", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">城市</span>
                          <input
                            value={editForm.city}
                            onChange={(event) => updateEditForm("city", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                      </div>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">地址</span>
                        <input
                          value={editForm.address}
                          onChange={(event) => updateEditForm("address", event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">网站</span>
                          <input
                            value={editForm.website}
                            onChange={(event) => updateEditForm("website", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                            placeholder="https://"
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">税号/VAT</span>
                          <input
                            value={editForm.tax_no}
                            onChange={(event) => updateEditForm("tax_no", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">联系人</span>
                          <input
                            value={editForm.contact_name}
                            onChange={(event) => updateEditForm("contact_name", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">职位</span>
                          <input
                            value={editForm.contact_title}
                            onChange={(event) => updateEditForm("contact_title", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">邮箱</span>
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(event) => updateEditForm("email", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">电话</span>
                          <input
                            value={editForm.phone}
                            onChange={(event) => updateEditForm("phone", event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                      </div>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">WhatsApp</span>
                        <input
                          value={editForm.whatsapp}
                          onChange={(event) => updateEditForm("whatsapp", event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditForm(buildEditForm(resolvedCustomer));
                          setShowEdit(false);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={isUpdatingCustomer}
                        className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {isUpdatingCustomer ? "保存中..." : "保存档案"}
                      </button>
                    </div>
                  </form>
                ) : null}

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditForm(buildEditForm(resolvedCustomer));
                      setShowEdit((value) => !value);
                    }}
                    className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700"
                  >
                    {showEdit ? "收起编辑" : "编辑客户档案"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateQuote?.(resolvedCustomer)}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                  >
                    基于此客户创建报价
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScheduleRepurchase(resolvedCustomer)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    加入二次邮件跟进
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-500">
                请选择左侧客户，或从营销获客模块转入客户。客户资料会用于后续报价、订单和财务核算，避免重复录入。
              </div>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
