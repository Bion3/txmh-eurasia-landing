import { useDeferredValue, useMemo, useState } from "react";
import {
  useAddLeadActivity,
  useBulkScheduleLeadFollowUps,
  useConvertLeadToCustomer,
  useCreateLead,
  useEmailTaskList,
  useLeadActivities,
  useLeadList,
  useScheduleLeadFollowUp,
  useScoreLead,
  useUpdateLead,
  useUpdateEmailTask,
} from "../../hooks/useLeads";
import { useRpcConvertLeadToCustomer } from "../../hooks/useSystemRpc";
import { useLeadSourceOverview } from "../../hooks/useDashboard";
import { useAuthSession } from "../../hooks/useAuthSession";
import { routeLandingPages } from "../../data/routeLandingPages";
import { leadPoolRecords } from "../../system/mockData";

const filterOptions = {
  statuses: ["all", "new", "contacted", "quoted", "nurturing"],
  modes: ["all", "rail", "sea", "air"],
  shipmentTypes: ["all", "LCL", "FCL", "air_cargo"],
};

const emptyLeadForm = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  country: "",
  source_type: "manual",
  channel_detail: "",
  intent_level: "warm",
  transport_mode_interest: "rail",
  shipment_type_interest: "LCL",
  origin: "",
  destination: "",
  cargo_desc: "",
  volume_cbm: "",
  weight_kg: "",
  message: "",
};

const emptyFollowUpForm = {
  activity_type: "phone_call",
  result: "",
  content: "",
  next_action: "",
  next_follow_up_at: "",
};

const emptyCampaignLinkForm = {
  landing_path: "/quote",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "rail_lcl_europe",
  utm_term: "",
  utm_content: "",
};

function getIntentClass(level) {
  switch (level) {
    case "hot":
      return "bg-rose-100 text-rose-700 border border-rose-200";
    case "warm":
      return "bg-amber-100 text-amber-700 border border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border border-slate-200";
  }
}

function getStatusClass(status) {
  switch (status) {
    case "new":
      return "bg-sky-100 text-sky-700 border border-sky-200";
    case "contacted":
      return "bg-indigo-100 text-indigo-700 border border-indigo-200";
    case "quoted":
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    case "nurturing":
      return "bg-violet-100 text-violet-700 border border-violet-200";
    default:
      return "bg-slate-100 text-slate-600 border border-slate-200";
  }
}

function getNextBestAction(lead) {
  if (lead?.next_best_action) return lead.next_best_action;
  if ((lead?.lead_score || 0) >= 80 || lead?.intent_level === "hot") {
    return "4小时内电话或 WhatsApp 跟进，并同步创建报价。";
  }
  if ((lead?.lead_score || 0) >= 55 || lead?.intent_level === "warm") {
    return "24小时内发送路线方案和报价资料，确认货量与时效。";
  }
  return "进入邮件培育，补充目的港、货量和时间要求。";
}

function getLeadActionSla(lead) {
  if ((lead?.lead_score || 0) >= 80 || lead?.intent_level === "hot") {
    return {
      label: "4小时内",
      tone: "rose",
      detail: "优先首响，确认需求后立即报价",
    };
  }
  if ((lead?.lead_score || 0) >= 55 || lead?.intent_level === "warm") {
    return {
      label: "24小时内",
      tone: "amber",
      detail: "发送路线方案，补齐货量和时效",
    };
  }
  return {
    label: "3天内培育",
    tone: "slate",
    detail: "补联系方式、目的港、货量或时间要求",
  };
}

function getLeadSlaHours(lead) {
  if ((lead?.lead_score || 0) >= 80 || lead?.intent_level === "hot") return 4;
  if ((lead?.lead_score || 0) >= 55 || lead?.intent_level === "warm") return 24;
  return 72;
}

function getLeadRecurringFollowUpHours(lead) {
  if ((lead?.lead_score || 0) >= 80 || lead?.intent_level === "hot") return 24;
  if ((lead?.lead_score || 0) >= 55 || lead?.intent_level === "warm") return 48;
  return 168;
}

function parseDateMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatDueDistance(hours) {
  const absolute = Math.abs(hours);
  if (absolute >= 24) return `${Math.ceil(absolute / 24)}天`;
  if (absolute >= 1) return `${Math.ceil(absolute)}小时`;
  return "1小时内";
}

function getLeadFollowUpSla(lead, nowMs = Date.now()) {
  if (!lead || ["quoted", "won", "lost"].includes(lead.status)) {
    return {
      label: "无需跟进",
      tone: "slate",
      detail: "已进入报价/成交/丢失状态",
      isActionable: false,
      isDueSoon: false,
      isOverdue: false,
      sortScore: 9999,
    };
  }

  const firstResponseMs = parseDateMs(lead.first_response_at);
  const lastFollowUpMs = parseDateMs(lead.last_follow_up_at);
  const createdMs = parseDateMs(lead.created_at) || nowMs;
  const isFirstResponsePending = !firstResponseMs && lead.status === "new";
  const baseMs = isFirstResponsePending ? createdMs : lastFollowUpMs || firstResponseMs || createdMs;
  const slaHours = isFirstResponsePending ? getLeadSlaHours(lead) : getLeadRecurringFollowUpHours(lead);
  const dueMs = baseMs + slaHours * 60 * 60 * 1000;
  const hoursUntilDue = (dueMs - nowMs) / (60 * 60 * 1000);
  const isOverdue = hoursUntilDue < 0;
  const isDueSoon = !isOverdue && hoursUntilDue <= 24;
  const prefix = isFirstResponsePending ? "首响" : "跟进";

  if (isOverdue) {
    return {
      label: `${prefix}超时`,
      tone: "rose",
      detail: `已超 ${formatDueDistance(hoursUntilDue)}`,
      isActionable: true,
      isDueSoon: true,
      isOverdue: true,
      sortScore: hoursUntilDue,
    };
  }

  if (isDueSoon) {
    return {
      label: `${prefix}今日到期`,
      tone: "amber",
      detail: `剩余 ${formatDueDistance(hoursUntilDue)}`,
      isActionable: true,
      isDueSoon: true,
      isOverdue: false,
      sortScore: hoursUntilDue,
    };
  }

  return {
    label: `${prefix}正常`,
    tone: "emerald",
    detail: `剩余 ${formatDueDistance(hoursUntilDue)}`,
    isActionable: true,
    isDueSoon: false,
    isOverdue: false,
    sortScore: hoursUntilDue,
  };
}

function getSlaBadgeClass(tone) {
  switch (tone) {
    case "rose":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getLeadRecommendedChannel(lead) {
  if (lead?.phone) {
    return {
      label: "WhatsApp / 电话",
      detail: lead.phone,
      activityType: "whatsapp",
    };
  }
  if (lead?.email) {
    return {
      label: "邮件",
      detail: lead.email,
      activityType: "email_follow_up",
    };
  }
  return {
    label: "补联系方式",
    detail: "先确认邮箱或 WhatsApp",
    activityType: "note",
  };
}

function getLeadActionToneClass(tone) {
  switch (tone) {
    case "rose":
      return "border-rose-300 bg-rose-400/15 text-rose-50";
    case "amber":
      return "border-amber-300 bg-amber-400/15 text-amber-50";
    default:
      return "border-slate-500 bg-white/5 text-slate-100";
  }
}

function buildNextActionBrief(lead) {
  const route = [lead?.origin, lead?.destination].filter(Boolean).join(" -> ") || "route pending";
  const cargo = [lead?.cargo_desc, lead?.volume_cbm ? `${lead.volume_cbm} CBM` : null, lead?.weight_kg ? `${lead.weight_kg} KG` : null]
    .filter(Boolean)
    .join(" / ") || "cargo pending";
  const channel = getLeadRecommendedChannel(lead);
  const sla = getLeadActionSla(lead);

  return [
    `Lead: ${leadDisplayName(lead)}`,
    `Contact: ${[lead?.contact_name, lead?.email, lead?.phone].filter(Boolean).join(" / ") || "pending"}`,
    `Route: ${route}`,
    `Cargo: ${cargo}`,
    `Score: ${lead?.intent_level || "unknown"} / ${lead?.lead_score ?? "pending"}`,
    `Recommended channel: ${channel.label} (${channel.detail})`,
    `SLA: ${sla.label} - ${sla.detail}`,
    `Next action: ${getNextBestAction(lead)}`,
  ].join("\n");
}

function uniqueDailyLeadQueueItems(queues) {
  const seen = new Set();
  const candidates = [
    ...(queues.dueFollowUps || []).map((lead) => ({ lead, reason: "SLA 到期/超时" })),
    ...(queues.unassigned || []).map((lead) => ({ lead, reason: "未分配负责人" })),
    ...(queues.hotUnquoted || []).map((lead) => ({ lead, reason: "高意向未报价" })),
    ...(queues.firstFollowUp || []).map((lead) => ({ lead, reason: "待首次跟进" })),
  ];

  return candidates.filter(({ lead }) => {
    const key = lead?.id || `${lead?.email || ""}-${lead?.phone || ""}-${leadDisplayName(lead)}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildDailyLeadWorklist(queues, user) {
  const items = uniqueDailyLeadQueueItems(queues).slice(0, 20);
  const today = new Date().toISOString().slice(0, 10);

  if (!items.length) return "";

  return [
    `今日线索跟进清单 ${today}`,
    `负责人视角：${user?.email || "当前工作台"}`,
    "",
    ...items.map(({ lead, reason }, index) => {
      const route = [lead?.origin, lead?.destination].filter(Boolean).join(" -> ") || "路线待补";
      const cargo = [lead?.cargo_desc, lead?.volume_cbm ? `${lead.volume_cbm} CBM` : null, lead?.weight_kg ? `${lead.weight_kg} KG` : null]
        .filter(Boolean)
        .join(" / ") || "货物待补";
      const contact = [lead?.contact_name, lead?.email, lead?.phone].filter(Boolean).join(" / ") || "联系方式待补";
      const channel = getLeadRecommendedChannel(lead);
      const followUpSla = getLeadFollowUpSla(lead);

      return [
        `${index + 1}. ${leadDisplayName(lead)}｜${reason}`,
        `   联系：${contact}`,
        `   路线：${route}`,
        `   货物：${cargo}`,
        `   优先级：${lead?.intent_level || "unknown"} / ${lead?.lead_score ?? "待评分"}｜${followUpSla.label} ${followUpSla.detail}`,
        `   负责人：${leadOwnerLabel(lead, user)}`,
        `   推荐渠道：${channel.label}${channel.detail ? `（${channel.detail}）` : ""}`,
        `   下一步：${getNextBestAction(lead)}`,
      ].join("\n");
    }),
    "",
    "执行建议：先处理超时/今日到期，再认领未分配，最后把高意向未报价推进到报价中心。",
  ].join("\n");
}

function estimateLeadScore(values) {
  let score = values.intent_level === "hot" ? 80 : values.intent_level === "warm" ? 55 : 30;
  if (values.email || values.phone) score += 8;
  if (values.origin && values.destination) score += 8;
  if (values.volume_cbm || values.weight_kg) score += 4;
  return Math.min(score, 100);
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function normalizeUtmValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildTrackedCampaignUrl(values) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.eurasiago.com";
  const rawLandingPath = String(values.landing_path || "/quote");
  const url = rawLandingPath.startsWith("http")
    ? new URL(rawLandingPath)
    : new URL(rawLandingPath.startsWith("/") ? rawLandingPath : `/${rawLandingPath}`, origin);
  const params = {
    utm_source: normalizeUtmValue(values.utm_source),
    utm_medium: normalizeUtmValue(values.utm_medium),
    utm_campaign: normalizeUtmValue(values.utm_campaign),
    utm_term: normalizeUtmValue(values.utm_term),
    utm_content: normalizeUtmValue(values.utm_content),
  };

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return url.toString();
}

function attributionTokensFromLead(lead) {
  const channelParts = String(lead?.channel_detail || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const tokens = [
    lead?.campaign_id,
    lead?.campaign_name,
    lead?.utm_campaign,
    lead?.utm_source,
    lead?.source_type,
    ...channelParts,
    ...channelParts.map((part) => part.split("=").slice(1).join("=")),
  ];

  return tokens.map(normalizeToken).filter(Boolean);
}

function attributionTokensFromVisit(visit) {
  return [
    visit?.campaign_id,
    visit?.lead_source_id,
    visit?.utm_campaign,
    visit?.utm_source,
    visit?.utm_medium,
  ].map(normalizeToken).filter(Boolean);
}

function explicitCampaignTokensFromLead(lead) {
  const entries = channelDetailEntries(lead);
  return [
    lead?.campaign_id,
    lead?.campaign_name,
    lead?.utm_campaign,
    entries.utm_campaign,
  ].map(normalizeToken).filter(Boolean);
}

function explicitCampaignTokensFromVisit(visit) {
  return [
    visit?.campaign_id,
    visit?.utm_campaign,
  ].map(normalizeToken).filter(Boolean);
}

function matchesCampaignAttribution(allTokens, explicitCampaignTokens, campaignTokens, sourceToken) {
  if (explicitCampaignTokens.length) {
    return explicitCampaignTokens.some((token) => campaignTokens.includes(token));
  }
  return allTokens.some((token) => campaignTokens.includes(token)) || allTokens.includes(sourceToken);
}

function leadChannelSummary(lead) {
  const parts = String(lead?.channel_detail || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const touchpoint = parts.find((part) => !part.includes("="));
  const campaign = parts.find((part) => part.startsWith("utm_campaign="))?.replace("utm_campaign=", "");
  const landing = parts.find((part) => part.startsWith("landing="))?.replace("landing=", "");

  return [touchpoint, campaign ? `campaign: ${campaign}` : null, landing ? `landing: ${landing}` : null]
    .filter(Boolean)
    .join(" · ");
}

function channelDetailEntries(lead) {
  return Object.fromEntries(
    String(lead?.channel_detail || "")
      .split("|")
      .map((part) => part.trim())
      .filter((part) => part.includes("="))
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
      })
  );
}

function messageValue(lead, label) {
  const pattern = new RegExp(`${label}:\\s*([^|\\n]+)`, "i");
  return String(lead?.message || "").match(pattern)?.[1]?.trim() || "";
}

const routePageLabelByPath = new Map([
  ["/routes", "Routes directory"],
  ...routeLandingPages.map((page) => [`/routes/${page.slug}`, page.title]),
]);

const campaignLandingOptions = [
  { value: "/quote", label: "/quote" },
  { value: "/", label: "/" },
  { value: "/routes", label: "/routes" },
  ...routeLandingPages.map((page) => ({
    value: `/routes/${page.slug}`,
    label: `/routes/${page.slug}`,
  })),
  { value: "/about", label: "/about" },
];

function normalizeLandingPath(value) {
  if (!value) return "";
  try {
    const parsed = new URL(value, "https://www.eurasiago.com");
    return `${parsed.pathname}${parsed.search || ""}` || "/";
  } catch (error) {
    const text = String(value).trim();
    return text.startsWith("/") ? text : `/${text}`;
  }
}

function getLeadLandingPath(lead) {
  const entries = channelDetailEntries(lead);
  const fromMessage = messageValue(lead, "Route page") || messageValue(lead, "Submit page") || messageValue(lead, "First landing");
  const landing = lead?.landing_page ||
    lead?.submit_page ||
    lead?.website_visit?.landing_page ||
    lead?.website_visit_landing_page ||
    entries.submit_page ||
    entries.first_landing ||
    entries.landing ||
    fromMessage;

  return normalizeLandingPath(landing);
}

function getRoutePerformanceKey(lead) {
  const landingPath = getLeadLandingPath(lead);
  if (landingPath) return landingPath.split("?")[0] || landingPath;

  const route = [lead?.origin, lead?.destination].filter(Boolean).join(" -> ");
  if (route) return `route:${route}`;

  return "unknown";
}

function routePerformanceLabel(key) {
  if (routePageLabelByPath.has(key)) return routePageLabelByPath.get(key);
  if (key === "/") return "Homepage";
  if (key === "/quote") return "Quote page";
  if (key.startsWith("/routes/")) {
    return key
      .replace("/routes/", "")
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  if (key.startsWith("route:")) return key.replace("route:", "Route: ");
  if (key === "unknown") return "Landing unknown";
  return key;
}

function getRoutePerformanceAction(row) {
  const hotRate = row.leadCount > 0 ? row.hotCount / row.leadCount : 0;
  const quoteRate = row.leadCount > 0 ? row.quotedCount / row.leadCount : 0;

  if (row.visitorCount >= 20 && (row.leadCount === 0 || (row.conversionRate !== null && row.conversionRate < 0.03))) {
    return {
      priority: "P1",
      label: "修复转化",
      tone: "amber",
      nextAction: "页面已经有访问但询盘转化偏低，优先检查首屏承诺、路线匹配、移动端表单和 CTA，不要继续盲目加流量。",
      experiment: "保留同一 UTM，A/B 测试“30 秒询盘”与“获取正式报价”两个首屏主按钮，连续观察 7 天。",
    };
  }

  if (row.overdueCount > 0 || row.firstResponsePending > 1) {
    return {
      priority: "P1",
      label: "先救首响",
      tone: "rose",
      nextAction: "把这些线索先分配负责人，今天完成 WhatsApp/电话首触，避免 SEO 流量进来后无人接。",
      experiment: "在页面首屏增加更明确的 WhatsApp/Email CTA，并让表单默认询问货量和到门地址。",
    };
  }

  if (row.leadCount >= 2 && quoteRate === 0) {
    return {
      priority: "P1",
      label: "补报价承接",
      tone: "amber",
      nextAction: "抽查该落地页表单内容和销售首触话术，目标是把路线、货量、发货窗口补齐后创建报价。",
      experiment: "给该页增加“需要正式报价需提供哪些资料”的短说明，并把 CTA 文案改得更直接。",
    };
  }

  if (row.quotedCount >= 1 || hotRate >= 0.4) {
    return {
      priority: "P1",
      label: "加码复制",
      tone: "emerald",
      nextAction: "把该路线页作为投放和 SEO 优先页，围绕相同国家/仓库/服务范围扩展 2-3 个长尾页。",
      experiment: "用 UTM 生成器复制该 landing path，测试 Google/LinkedIn/合作伙伴三类来源。",
    };
  }

  if (row.leadCount === 1) {
    return {
      priority: "P2",
      label: "积累样本",
      tone: "sky",
      nextAction: "保留当前页面和 CTA，等达到 3 条线索后再判断是否加投或重写内容。",
      experiment: "把链接发给 2 个客户群或代理伙伴，验证同一路线是否还能带来询盘。",
    };
  }

  if (row.visitorCount > 0) {
    return {
      priority: "P2",
      label: "积累转化样本",
      tone: "sky",
      nextAction: "页面已有少量真实访问，先保持路线内容和埋点稳定，达到 20 个独立会话后再判断是否重写。",
      experiment: "通过合作伙伴、邮件签名或 LinkedIn 定向补充同类访客，不要混入完全不相关流量。",
    };
  }

  return {
    priority: "P3",
    label: "补归因",
    tone: "slate",
    nextAction: "确认表单是否写入 first_landing/submit_page，避免线索无法回溯到具体页面。",
    experiment: "用一条测试 UTM 链接提交询盘，检查线索池是否显示 landing page。",
  };
}

function buildRoutePerformancePlan(rows, summary) {
  if (!rows.length) return "";

  const today = new Date().toISOString().slice(0, 10);
  const sortedRows = [...rows].sort(
    (a, b) =>
      campaignActionRank(a.action?.priority) - campaignActionRank(b.action?.priority) ||
      b.overdueCount - a.overdueCount ||
      b.hotCount - a.hotCount ||
      b.quotedCount - a.quotedCount ||
      b.leadCount - a.leadCount
  );

  return [
    `路线/落地页获客行动计划 ${today}`,
    `页面访问：${summary.pageViewCount}｜独立会话：${summary.visitorCount}｜总线索：${summary.leadCount}｜访问转化：${summary.conversionRateLabel}｜待首响：${summary.firstResponsePending}｜已报价：${summary.quotedCount}`,
    "",
    ...sortedRows.slice(0, 10).map((row, index) => [
      `${index + 1}. ${row.label}｜${row.action.priority} ${row.action.label}`,
      `   页面/路线：${row.path}`,
      `   数据：访问 ${row.pageViewCount}，独立会话 ${row.visitorCount}，线索 ${row.leadCount}，访问转化 ${row.conversionRateLabel}，高意向 ${row.hotCount}，待首响 ${row.firstResponsePending}，SLA超时 ${row.overdueCount}，已报价 ${row.quotedCount}，报价率 ${row.quoteRateLabel}`,
      `   最新线索：${row.latestLeadAt || "-"}`,
      `   下一步：${row.action.nextAction}`,
      `   测试：${row.action.experiment}`,
    ].join("\n")),
    "",
    "执行节奏：每天先处理 P1 首响和未报价路线，每周把已报价/高意向路线复制成新长尾页或投放链接。",
  ].join("\n");
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "预算待录";
  return `$${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value) {
  if (!value) return "待排期";
  return String(value).slice(0, 16).replace("T", " ");
}

function formatActivityType(type) {
  const labels = {
    lead_status_update: "线索状态",
    email_follow_up: "邮件跟进",
    phone_call: "电话沟通",
    whatsapp: "WhatsApp",
    note: "备注",
  };
  return labels[type] || type || "跟进记录";
}

function getEmailTaskStatusClass(status) {
  switch (status) {
    case "sent":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "replied":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "canceled":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function getEmailTaskStatusLabel(status) {
  const labels = {
    pending: "待发送",
    sent: "已发送",
    replied: "已回复",
    failed: "失败",
    canceled: "已取消",
  };
  return labels[status] || status || "待发送";
}

function getChannelAdvice({ leadCount, hotCount, quotedCount }) {
  if (quotedCount >= 2 || (leadCount > 0 && hotCount / leadCount >= 0.4)) {
    return "优先加投：高意向或报价转化较好";
  }
  if (leadCount >= 3 && quotedCount === 0) {
    return "优化落地页：线索不少但报价不足";
  }
  if (leadCount === 0) {
    return "待验证：需要更多流量或埋点";
  }
  return "继续观察：保留跟进节奏";
}

function getCampaignAction(row) {
  const hotRate = row.leadCount > 0 ? row.hotCount / row.leadCount : 0;
  const quoteRate = row.quoteRate || 0;
  const cpl = Number(row.cpl || 0);

  if (row.visitorCount >= 20 && (row.leadCount === 0 || (row.conversionRate !== null && row.conversionRate < 0.03))) {
    return {
      label: "修复落地转化",
      tone: "amber",
      priority: "P1",
      goal: "把已有流量转成询盘",
      nextAction: "暂停扩量，检查广告承诺与落地页是否一致，并缩短首屏到询盘的路径。",
      experiment: "同一受众拆分两个 landing：线路页与预填报价页，7 天后按访问→询盘转化率保留胜者。",
    };
  }

  if (row.quotedCount >= 2 || (row.leadCount >= 3 && hotRate >= 0.4 && quoteRate >= 0.2)) {
    return {
      label: "加投放大",
      tone: "emerald",
      priority: "P1",
      goal: "扩大高质量询盘",
      nextAction: "复制当前 UTM 参数，新建 2 个素材版本，把预算优先给报价率最高的路线/关键词。",
      experiment: "把落地页固定到 /quote 或最匹配的线路页，测试门到门/DDP/FBA 卖点。",
    };
  }

  if (row.leadCount >= 3 && row.quotedCount === 0) {
    return {
      label: "优化承接",
      tone: "amber",
      priority: "P1",
      goal: "把线索推进到报价",
      nextAction: "检查落地页首屏、表单字段和销售首响，优先补路线、货量、发货窗口三个报价必要信息。",
      experiment: "新增“获取正式报价”CTA，并把销售首触话术聚焦到确认货物和目的地派送范围。",
    };
  }

  if (row.leadCount === 0 && row.visitorCount < 20) {
    return {
      label: "补量验证",
      tone: "slate",
      priority: "P2",
      goal: "确认渠道是否能带来线索",
      nextAction: "先用小预算或合作伙伴转发验证 UTM 是否入库，避免还没埋点就判断渠道无效。",
      experiment: "投放 3-5 个长尾关键词或把链接发给 3 个代理/客户群，观察 72 小时线索数。",
    };
  }

  if (cpl > 0 && row.hotCount === 0 && row.leadCount >= 2) {
    return {
      label: "降本筛选",
      tone: "rose",
      priority: "P2",
      goal: "减少低质量询盘",
      nextAction: "收紧关键词、人群或合作伙伴话术，排除只问低价但无货量/无发货时间的流量。",
      experiment: "在广告文案加入最低货量、欧洲派送范围和正式报价所需资料，过滤泛流量。",
    };
  }

  return {
    label: "持续观察",
    tone: "sky",
    priority: "P3",
    goal: "积累更多样本",
    nextAction: "保持当前链接和跟进节奏，每周复盘线索质量、报价率和销售反馈。",
    experiment: "补一个新素材或新线路关键词，避免只有单一素材导致判断偏差。",
  };
}

function getCampaignActionClass(tone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "rose":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function campaignRowsToCsv(rows) {
  const headers = [
    "campaign",
    "source",
    "category",
    "landing_page",
    "budget",
    "page_views",
    "visitors",
    "leads",
    "visit_to_lead_rate",
    "hot_leads",
    "quoted",
    "quote_rate",
    "cpl",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "recommendation",
    "priority",
    "next_action",
    "experiment",
  ];
  const lines = rows.map((row) => [
    row.name,
    row.source,
    row.category,
    row.landingPage,
    row.budget || 0,
    row.pageViewCount,
    row.visitorCount,
    row.leadCount,
    row.conversionRate === null ? "" : `${(row.conversionRate * 100).toFixed(1)}%`,
    row.hotCount,
    row.quotedCount,
    `${(row.quoteRate * 100).toFixed(0)}%`,
    row.cpl ? row.cpl.toFixed(2) : "",
    row.utmSource,
    row.utmMedium,
    row.utmCampaign,
    row.action?.label || row.advice,
    row.action?.priority || "",
    row.action?.nextAction || "",
    row.action?.experiment || "",
  ].map(csvCell).join(","));

  return [headers.map(csvCell).join(","), ...lines].join("\n");
}

function buildCampaignActionPlan(rows, summary) {
  if (!rows.length) return "";

  const today = new Date().toISOString().slice(0, 10);
  const actionRows = [...rows].sort(
    (a, b) =>
      campaignActionRank(a.action?.priority) - campaignActionRank(b.action?.priority) ||
      b.quotedCount - a.quotedCount ||
      b.hotCount - a.hotCount ||
      b.leadCount - a.leadCount
  );

  return [
    `Campaign 渠道行动计划 ${today}`,
    `页面访问：${summary.pageViewCount}｜独立会话：${summary.visitorCount}｜总线索：${summary.leadCount}｜访问转化：${summary.conversionRateLabel}｜已报价：${summary.quotedCount}｜平均 CPL：${summary.cpl ? `$${summary.cpl.toFixed(0)}` : "-"}`,
    "",
    ...actionRows.slice(0, 8).map((row, index) => {
      const action = row.action || getCampaignAction(row);
      return [
        `${index + 1}. ${row.name}｜${action.priority} ${action.label}`,
        `   来源：${row.source} / ${row.category}`,
        `   数据：访问 ${row.pageViewCount}，独立会话 ${row.visitorCount}，线索 ${row.leadCount}，访问转化 ${row.conversionRateLabel}，高意向 ${row.hotCount}，已报价 ${row.quotedCount}，报价率 ${(row.quoteRate * 100).toFixed(0)}%，CPL ${row.cpl ? `$${row.cpl.toFixed(0)}` : "-"}`,
        `   目标：${action.goal}`,
        `   下一步：${action.nextAction}`,
        `   测试：${action.experiment}`,
        `   UTM：${row.utmSource || "-"} / ${row.utmMedium || "-"} / ${row.utmCampaign || "-"}`,
      ].join("\n");
    }),
    "",
    "执行节奏：每天看 P1，三天看线索质量，一周看报价率；不要只按线索数加预算，要按高意向和已报价加预算。",
  ].join("\n");
}

function campaignActionRank(priority) {
  if (priority === "P1") return 1;
  if (priority === "P2") return 2;
  return 3;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function normalizeCompany(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b(ltd|limited|gmbh|srl|sas|bv|ou|sp\.?\s*z\.?\s*o\.?\s*o\.?)\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function duplicateKeysForLead(lead) {
  const keys = [];
  const email = normalizeEmail(lead.email);
  const phone = normalizePhone(lead.phone);
  const company = normalizeCompany(lead.company_name);
  const country = normalizeToken(lead.country);

  if (email) keys.push({ key: `email:${email}`, reason: "邮箱重复", searchTerm: email });
  if (phone && phone.length >= 6) keys.push({ key: `phone:${phone}`, reason: "电话重复", searchTerm: phone });
  if (company && company.length >= 4) {
    keys.push({
      key: `company:${company}:${country}`,
      reason: "公司名称相似",
      searchTerm: lead.company_name || company,
    });
  }

  return keys;
}

function leadDisplayName(lead) {
  return lead.company_name || lead.contact_name || lead.email || lead.phone || "未命名线索";
}

function isLeadUnassigned(lead) {
  return !lead?.assigned_to || ["unassigned", "未分配"].includes(String(lead.assigned_to).trim().toLowerCase());
}

function leadOwnerLabel(lead, user) {
  if (isLeadUnassigned(lead)) return "未分配";
  if (user?.id && lead.assigned_to === user.id) return "我负责";
  if (String(lead.assigned_to || "").includes("-")) return "已分配";
  return lead.assigned_to;
}

function normalizeEmailTask(task) {
  const lead = task.lead || {};

  return {
    id: task.id,
    lead_id: task.lead_id,
    company_name: lead.company_name || task.company_name || "未命名线索",
    contact_name: lead.contact_name || task.contact_name || "",
    email: lead.email || task.email || "",
    phone: lead.phone || task.phone || "",
    template: task.template_code || task.template || "lead_thank_you_en",
    subject: task.subject_snapshot || task.subject || "",
    body: task.body_snapshot || task.body || "",
    scheduled_at: task.scheduled_at,
    sent_at: task.sent_at,
    due: task.due || formatDateTime(task.scheduled_at),
    priority: task.priority ?? 100,
    status: task.status || "pending",
    trigger_ref_type: task.trigger_ref_type,
    source_type: lead.source_type || task.source_type,
    route: [lead.origin, lead.destination].filter(Boolean).join(" → "),
    isSuggestion: Boolean(task.isSuggestion),
    isLocal: Boolean(task.isLocal),
  };
}

function buildEmailDraft(task) {
  const subject = task.subject || `Follow up from EurasiaGo - ${task.route || "logistics inquiry"}`;
  const greeting = task.contact_name ? `Hi ${task.contact_name},` : "Hi,";
  const body = task.body || [
    greeting,
    "",
    "Thank you for your logistics inquiry. Could you share the cargo details, ready date, origin, destination, and preferred service mode so our team can prepare the best route and quotation?",
    "",
    "Best regards,",
    "EurasiaGo Logistics Team",
  ].join("\n");

  return { subject, body };
}

function buildLeadOutreachDraft(lead) {
  const route = [lead?.origin, lead?.destination].filter(Boolean).join(" -> ") || "your China-Europe route";
  const cargo = [lead?.cargo_desc, lead?.volume_cbm ? `${lead.volume_cbm} CBM` : null, lead?.weight_kg ? `${lead.weight_kg} KG` : null]
    .filter(Boolean)
    .join(" / ");
  const greeting = lead?.contact_name ? `Hi ${lead.contact_name},` : "Hi,";
  const subject = `China-Europe rail quote follow-up - ${route}`;
  const body = [
    greeting,
    "",
    `Thanks for your inquiry about ${route}.`,
    cargo ? `I saw the cargo note: ${cargo}.` : "Could you share the cargo name, volume, weight, ready date, and final delivery address?",
    "We can check the rail schedule, customs scope, and door delivery option, then send you a firm quote.",
    "",
    "Best regards,",
    "EurasiaGo Logistics Team",
  ].join("\n");

  return { subject, body };
}

function whatsappPhoneNumber(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function buildEmailTaskActivity(task, status, now) {
  const label = getEmailTaskStatusLabel(status);
  const { subject } = buildEmailDraft(task);
  const destination = task.email || task.phone || "客户联系方式待补";
  const contentByStatus = {
    sent: `已向 ${destination} 发送 ${task.template || "跟进"} 邮件。主题：${subject}`,
    replied: "客户已回复二次跟进，需要业务确认需求、路线和报价下一步。",
    canceled: "该邮件跟进任务已取消，请确认是否需要改用电话或 WhatsApp 跟进。",
    failed: "邮件跟进失败，请检查邮箱地址或改用其他联系方式。",
  };
  const nextActionByStatus = {
    sent: "等待客户回复，超过 2 个工作日再次跟进。",
    replied: "读取客户回复，补齐需求并创建报价。",
    canceled: "确认是否保留培育任务或转人工电话跟进。",
    failed: "检查联系人资料，改用 WhatsApp/电话触达。",
  };

  return {
    id: `local-email-activity-${task.id}-${status}-${Date.now()}`,
    lead_id: task.lead_id,
    activity_type: "email_follow_up",
    subject: `邮件任务：${label}`,
    content: contentByStatus[status] || `邮件任务状态已更新为 ${label}。`,
    result: label,
    next_action: nextActionByStatus[status] || "继续跟进客户需求。",
    created_at: now,
  };
}

function SummaryStat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </div>
  );
}

function WorkbenchQueueCard({ label, value, hint, tone = "slate", onClick }) {
  const toneClass =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${toneClass}`}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      <div className="mt-2 text-sm leading-5 opacity-80">{hint}</div>
    </button>
  );
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function LeadPoolWorkspace({ onCreateQuote, onNotify }) {
  const { user } = useAuthSession();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState("all");
  const [shipmentType, setShipmentType] = useState("all");
  const [selectedLeadId, setSelectedLeadId] = useState(leadPoolRecords[0].id);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [showCampaignBoard, setShowCampaignBoard] = useState(true);
  const [leadForm, setLeadForm] = useState(emptyLeadForm);
  const [localLeads, setLocalLeads] = useState([]);
  const [leadOverrides, setLeadOverrides] = useState({});
  const [localActivities, setLocalActivities] = useState([]);
  const [followUpForm, setFollowUpForm] = useState(emptyFollowUpForm);
  const [emailTaskStatus, setEmailTaskStatus] = useState("pending");
  const [localEmailTasks, setLocalEmailTasks] = useState([]);
  const [campaignLinkForm, setCampaignLinkForm] = useState(emptyCampaignLinkForm);
  const [dailyWorklistText, setDailyWorklistText] = useState("");
  const [campaignActionPlanText, setCampaignActionPlanText] = useState("");
  const [routeActionPlanText, setRouteActionPlanText] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const analyticsDateFrom = useMemo(
    () => new Date(Date.now() - 90 * 86400000).toISOString(),
    [],
  );

  const { data, isLoading, isError } = useLeadList({
    page: 1,
    page_size: 20,
  });
  const { data: analyticsLeadData } = useLeadList({
    page: 1,
    page_size: 500,
    date_from: analyticsDateFrom,
  });
  const { data: sourceOverview, isError: sourceOverviewError } = useLeadSourceOverview({
    is_active: true,
    page_size: 100,
  });
  const {
    data: emailTaskData,
    isError: emailTaskError,
    isLoading: isEmailTaskLoading,
  } = useEmailTaskList({
    page: 1,
    page_size: 8,
    status: emailTaskStatus === "all" ? undefined : emailTaskStatus,
  });
  const createLeadMutation = useCreateLead();

  const remoteOrSeedLeads = data?.items?.length ? data.items : leadPoolRecords;
  const sourceLeads = [...localLeads, ...remoteOrSeedLeads].map((lead) => ({
    ...lead,
    ...(leadOverrides[lead.id] || {}),
  }));
  const analyticsRemoteLeads = analyticsLeadData?.items?.length
    ? analyticsLeadData.items
    : remoteOrSeedLeads;
  const analyticsLeads = [...localLeads, ...analyticsRemoteLeads].map((lead) => ({
    ...lead,
    ...(leadOverrides[lead.id] || {}),
  }));

  const filteredLeads = useMemo(() => {
    const lowerKeyword = deferredKeyword.trim().toLowerCase();

    return sourceLeads.filter((lead) => {
      const matchesKeyword =
        !lowerKeyword ||
        [
          lead.lead_no,
          lead.company_name,
          lead.contact_name,
          lead.email,
          lead.country,
          lead.origin,
          lead.destination,
        ]
          .filter(Boolean)
          .some((item) => item.toLowerCase().includes(lowerKeyword));

      const matchesStatus = status === "all" || lead.status === status;
      const matchesMode = mode === "all" || lead.transport_mode_interest === mode;
      const matchesShipmentType =
        shipmentType === "all" || lead.shipment_type_interest === shipmentType;

      return matchesKeyword && matchesStatus && matchesMode && matchesShipmentType;
    });
  }, [deferredKeyword, mode, shipmentType, sourceLeads, status]);

  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedLeadId) || filteredLeads[0] || sourceLeads[0];
  const isSelectedLeadLocal = String(selectedLead?.id || "").startsWith("local-");
  const { data: leadActivityData, isLoading: isLeadActivityLoading } = useLeadActivities(selectedLead?.id);
  const convertLeadMutation = useConvertLeadToCustomer(selectedLead?.id || "");
  const convertLeadRpcMutation = useRpcConvertLeadToCustomer();
  const scoreLeadMutation = useScoreLead();
  const scheduleLeadFollowUpMutation = useScheduleLeadFollowUp();
  const bulkScheduleLeadFollowUpsMutation = useBulkScheduleLeadFollowUps();
  const updateEmailTaskMutation = useUpdateEmailTask();
  const updateLeadMutation = useUpdateLead();
  const addLeadActivityMutation = useAddLeadActivity();

  const updateLeadForm = (field, value) => {
    setLeadForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateCampaignLinkForm = (field, value) => {
    setCampaignLinkForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildLeadPayload = () => ({
    company_name: leadForm.company_name.trim() || null,
    contact_name: leadForm.contact_name.trim() || null,
    email: leadForm.email.trim() || null,
    phone: leadForm.phone.trim() || null,
    country: leadForm.country.trim() || null,
    source_type: leadForm.source_type,
    channel_detail: leadForm.channel_detail.trim() || null,
    intent_level: leadForm.intent_level,
    lead_score: estimateLeadScore(leadForm),
    transport_mode_interest: leadForm.transport_mode_interest,
    shipment_type_interest: leadForm.shipment_type_interest,
    origin: leadForm.origin.trim() || null,
    destination: leadForm.destination.trim() || null,
    cargo_desc: leadForm.cargo_desc.trim() || null,
    volume_cbm: Number(leadForm.volume_cbm || 0),
    weight_kg: Number(leadForm.weight_kg || 0),
    message: leadForm.message.trim() || null,
    status: "new",
  });

  const handleCreateLead = async (event) => {
    event.preventDefault();

    const hasIdentity = [leadForm.company_name, leadForm.contact_name, leadForm.email, leadForm.phone]
      .some((value) => value.trim());

    if (!hasIdentity) {
      onNotify?.({
        type: "info",
        title: "线索信息不完整",
        message: "至少填写公司、联系人、邮箱或电话中的一项，避免产生无法跟进的空线索。",
      });
      return;
    }

    const payload = buildLeadPayload();

    try {
      const created = await createLeadMutation.mutateAsync(payload);
      const normalizedLead = {
        ...payload,
        ...created,
        lead_no: created.lead_no || "NEW-LEAD",
        created_at: created.created_at || new Date().toISOString(),
      };
      setLocalLeads((prev) => [normalizedLead, ...prev.filter((lead) => lead.id !== normalizedLead.id)]);
      setSelectedLeadId(normalizedLead.id);
      setShowCreateLead(false);
      setLeadForm(emptyLeadForm);
      onNotify?.({
        type: "success",
        title: "线索已新增",
        message: `${normalizedLead.company_name || normalizedLead.contact_name || "新线索"} 已进入获客池，可立即生成跟进邮件或创建报价。`,
      });
    } catch (error) {
      const localLead = {
        ...payload,
        id: `local-lead-${Date.now()}`,
        lead_no: "LOCAL-LEAD",
        created_at: new Date().toISOString().slice(0, 10),
      };
      setLocalLeads((prev) => [localLead, ...prev]);
      setSelectedLeadId(localLead.id);
      setShowCreateLead(false);
      setLeadForm(emptyLeadForm);
      onNotify?.({
        type: "info",
        title: "线索已暂存本地",
        message: "当前账号未登录或权限不足，线索先进入本地工作台；登录后可写入 Supabase 客户池。",
      });
    }
  };

  const summary = useMemo(() => {
    const newCount = sourceLeads.filter((lead) => lead.status === "new").length;
    const hotCount = sourceLeads.filter((lead) => lead.intent_level === "hot").length;
    const quotedCount = sourceLeads.filter((lead) => lead.status === "quoted").length;
    const railCount = sourceLeads.filter((lead) => lead.transport_mode_interest === "rail").length;

    return { newCount, hotCount, quotedCount, railCount };
  }, [sourceLeads]);

  const acquisitionSources = useMemo(() => {
    const sourceMap = new Map();

    for (const lead of sourceLeads) {
      const key = lead.source_type || "unknown";
      const current = sourceMap.get(key) || { source: key, count: 0, hot: 0, quoted: 0 };
      current.count += 1;
      if (lead.intent_level === "hot") current.hot += 1;
      if (lead.status === "quoted") current.quoted += 1;
      sourceMap.set(key, current);
    }

    return Array.from(sourceMap.values()).sort((a, b) => b.count - a.count);
  }, [sourceLeads]);

  const campaignRows = useMemo(() => {
    const campaigns = sourceOverview?.campaigns || [];
    const leadSources = sourceOverview?.leadSources || [];
    const trackedVisits = (sourceOverview?.websiteVisits || []).filter((visit) =>
      String(visit.device_type || "").endsWith(":page_view")
    );
    const sourceByCode = new Map(leadSources.map((source) => [normalizeToken(source.code), source]));
    const sourceById = new Map(leadSources.map((source) => [source.id, source]));

    const rawCampaignSeeds = campaigns.length
      ? campaigns
      : [
          { campaign_name: "Rail LCL Europe Push", utm_campaign: "rail-lcl-germany", utm_source: "google", utm_medium: "cpc", budget: 1200, lead_source: { code: "google_ads", name: "Google Ads", category: "paid" } },
          { campaign_name: "Partner Referral", utm_campaign: "partner-referral", utm_source: "referral", utm_medium: "partner", budget: 0, lead_source: { code: "referral", name: "Referral", category: "referral" } },
          { campaign_name: "Website Quick Inquiry", utm_campaign: "homepage_quick_form", utm_source: "website", utm_medium: "form", budget: 0, lead_source: { code: "website_form", name: "Website Form", category: "owned" } },
        ];
    const campaignSeeds = Array.from(
      new Map(
        rawCampaignSeeds.map((campaign) => {
          const key = [
            campaign.utm_campaign || campaign.campaign_name,
            campaign.utm_source,
            campaign.utm_medium,
            campaign.landing_page,
          ].map(normalizeToken).filter(Boolean).join("|");
          return [key || campaign.id, campaign];
        }),
      ).values(),
    );

    return campaignSeeds.map((campaign) => {
      const campaignTokens = [
        campaign.id,
        campaign.campaign_name,
        campaign.utm_campaign,
        campaign.utm_source,
        campaign.lead_source_id,
        campaign.lead_source?.code,
        sourceById.get(campaign.lead_source_id)?.code,
      ].map(normalizeToken).filter(Boolean);
      const source = campaign.lead_source || sourceById.get(campaign.lead_source_id) || sourceByCode.get(normalizeToken(campaign.utm_source));
      const sourceToken = normalizeToken(source?.code || campaign.utm_source);

      const matchedLeads = analyticsLeads.filter((lead) => {
        const leadTokens = attributionTokensFromLead(lead);
        return matchesCampaignAttribution(
          leadTokens,
          explicitCampaignTokensFromLead(lead),
          campaignTokens,
          sourceToken,
        );
      });
      const matchedVisits = trackedVisits.filter((visit) => {
        const visitTokens = attributionTokensFromVisit(visit);
        return matchesCampaignAttribution(
          visitTokens,
          explicitCampaignTokensFromVisit(visit),
          campaignTokens,
          sourceToken,
        );
      });
      const visitorCount = new Set(matchedVisits.map((visit) => visit.session_id || visit.visitor_id || visit.id)).size;
      const pageViewCount = matchedVisits.length;
      const leadCount = matchedLeads.length;
      const hotCount = matchedLeads.filter((lead) => lead.intent_level === "hot" || Number(lead.lead_score || 0) >= 80).length;
      const quotedCount = matchedLeads.filter((lead) => lead.status === "quoted").length;
      const budget = Number(campaign.budget || 0);
      const cpl = budget > 0 && leadCount > 0 ? budget / leadCount : null;
      const quoteRate = leadCount > 0 ? quotedCount / leadCount : 0;
      const conversionRate = visitorCount > 0 ? leadCount / visitorCount : null;

      const row = {
        id: campaign.id || campaign.campaign_name,
        name: campaign.campaign_name,
        source: source?.name || campaign.utm_source || "Unknown",
        category: source?.category || campaign.utm_medium || "unknown",
        landingPage: campaign.landing_page || "-",
        utmSource: campaign.utm_source || source?.code || "",
        utmMedium: campaign.utm_medium || source?.category || "",
        utmCampaign: campaign.utm_campaign || normalizeUtmValue(campaign.campaign_name),
        utmTerm: campaign.utm_term || "",
        utmContent: campaign.utm_content || "",
        budget: campaign.budget,
        pageViewCount,
        visitorCount,
        leadCount,
        conversionRate,
        conversionRateLabel: conversionRate === null ? "-" : `${(conversionRate * 100).toFixed(1)}%`,
        hotCount,
        quotedCount,
        quoteRate,
        cpl,
        advice: getChannelAdvice({ leadCount, hotCount, quotedCount }),
      };
      return {
        ...row,
        action: getCampaignAction(row),
      };
    }).sort((a, b) => b.quotedCount - a.quotedCount || b.hotCount - a.hotCount || b.leadCount - a.leadCount);
  }, [analyticsLeads, sourceOverview]);

  const campaignSummary = useMemo(() => {
    const trackedVisits = (sourceOverview?.websiteVisits || []).filter((visit) =>
      String(visit.device_type || "").endsWith(":page_view")
    );
    const pageViewCount = trackedVisits.length;
    const visitorCount = new Set(trackedVisits.map((visit) => visit.session_id || visit.visitor_id || visit.id)).size;
    const leadCount = campaignRows.reduce((sum, row) => sum + row.leadCount, 0);
    const hotCount = campaignRows.reduce((sum, row) => sum + row.hotCount, 0);
    const quotedCount = campaignRows.reduce((sum, row) => sum + row.quotedCount, 0);
    const budget = campaignRows.reduce((sum, row) => sum + Number(row.budget || 0), 0);

    return {
      leadCount,
      pageViewCount,
      visitorCount,
      conversionRate: visitorCount > 0 ? leadCount / visitorCount : null,
      conversionRateLabel: visitorCount > 0 ? `${((leadCount / visitorCount) * 100).toFixed(1)}%` : "-",
      hotCount,
      quotedCount,
      budget,
      cpl: budget > 0 && leadCount > 0 ? budget / leadCount : null,
    };
  }, [campaignRows, sourceOverview]);

  const campaignActionRows = useMemo(
    () =>
      [...campaignRows].sort(
        (a, b) =>
          campaignActionRank(a.action?.priority) - campaignActionRank(b.action?.priority) ||
          b.quotedCount - a.quotedCount ||
          b.hotCount - a.hotCount ||
          b.leadCount - a.leadCount
      ),
    [campaignRows]
  );

  const routePerformanceRows = useMemo(() => {
    const buckets = new Map();
    const trackedVisits = (sourceOverview?.websiteVisits || []).filter((visit) =>
      String(visit.device_type || "").endsWith(":page_view")
    );

    for (const lead of analyticsLeads) {
      const key = getRoutePerformanceKey(lead);
      const current = buckets.get(key) || {
        key,
        path: key.startsWith("route:") ? key.replace("route:", "") : key,
        label: routePerformanceLabel(key),
        leads: [],
        visits: [],
      };
      current.leads.push(lead);
      buckets.set(key, current);
    }

    for (const visit of trackedVisits) {
      const path = normalizeLandingPath(visit.landing_page).split("?")[0] || "/";
      const current = buckets.get(path) || {
        key: path,
        path,
        label: routePerformanceLabel(path),
        leads: [],
        visits: [],
      };
      current.visits.push(visit);
      buckets.set(path, current);
    }

    return Array.from(buckets.values())
      .map((bucket) => {
        const sortedLeads = [...bucket.leads].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
        const hotCount = bucket.leads.filter((lead) => lead.intent_level === "hot" || Number(lead.lead_score || 0) >= 80).length;
        const quotedCount = bucket.leads.filter((lead) => lead.status === "quoted").length;
        const firstResponsePending = bucket.leads.filter((lead) => lead.status === "new" && !lead.first_response_at).length;
        const overdueCount = bucket.leads
          .map((lead) => getLeadFollowUpSla(lead))
          .filter((sla) => sla.isOverdue).length;
        const leadCount = bucket.leads.length;
        const pageViewCount = bucket.visits.length;
        const visitorCount = new Set(bucket.visits.map((visit) => visit.session_id || visit.visitor_id || visit.id)).size;
        const conversionRate = visitorCount > 0 ? leadCount / visitorCount : null;
        const quoteRate = leadCount > 0 ? quotedCount / leadCount : 0;
        const sampleLead = sortedLeads[0];
        const row = {
          ...bucket,
          leads: sortedLeads,
          leadCount,
          pageViewCount,
          visitorCount,
          conversionRate,
          conversionRateLabel: conversionRate === null ? "-" : `${(conversionRate * 100).toFixed(1)}%`,
          hotCount,
          quotedCount,
          firstResponsePending,
          overdueCount,
          quoteRate,
          quoteRateLabel: `${(quoteRate * 100).toFixed(0)}%`,
          latestLeadAt: sampleLead?.created_at ? String(sampleLead.created_at).slice(0, 16).replace("T", " ") : "",
          searchTerm: bucket.path.startsWith("/") ? bucket.path : [sampleLead?.origin, sampleLead?.destination].filter(Boolean).join(" "),
        };

        return {
          ...row,
          action: getRoutePerformanceAction(row),
        };
      })
      .sort(
        (a, b) =>
          campaignActionRank(a.action?.priority) - campaignActionRank(b.action?.priority) ||
          b.overdueCount - a.overdueCount ||
          b.hotCount - a.hotCount ||
          b.quotedCount - a.quotedCount ||
          b.leadCount - a.leadCount
      );
  }, [analyticsLeads, sourceOverview]);

  const routePerformanceSummary = useMemo(() => {
    const trackedVisits = (sourceOverview?.websiteVisits || []).filter((visit) =>
      String(visit.device_type || "").endsWith(":page_view")
    );
    const pageViewCount = trackedVisits.length;
    const visitorCount = new Set(trackedVisits.map((visit) => visit.session_id || visit.visitor_id || visit.id)).size;
    const leadCount = routePerformanceRows.reduce((sum, row) => sum + row.leadCount, 0);
    const hotCount = routePerformanceRows.reduce((sum, row) => sum + row.hotCount, 0);
    const quotedCount = routePerformanceRows.reduce((sum, row) => sum + row.quotedCount, 0);
    const firstResponsePending = routePerformanceRows.reduce((sum, row) => sum + row.firstResponsePending, 0);
    const overdueCount = routePerformanceRows.reduce((sum, row) => sum + row.overdueCount, 0);

    return {
      landingCount: routePerformanceRows.length,
      pageViewCount,
      visitorCount,
      leadCount,
      conversionRate: visitorCount > 0 ? leadCount / visitorCount : null,
      conversionRateLabel: visitorCount > 0 ? `${((leadCount / visitorCount) * 100).toFixed(1)}%` : "-",
      hotCount,
      quotedCount,
      firstResponsePending,
      overdueCount,
    };
  }, [routePerformanceRows, sourceOverview]);

  const duplicateGroups = useMemo(() => {
    const buckets = new Map();

    for (const lead of sourceLeads) {
      for (const item of duplicateKeysForLead(lead)) {
        const current = buckets.get(item.key) || {
          key: item.key,
          reason: item.reason,
          searchTerm: item.searchTerm,
          leads: [],
        };
        if (!current.leads.some((existing) => existing.id === lead.id)) {
          current.leads.push(lead);
        }
        buckets.set(item.key, current);
      }
    }

    return Array.from(buckets.values())
      .filter((group) => group.leads.length > 1)
      .sort((a, b) => b.leads.length - a.leads.length);
  }, [sourceLeads]);

  const duplicateLeadIds = useMemo(() => {
    const ids = new Set();
    for (const group of duplicateGroups) {
      for (const lead of group.leads) ids.add(lead.id);
    }
    return ids;
  }, [duplicateGroups]);

  const selectedDuplicateGroup = useMemo(
    () => duplicateGroups.find((group) => group.leads.some((lead) => lead.id === selectedLead?.id)),
    [duplicateGroups, selectedLead?.id]
  );

  const selectedLeadActivities = useMemo(() => {
    const remoteActivities = isSelectedLeadLocal ? [] : leadActivityData?.items || [];
    const localForLead = localActivities.filter((activity) => activity.lead_id === selectedLead?.id);
    const seen = new Set();

    return [...localForLead, ...remoteActivities]
      .filter((activity) => {
        const key = activity.id || `${activity.activity_type}-${activity.created_at}-${activity.subject}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .slice(0, 8);
  }, [isSelectedLeadLocal, leadActivityData?.items, localActivities, selectedLead?.id]);

  const suggestedEmailTasks = useMemo(
    () =>
      sourceLeads
        .filter((lead) => ["new", "contacted", "nurturing"].includes(lead.status))
        .slice(0, 6)
        .map((lead, index) => ({
          id: `suggested-${lead.id}-email`,
          lead_id: lead.id,
          company_name: lead.company_name,
          contact_name: lead.contact_name,
          email: lead.email,
          phone: lead.phone,
          template: lead.status === "nurturing" ? "reactivation_en" : "lead_thank_you_en",
          scheduled_at: null,
          due: index === 0 ? "建议今天" : `建议 T+${index} 天`,
          priority: index === 0 ? 20 : 40 + index,
          status: "pending",
          source_type: lead.source_type,
          route: [lead.origin, lead.destination].filter(Boolean).join(" → "),
          isSuggestion: true,
        })),
    [sourceLeads]
  );

  const remoteEmailTasks = useMemo(
    () => (emailTaskData?.items || []).map(normalizeEmailTask),
    [emailTaskData]
  );

  const emailTasks = useMemo(() => {
    const allBaseTasks = remoteEmailTasks.length ? remoteEmailTasks : suggestedEmailTasks.map(normalizeEmailTask);
    const baseTasks = allBaseTasks.filter(
      (task) => emailTaskStatus === "all" || task.status === emailTaskStatus
    );
    const statusFilteredLocalTasks = localEmailTasks.filter(
      (task) => emailTaskStatus === "all" || task.status === emailTaskStatus
    );
    const localIds = new Set(statusFilteredLocalTasks.map((task) => task.id));

    return [
      ...statusFilteredLocalTasks,
      ...baseTasks.filter((task) => !localIds.has(task.id)),
    ].slice(0, 8);
  }, [emailTaskStatus, localEmailTasks, remoteEmailTasks, suggestedEmailTasks]);

  const emailTaskSummary = useMemo(() => {
    const tasks = remoteEmailTasks.length ? remoteEmailTasks : suggestedEmailTasks.map(normalizeEmailTask);
    const localIds = new Set(localEmailTasks.map((task) => task.id));
    const allTasks = [...localEmailTasks, ...tasks.filter((task) => !localIds.has(task.id))];

    return {
      pending: allTasks.filter((task) => task.status === "pending").length,
      sent: allTasks.filter((task) => task.status === "sent").length,
      replied: allTasks.filter((task) => task.status === "replied").length,
      total: allTasks.length,
    };
  }, [localEmailTasks, remoteEmailTasks, suggestedEmailTasks]);

  const workbenchQueues = useMemo(() => {
    const firstFollowUp = sourceLeads.filter((lead) => lead.status === "new");
    const unassigned = sourceLeads.filter((lead) => isLeadUnassigned(lead));
    const dueFollowUps = sourceLeads
      .map((lead) => ({ lead, sla: getLeadFollowUpSla(lead) }))
      .filter((item) => item.sla.isDueSoon)
      .sort((a, b) => a.sla.sortScore - b.sla.sortScore)
      .map((item) => item.lead);
    const hotUnquoted = sourceLeads.filter(
      (lead) => (lead.intent_level === "hot" || Number(lead.lead_score || 0) >= 80) && lead.status !== "quoted"
    );

    return {
      firstFollowUp,
      unassigned,
      dueFollowUps,
      hotUnquoted,
      duplicates: duplicateGroups,
      pendingEmails: emailTaskSummary.pending,
    };
  }, [duplicateGroups, emailTaskSummary.pending, sourceLeads]);

  const dailyWorklistCount = useMemo(
    () => uniqueDailyLeadQueueItems(workbenchQueues).length,
    [workbenchQueues]
  );

  const handleBulkScheduleFollowUps = async () => {
    try {
      const result = await bulkScheduleLeadFollowUpsMutation.mutateAsync({ limit: 20 });
      onNotify?.({
        type: "success",
        title: "二次跟进已生成",
        message: `新增 ${result.created_count || 0} 条邮件任务，已有待发 ${result.existing_count || 0} 条。`,
      });
    } catch (error) {
      setLocalEmailTasks((prev) => {
        const existingIds = new Set(prev.map((task) => task.id));
        const nextTasks = suggestedEmailTasks
          .slice(0, 6)
          .map((task) => normalizeEmailTask({ ...task, id: `local-${task.id}`, isLocal: true }))
          .filter((task) => !existingIds.has(task.id));
        return [...nextTasks, ...prev].slice(0, 12);
      });
      onNotify?.({
        type: "info",
        title: "邮件跟进已本地排队",
        message: "真实数据库连接或权限就绪后，会写入 email_tasks；当前先按评分生成本地跟进建议。",
      });
    }
  };

  const handleCopyDailyWorklist = async () => {
    const text = buildDailyLeadWorklist(workbenchQueues, user);

    if (!text) {
      onNotify?.({
        type: "info",
        title: "今日清单为空",
        message: "当前没有到期、未分配、高意向未报价或待首次跟进的线索。",
      });
      return;
    }

    setDailyWorklistText(text);

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "今日跟进清单已复制",
        message: `已整理 ${dailyWorklistCount} 条优先线索，可粘贴到飞书、微信、邮件或日报中执行。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，已在下方展开清单文本，可手动选中复制。",
      });
    }
  };

  const handleFocusDuplicateGroup = (group) => {
    const firstLead = group.leads[0];
    setKeyword(group.searchTerm || leadDisplayName(firstLead));
    setStatus("all");
    setMode("all");
    setShipmentType("all");
    setSelectedLeadId(firstLead.id);
    onNotify?.({
      type: "info",
      title: "已聚焦疑似重复线索",
      message: `${group.reason}：已用 ${group.searchTerm || leadDisplayName(firstLead)} 过滤列表，请人工确认后再转客户或合并。`,
    });
  };

  const handleScoreSelectedLead = async () => {
    if (!selectedLead?.id) return;

    try {
      const result = await scoreLeadMutation.mutateAsync(selectedLead.id);
      onNotify?.({
        type: "success",
        title: "线索评分已刷新",
        message: `${selectedLead.company_name} 当前评分 ${result.lead_score}，建议：${result.next_best_action}`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "线索评分已本地评估",
        message: `${selectedLead.company_name} 建议动作：${getNextBestAction(selectedLead)}`,
      });
    }
  };

  const handleScheduleSelectedFollowUp = async () => {
    if (!selectedLead?.id) return;

    try {
      const result = await scheduleLeadFollowUpMutation.mutateAsync({ leadId: selectedLead.id });
      onNotify?.({
        type: "success",
        title: "跟进邮件已排期",
        message: `${selectedLead.company_name} 已排入 ${result.template_code || "邮件模板"}，发送时间 ${String(result.scheduled_at || "").slice(0, 16).replace("T", " ")}。`,
      });
    } catch (error) {
      const localTask = normalizeEmailTask({
        id: `local-${selectedLead.id}-email-${Date.now()}`,
        lead_id: selectedLead.id,
        company_name: selectedLead.company_name,
        contact_name: selectedLead.contact_name,
        email: selectedLead.email,
        phone: selectedLead.phone,
        template: selectedLead.status === "nurturing" ? "reactivation_en" : "lead_thank_you_en",
        due: selectedLead.intent_level === "hot" ? "建议 1 小时内" : "建议 24 小时内",
        status: "pending",
        priority: selectedLead.intent_level === "hot" ? 10 : 30,
        source_type: selectedLead.source_type,
        route: [selectedLead.origin, selectedLead.destination].filter(Boolean).join(" → "),
        isLocal: true,
      });
      setLocalEmailTasks((prev) => [localTask, ...prev.filter((task) => task.id !== localTask.id)].slice(0, 12));
      onNotify?.({
        type: "info",
        title: "跟进建议已生成",
        message: `${selectedLead.company_name} 建议使用 ${selectedLead.status === "nurturing" ? "reactivation_en" : "lead_thank_you_en"} 模板。`,
      });
    }
  };

  const handleUpdateEmailTask = async (task, status) => {
    const now = new Date().toISOString();
    const targetLead = sourceLeads.find((lead) => lead.id === task.lead_id);
    const leadPatch = task.lead_id
      ? {
          last_follow_up_at: now,
          ...(status === "sent" && targetLead?.status === "new"
            ? { status: "contacted", first_response_at: targetLead.first_response_at || now }
            : {}),
          ...(status === "replied" && targetLead?.status !== "quoted"
            ? { status: "contacted", first_response_at: targetLead?.first_response_at || now }
            : {}),
        }
      : null;
    const activityDraft = task.lead_id ? buildEmailTaskActivity(task, status, now) : null;
    const patch = {
      status,
      sent_at: status === "sent" || status === "replied" ? task.sent_at || now : task.sent_at || null,
    };

    if (task.isSuggestion || task.isLocal || String(task.id).startsWith("suggested-")) {
      setLocalEmailTasks((prev) => [
        normalizeEmailTask({ ...task, ...patch, id: task.isSuggestion ? `local-${task.id}` : task.id, isLocal: true, isSuggestion: false }),
        ...prev.filter((item) => item.id !== task.id && item.id !== `local-${task.id}`),
      ].slice(0, 12));
      if (activityDraft) {
        setLocalActivities((prev) => [activityDraft, ...prev].slice(0, 30));
      }
      if (leadPatch) {
        setLeadOverrides((prev) => ({ ...prev, [task.lead_id]: { ...(prev[task.lead_id] || {}), ...leadPatch } }));
        if (String(task.lead_id).startsWith("local-")) {
          setLocalLeads((prev) => prev.map((lead) => (lead.id === task.lead_id ? { ...lead, ...leadPatch } : lead)));
        }
      }
      onNotify?.({
        type: "success",
        title: "邮件任务已更新",
        message: `${task.company_name} 的跟进状态已标记为${getEmailTaskStatusLabel(status)}，并写入当前线索时间线。`,
      });
      return;
    }

    try {
      await updateEmailTaskMutation.mutateAsync({ taskId: task.id, ...patch });
      let timelineSynced = false;
      let leadSynced = false;

      if (activityDraft) {
        try {
          const activity = await addLeadActivityMutation.mutateAsync({
            leadId: task.lead_id,
            activity_type: activityDraft.activity_type,
            subject: activityDraft.subject,
            content: activityDraft.content,
            result: activityDraft.result,
            next_action: activityDraft.next_action,
          });
          setLocalActivities((prev) => [{ ...activityDraft, ...activity }, ...prev].slice(0, 30));
          timelineSynced = true;
        } catch (activityError) {
          setLocalActivities((prev) => [activityDraft, ...prev].slice(0, 30));
        }
      }

      if (leadPatch) {
        try {
          const updatedLead = await updateLeadMutation.mutateAsync({ leadId: task.lead_id, ...leadPatch });
          setLeadOverrides((prev) => ({ ...prev, [task.lead_id]: { ...(prev[task.lead_id] || {}), ...leadPatch, ...updatedLead } }));
          leadSynced = true;
        } catch (leadError) {
          setLeadOverrides((prev) => ({ ...prev, [task.lead_id]: { ...(prev[task.lead_id] || {}), ...leadPatch } }));
        }
      }

      onNotify?.({
        type: "success",
        title: "邮件任务已更新",
        message: [
          `${task.company_name} 的跟进状态已同步为${getEmailTaskStatusLabel(status)}。`,
          activityDraft ? (timelineSynced ? "时间线已写入。" : "时间线使用本地展示，数据库活动记录未写入。") : "",
          leadPatch ? (leadSynced ? "线索最近跟进已更新。" : "线索最近跟进使用本地展示。") : "",
        ].filter(Boolean).join(""),
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "真实邮件状态更新失败",
        message: error.message || "数据库未更新，请确认登录账号具备 marketing/admin/manager 权限。",
      });
    }
  };

  const handleOpenEmailDraft = (task) => {
    if (!task.email) {
      onNotify?.({
        type: "info",
        title: "缺少客户邮箱",
        message: `${task.company_name} 没有邮箱，请先补充联系人资料。`,
      });
      return;
    }

    const { subject, body } = buildEmailDraft(task);
    window.location.href = `mailto:${encodeURIComponent(task.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleCopyEmailDraft = async (task) => {
    const { subject, body } = buildEmailDraft(task);
    const text = [`To: ${task.email || "待补充邮箱"}`, `Subject: ${subject}`, "", body].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "邮件内容已复制",
        message: `${task.company_name} 的邮件主题和正文已复制，可粘贴到邮箱或 WhatsApp 跟进。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，请手动选中邮件内容复制。",
      });
    }
  };

  const handleCopyNextActionBrief = async () => {
    if (!selectedLead) return;

    try {
      await navigator.clipboard.writeText(buildNextActionBrief(selectedLead));
      onNotify?.({
        type: "success",
        title: "行动简报已复制",
        message: `${leadDisplayName(selectedLead)} 的跟进摘要、推荐渠道和下一步动作已复制。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，请手动复制线索详情里的行动建议。",
      });
    }
  };

  const handleCopyLeadOutreachDraft = async () => {
    if (!selectedLead) return;

    const { subject, body } = buildLeadOutreachDraft(selectedLead);
    const text = [`Subject: ${subject}`, "", body].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "首触话术已复制",
        message: `${leadDisplayName(selectedLead)} 的邮件/WhatsApp 首触内容已复制，可直接粘贴发送。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，请手动复制行动卡里的话术。",
      });
    }
  };

  const handleOpenSelectedLeadEmail = () => {
    if (!selectedLead?.email) {
      onNotify?.({
        type: "info",
        title: "缺少客户邮箱",
        message: `${leadDisplayName(selectedLead)} 没有邮箱，请先补充联系人资料或改用 WhatsApp/电话。`,
      });
      return;
    }

    const { subject, body } = buildLeadOutreachDraft(selectedLead);
    window.location.href = `mailto:${encodeURIComponent(selectedLead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleOpenSelectedLeadWhatsApp = () => {
    const phone = whatsappPhoneNumber(selectedLead?.phone);
    if (!phone) {
      onNotify?.({
        type: "info",
        title: "缺少 WhatsApp 电话",
        message: `${leadDisplayName(selectedLead)} 没有电话/WhatsApp，请先补充联系人资料或改用邮件。`,
      });
      return;
    }

    const { body } = buildLeadOutreachDraft(selectedLead);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
  };

  const handleApplyNextActionToFollowUp = () => {
    if (!selectedLead) return;

    const channel = getLeadRecommendedChannel(selectedLead);
    const route = [selectedLead.origin, selectedLead.destination].filter(Boolean).join(" -> ");
    const { body } = buildLeadOutreachDraft(selectedLead);
    const contentParts = [
      `建议通过 ${channel.label} 联系客户`,
      route ? `确认 ${route} 路线` : "补齐起运地和目的地",
      selectedLead.cargo_desc ? `货物：${selectedLead.cargo_desc}` : "补充货物信息",
      `首触话术：${body.split("\n").filter(Boolean).slice(0, 4).join(" / ")}`,
    ];

    setFollowUpForm((prev) => ({
      ...prev,
      activity_type: channel.activityType,
      result: prev.result || "准备跟进客户需求",
      content: prev.content || contentParts.join("；"),
      next_action: prev.next_action || getNextBestAction(selectedLead),
    }));
    onNotify?.({
      type: "info",
      title: "已套用下一步动作",
      message: "推荐渠道、沟通记录和下一步动作已填入跟进记录表单，可按实际沟通结果微调后保存。",
    });
  };

  const handleApplyCampaignToLinkBuilder = (row) => {
    setCampaignLinkForm({
      landing_path: row.landingPage && row.landingPage !== "-" ? row.landingPage : "/quote",
      utm_source: row.utmSource || normalizeUtmValue(row.source),
      utm_medium: row.utmMedium || normalizeUtmValue(row.category),
      utm_campaign: row.utmCampaign || normalizeUtmValue(row.name),
      utm_term: row.utmTerm || "",
      utm_content: row.utmContent || "",
    });
    onNotify?.({
      type: "info",
      title: "已套用 Campaign",
      message: `${row.name} 的 UTM 参数已填入链接生成器，可继续微调后复制。`,
    });
  };

  const handleCopyCampaignLink = async () => {
    if (!campaignLinkForm.utm_source || !campaignLinkForm.utm_medium || !campaignLinkForm.utm_campaign) {
      onNotify?.({
        type: "info",
        title: "UTM 信息不完整",
        message: "请至少填写来源、媒介和活动名，避免生成不可复盘的推广链接。",
      });
      return;
    }

    const url = buildTrackedCampaignUrl(campaignLinkForm);

    try {
      await navigator.clipboard.writeText(url);
      onNotify?.({
        type: "success",
        title: "获客链接已复制",
        message: "可直接粘贴到广告、LinkedIn、邮件签名、WhatsApp 或合作伙伴渠道。",
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: url,
      });
    }
  };

  const handleCopyCampaignActionPlan = async () => {
    const text = buildCampaignActionPlan(campaignRows, campaignSummary);

    if (!text) {
      onNotify?.({
        type: "info",
        title: "暂无 Campaign 数据",
        message: "当前没有可复盘的 campaign/source 数据，请先接入 UTM 链接或新增推广来源。",
      });
      return;
    }

    setCampaignActionPlanText(text);

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "渠道行动计划已复制",
        message: "已整理加投、优化、补量和观察建议，可直接发给销售或投放同事执行。",
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，已在看板下方展开行动计划，可手动选中复制。",
      });
    }
  };

  const handleExportCampaignCsv = () => {
    if (!campaignRows.length) {
      onNotify?.({
        type: "info",
        title: "暂无 Campaign 数据",
        message: "当前没有可导出的 campaign/source 数据。",
      });
      return;
    }

    const csv = campaignRowsToCsv(campaignRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campaign-performance-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    onNotify?.({
      type: "success",
      title: "Campaign CSV 已导出",
      message: "可用于复盘渠道预算、报价率、CPL 和下一步行动。",
    });
  };

  const handleCopyRouteActionPlan = async () => {
    const text = buildRoutePerformancePlan(routePerformanceRows, routePerformanceSummary);

    if (!text) {
      onNotify?.({
        type: "info",
        title: "暂无路线成效数据",
        message: "当前还没有可复盘的 landing page 或路线线索。",
      });
      return;
    }

    setRouteActionPlanText(text);

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "路线行动计划已复制",
        message: "已整理 SEO 页面、待首响、报价率和下一步测试建议，可直接发给销售或投放执行。",
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，已在下方展开行动计划，可手动选中复制。",
      });
    }
  };

  const handleFocusRoutePerformanceRow = (row) => {
    const firstLead = row.leads[0];
    setKeyword(row.searchTerm || firstLead?.origin || firstLead?.destination || "");
    setStatus("all");
    setMode("all");
    setShipmentType("all");
    if (firstLead?.id) setSelectedLeadId(firstLead.id);
    onNotify?.({
      type: "info",
      title: "已聚焦路线线索",
      message: `${row.label} 的线索已放到列表搜索条件中，请优先处理 P1 动作和待首响客户。`,
    });
  };

  const handleClaimLead = async (lead = selectedLead) => {
    if (!lead?.id) return;

    const ownerValue = user?.id || "当前用户";
    const patch = { assigned_to: ownerValue };
    const activityDraft = {
      id: `local-activity-${lead.id}-claim-${Date.now()}`,
      lead_id: lead.id,
      activity_type: "lead_status_update",
      subject: "认领线索",
      content: `${leadDisplayName(lead)} 已分配负责人，避免新询盘无人跟进。`,
      result: user?.email ? `负责人：${user.email}` : "本地负责人",
      next_action: getNextBestAction({ ...lead, ...patch }),
      created_at: new Date().toISOString(),
    };

    const applyLocalClaim = () => {
      if (String(lead.id).startsWith("local-")) {
        setLocalLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, ...patch } : item)));
      }
      setLeadOverrides((prev) => ({ ...prev, [lead.id]: { ...(prev[lead.id] || {}), ...patch } }));
      setLocalActivities((prev) => [activityDraft, ...prev].slice(0, 30));
    };

    if (!user?.id || String(lead.id).startsWith("local-")) {
      applyLocalClaim();
      onNotify?.({
        type: "info",
        title: "线索已本地认领",
        message: user?.id
          ? `${leadDisplayName(lead)} 是本地草稿，负责人已在当前工作台标记。`
          : "当前未登录，负责人只在本地工作台标记；登录 sales/admin 后可同步到 Supabase。",
      });
      return;
    }

    try {
      const updated = await updateLeadMutation.mutateAsync({ leadId: lead.id, ...patch });
      setLeadOverrides((prev) => ({ ...prev, [lead.id]: { ...(prev[lead.id] || {}), ...patch, ...updated } }));

      try {
        const activity = await addLeadActivityMutation.mutateAsync({
          leadId: lead.id,
          activity_type: activityDraft.activity_type,
          subject: activityDraft.subject,
          content: activityDraft.content,
          result: activityDraft.result,
          next_action: activityDraft.next_action,
        });
        setLocalActivities((prev) => [{ ...activityDraft, ...activity }, ...prev].slice(0, 30));
      } catch (activityError) {
        setLocalActivities((prev) => [activityDraft, ...prev].slice(0, 30));
      }

      onNotify?.({
        type: "success",
        title: "线索已认领",
        message: `${leadDisplayName(lead)} 已分配给当前账号，建议立即按行动卡跟进。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "认领失败",
        message: error.message || "数据库未更新，请确认当前账号具备 sales/marketing/admin 权限。",
      });
    }
  };

  const handleUpdateSelectedLeadStatus = async ({ status: nextStatus, label, result, nextAction }) => {
    if (!selectedLead?.id) return;

    const now = new Date().toISOString();
    const patch = {
      status: nextStatus,
      last_follow_up_at: now,
    };

    if (nextStatus === "contacted" && !selectedLead.first_response_at) {
      patch.first_response_at = now;
    }
    if (nextStatus === "lost") {
      patch.lost_reason = result || "业务人员标记为暂不推进";
    }

    const nextLead = {
      ...selectedLead,
      ...patch,
    };
    const activityDraft = {
      id: `local-activity-${selectedLead.id}-${Date.now()}`,
      lead_id: selectedLead.id,
      activity_type: "lead_status_update",
      subject: label,
      content: `${leadDisplayName(selectedLead)} 已更新为 ${nextStatus}。`,
      result: result || label,
      next_action: nextAction || getNextBestAction(nextLead),
      created_at: now,
    };

    if (String(selectedLead.id).startsWith("local-")) {
      setLocalLeads((prev) => prev.map((lead) => (lead.id === selectedLead.id ? nextLead : lead)));
      setLeadOverrides((prev) => ({ ...prev, [selectedLead.id]: patch }));
      setLocalActivities((prev) => [activityDraft, ...prev].slice(0, 30));
      onNotify?.({
        type: "info",
        title: `${label}已本地记录`,
        message: `${leadDisplayName(selectedLead)} 是本地草稿，状态已在当前工作台更新。`,
      });
      return;
    }

    try {
      const updated = await updateLeadMutation.mutateAsync({ leadId: selectedLead.id, ...patch });
      setLeadOverrides((prev) => ({ ...prev, [selectedLead.id]: { ...patch, ...updated } }));

      try {
        const activity = await addLeadActivityMutation.mutateAsync({
          leadId: selectedLead.id,
          activity_type: "lead_status_update",
          subject: label,
          content: `${leadDisplayName(selectedLead)} 已更新为 ${nextStatus}。`,
          result: result || label,
          next_action: nextAction || getNextBestAction(nextLead),
        });
        setLocalActivities((prev) => [{ ...activityDraft, ...activity }, ...prev].slice(0, 30));
      } catch (activityError) {
        setLocalActivities((prev) => [activityDraft, ...prev].slice(0, 30));
        // 状态更新成功时不因活动记录失败而回滚，但要让业务知道日志可能缺失。
        onNotify?.({
          type: "info",
          title: "线索状态已更新，活动记录未写入",
          message: activityError.message || "请确认当前账号是否有 activities 写入权限。",
        });
        return;
      }

      onNotify?.({
        type: "success",
        title: `${label}已同步`,
        message: `${leadDisplayName(selectedLead)} 已更新为 ${nextStatus}，并写入跟进记录。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: `${label}失败`,
        message: error.message || "数据库未更新，请确认登录账号具备 marketing/admin/manager 权限。",
      });
    }
  };

  const handleCreateFollowUpActivity = async (event) => {
    event.preventDefault();
    if (!selectedLead?.id) return;

    const hasContent = [followUpForm.result, followUpForm.content, followUpForm.next_action]
      .some((value) => value.trim());

    if (!hasContent) {
      onNotify?.({
        type: "info",
        title: "跟进内容为空",
        message: "请至少填写沟通结果、记录内容或下一步动作，避免产生空日志。",
      });
      return;
    }

    const now = new Date().toISOString();
    const activityDraft = {
      id: `local-activity-${selectedLead.id}-${Date.now()}`,
      lead_id: selectedLead.id,
      activity_type: followUpForm.activity_type,
      subject: formatActivityType(followUpForm.activity_type),
      content: followUpForm.content.trim() || `${leadDisplayName(selectedLead)} 新增了一条跟进记录。`,
      result: followUpForm.result.trim() || null,
      next_action: followUpForm.next_action.trim() || null,
      next_follow_up_at: followUpForm.next_follow_up_at || null,
      created_at: now,
    };
    const followUpPatch = {
      last_follow_up_at: now,
      ...(selectedLead.status === "new" ? { status: "contacted", first_response_at: selectedLead.first_response_at || now } : {}),
    };

    if (isSelectedLeadLocal) {
      setLocalActivities((prev) => [activityDraft, ...prev].slice(0, 30));
      setLocalLeads((prev) => prev.map((lead) => (lead.id === selectedLead.id ? { ...lead, ...followUpPatch } : lead)));
      setLeadOverrides((prev) => ({ ...prev, [selectedLead.id]: { ...(prev[selectedLead.id] || {}), ...followUpPatch } }));
      setFollowUpForm(emptyFollowUpForm);
      onNotify?.({
        type: "info",
        title: "跟进记录已本地保存",
        message: `${leadDisplayName(selectedLead)} 是本地草稿，记录已显示在当前时间线。`,
      });
      return;
    }

    try {
      const activity = await addLeadActivityMutation.mutateAsync({
        leadId: selectedLead.id,
        activity_type: activityDraft.activity_type,
        subject: activityDraft.subject,
        content: activityDraft.content,
        result: activityDraft.result,
        next_action: activityDraft.next_action,
        next_follow_up_at: activityDraft.next_follow_up_at,
      });
      setLocalActivities((prev) => [{ ...activityDraft, ...activity }, ...prev].slice(0, 30));

      try {
        const updated = await updateLeadMutation.mutateAsync({ leadId: selectedLead.id, ...followUpPatch });
        setLeadOverrides((prev) => ({ ...prev, [selectedLead.id]: { ...(prev[selectedLead.id] || {}), ...followUpPatch, ...updated } }));
      } catch (statusError) {
        setLeadOverrides((prev) => ({ ...prev, [selectedLead.id]: { ...(prev[selectedLead.id] || {}), ...followUpPatch } }));
        onNotify?.({
          type: "info",
          title: "跟进记录已写入，线索状态未同步",
          message: statusError.message || "请确认当前账号是否有 leads 更新权限。",
        });
        setFollowUpForm(emptyFollowUpForm);
        return;
      }

      setFollowUpForm(emptyFollowUpForm);
      onNotify?.({
        type: "success",
        title: "跟进记录已保存",
        message: `${leadDisplayName(selectedLead)} 的沟通记录已写入时间线。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "真实跟进记录写入失败",
        message: error.message || "数据库未写入，请确认登录账号具备 marketing/admin/manager 权限。",
      });
    }
  };

  const handleConvertCustomer = async () => {
    if (!selectedLead) return;

    try {
      const result = await convertLeadRpcMutation.mutateAsync({
        leadId: selectedLead.id,
        createPrimaryContact: true,
      });
      onNotify?.({
        type: "success",
        title: "线索已转客户",
        message: `${selectedLead.company_name} 已关联客户档案 ${result.customer_no || "记录"}。`,
        customerDraft: {
          ...selectedLead,
          customer_id: result.customer_id,
          id: result.customer_id,
          contact_id: result.contact_id,
          customer_no: result.customer_no || "CU202605270001",
        },
      });
      return;
    } catch (rpcError) {
      try {
        const result = await convertLeadMutation.mutateAsync({
          create_primary_contact: true,
        });
        onNotify?.({
          type: "success",
          title: "线索已转客户",
          message: `${selectedLead.company_name} 已关联客户档案 ${result.customer_no || "记录"}。`,
          customerDraft: {
            ...selectedLead,
            customer_id: result.customer_id,
            id: result.customer_id,
            contact_id: result.contact_id,
            customer_no: result.customer_no || "CU202605270001",
          },
        });
        return;
      } catch (restError) {
        onNotify?.({
          type: "info",
          title: "客户草稿已暂存本地",
          message: `${selectedLead.company_name} 已准备好转入客户管理，后端接口可用后会自动持久化。`,
          customerDraft: {
            ...selectedLead,
            id: null,
            customer_id: null,
            customer_no: null,
            created_from_lead_id: selectedLead.id,
          },
        });
      }
    }
  };

  const selectedLeadSla = selectedLead ? getLeadActionSla(selectedLead) : null;
  const selectedLeadChannel = selectedLead ? getLeadRecommendedChannel(selectedLead) : null;
  const selectedLeadFollowUpSla = selectedLead ? getLeadFollowUpSla(selectedLead) : null;

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-5 text-white">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
              Lead Workbench
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">今日获客待办</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              直接处理新询盘、二次邮件、查重和报价转化；当前数据来源：
              {isError ? "本地种子/暂存数据" : data?.items?.length ? "Supabase 实时线索" : "本地示例数据"}。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyDailyWorklist}
              className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!dailyWorklistCount}
            >
              复制今日清单
            </button>
            <button
              type="button"
              onClick={() => setShowCreateLead((value) => !value)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950"
            >
              {showCreateLead ? "收起录入" : "新增线索"}
            </button>
            <button
              type="button"
              onClick={handleBulkScheduleFollowUps}
              className="rounded-2xl border border-emerald-300 bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={bulkScheduleLeadFollowUpsMutation.isPending}
            >
              {bulkScheduleLeadFollowUpsMutation.isPending ? "生成中..." : "批量排跟进"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <WorkbenchQueueCard
            label="待首次跟进"
            value={workbenchQueues.firstFollowUp.length}
            hint="点击查看 new 线索"
            tone="rose"
            onClick={() => {
              setStatus("new");
              setKeyword("");
            }}
          />
          <WorkbenchQueueCard
            label="未分配线索"
            value={workbenchQueues.unassigned.length}
            hint="点击聚焦并认领负责人"
            tone="amber"
            onClick={() => {
              const firstLead = workbenchQueues.unassigned[0];
              setStatus("all");
              setKeyword(firstLead ? leadDisplayName(firstLead) : "");
              if (firstLead) setSelectedLeadId(firstLead.id);
            }}
          />
          <WorkbenchQueueCard
            label="跟进到期"
            value={workbenchQueues.dueFollowUps.length}
            hint="超时或 24 小时内到期"
            tone="rose"
            onClick={() => {
              const firstLead = workbenchQueues.dueFollowUps[0];
              setStatus("all");
              setKeyword(firstLead ? leadDisplayName(firstLead) : "");
              if (firstLead) setSelectedLeadId(firstLead.id);
            }}
          />
          <WorkbenchQueueCard
            label="高意向未报价"
            value={workbenchQueues.hotUnquoted.length}
            hint="优先确认需求并创建报价"
            tone="emerald"
            onClick={() => {
              setStatus("all");
              setKeyword(workbenchQueues.hotUnquoted[0] ? leadDisplayName(workbenchQueues.hotUnquoted[0]) : "");
              if (workbenchQueues.hotUnquoted[0]) setSelectedLeadId(workbenchQueues.hotUnquoted[0].id);
            }}
          />
          <WorkbenchQueueCard
            label="疑似重复"
            value={workbenchQueues.duplicates.length}
            hint="避免重复跟进或重复建客户"
            tone="amber"
            onClick={() => {
              const firstGroup = workbenchQueues.duplicates[0];
              if (firstGroup) handleFocusDuplicateGroup(firstGroup);
            }}
          />
          <WorkbenchQueueCard
            label="待发邮件"
            value={workbenchQueues.pendingEmails}
            hint="二次触达任务队列"
            onClick={() => {
              setEmailTaskStatus("pending");
              setShowCampaignBoard(false);
            }}
          />
        </div>
      </div>

      {dailyWorklistText && (
        <section className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-base font-bold text-emerald-950">今日跟进清单</h3>
              <p className="mt-1 text-sm text-emerald-700">
                如果浏览器不允许自动复制，可以在这里选中文本粘贴到飞书、微信、邮件或日报。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDailyWorklistText("")}
              className="self-start rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800"
            >
              收起
            </button>
          </div>
          <textarea
            readOnly
            value={dailyWorklistText}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-3 min-h-64 w-full rounded-2xl border border-emerald-200 bg-white p-4 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </section>
      )}

      {showCreateLead && (
        <form onSubmit={handleCreateLead} className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-950">快速新增线索</h3>
              <p className="mt-1 text-sm text-slate-600">适合把电话、WhatsApp、邮件、展会名片和转介绍快速录入获客池。</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
              预计评分 {estimateLeadScore(leadForm)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-xs font-semibold text-slate-600">公司名称</span>
              <input value={leadForm.company_name} onChange={(event) => updateLeadForm("company_name", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="例如 Nordic Retail GmbH" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">联系人</span>
              <input value={leadForm.contact_name} onChange={(event) => updateLeadForm("contact_name", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="联系人姓名" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">国家</span>
              <input value={leadForm.country} onChange={(event) => updateLeadForm("country", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="Germany" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">邮箱</span>
              <input type="email" value={leadForm.email} onChange={(event) => updateLeadForm("email", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="name@company.com" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">电话 / WhatsApp</span>
              <input value={leadForm.phone} onChange={(event) => updateLeadForm("phone", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="+49..." />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">获客来源</span>
              <select value={leadForm.source_type} onChange={(event) => updateLeadForm("source_type", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100">
                <option value="manual">手工录入</option>
                <option value="website_form">网站询盘</option>
                <option value="google_seo">Google SEO</option>
                <option value="google_ads">Google Ads</option>
                <option value="referral">转介绍</option>
                <option value="trade_show">展会</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">来源备注</span>
              <input value={leadForm.channel_detail} onChange={(event) => updateLeadForm("channel_detail", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="关键词/介绍人/展会名" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">意向</span>
              <select value={leadForm.intent_level} onChange={(event) => updateLeadForm("intent_level", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100">
                <option value="hot">高意向</option>
                <option value="warm">中意向</option>
                <option value="cold">培育</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">运输方式</span>
              <select value={leadForm.transport_mode_interest} onChange={(event) => updateLeadForm("transport_mode_interest", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100">
                <option value="rail">铁路</option>
                <option value="sea">海运</option>
                <option value="air">空运</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">货型</span>
              <select value={leadForm.shipment_type_interest} onChange={(event) => updateLeadForm("shipment_type_interest", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100">
                <option value="LCL">拼箱</option>
                <option value="FCL">整箱</option>
                <option value="air_cargo">空运货</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">起运地</span>
              <input value={leadForm.origin} onChange={(event) => updateLeadForm("origin", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="Shanghai / Xi'an" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">目的地</span>
              <input value={leadForm.destination} onChange={(event) => updateLeadForm("destination", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="Duisburg / Hamburg" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">体积 CBM</span>
              <input type="number" min="0" step="0.01" value={leadForm.volume_cbm} onChange={(event) => updateLeadForm("volume_cbm", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="10" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">重量 KG</span>
              <input type="number" min="0" step="0.01" value={leadForm.weight_kg} onChange={(event) => updateLeadForm("weight_kg", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="1200" />
            </label>
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-xs font-semibold text-slate-600">货物/需求备注</span>
              <input value={leadForm.cargo_desc} onChange={(event) => updateLeadForm("cargo_desc", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="家具、汽配、样品..." />
            </label>
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-xs font-semibold text-slate-600">沟通记录</span>
              <input value={leadForm.message} onChange={(event) => updateLeadForm("message", event.target.value)} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="客户关注价格/时效/清关/派送..." />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { setLeadForm(emptyLeadForm); setShowCreateLead(false); }} className="rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
              取消
            </button>
            <button type="submit" disabled={createLeadMutation.isPending} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {createLeadMutation.isPending ? "保存中..." : "保存线索"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">获客来源</h3>
              <p className="mt-1 text-sm text-slate-500">按 source_type 汇总当前线索，后续可接广告成本和转化率。</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCampaignBoard((value) => !value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              {showCampaignBoard ? "收起看板" : "Campaign 看板"}
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {acquisitionSources.map((item) => (
              <div key={item.source} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">{item.source}</div>
                    <div className="mt-1 text-xs text-slate-500">Hot {item.hot} · Quoted {item.quoted}</div>
                  </div>
                  <div className="text-2xl font-bold text-slate-950">{item.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">二次邮件跟进</h3>
              <p className="mt-1 text-sm text-slate-500">管理 email_tasks 待发队列，避免询盘进来后没人二次触达。</p>
            </div>
            <button
              type="button"
              onClick={handleBulkScheduleFollowUps}
              disabled={bulkScheduleLeadFollowUpsMutation.isPending}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkScheduleLeadFollowUpsMutation.isPending ? "排期中..." : "批量生成待发邮件"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <div className="text-xs font-semibold text-slate-500">待发送</div>
              <div className="mt-1 text-xl font-bold text-slate-950">{emailTaskSummary.pending}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <div className="text-xs font-semibold text-slate-500">已发送</div>
              <div className="mt-1 text-xl font-bold text-emerald-700">{emailTaskSummary.sent}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <div className="text-xs font-semibold text-slate-500">有回复</div>
              <div className="mt-1 text-xl font-bold text-sky-700">{emailTaskSummary.replied}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["pending", "sent", "replied", "all"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setEmailTaskStatus(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  emailTaskStatus === item
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {item === "all" ? "全部" : getEmailTaskStatusLabel(item)}
              </button>
            ))}
          </div>

          {emailTaskError && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              当前账号未登录或无权读取 email_tasks，下面先按线索评分展示本地建议队列。
            </div>
          )}

          <div className="mt-5 grid gap-3">
            {isEmailTaskLoading ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                邮件任务加载中...
              </div>
            ) : emailTasks.length ? (
              emailTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-semibold text-emerald-950">{task.company_name}</div>
                    <div className="mt-1 text-xs text-emerald-700">
                      {[task.contact_name, task.email || task.phone].filter(Boolean).join(" · ") || "联系人待补"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        {task.template}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        task.trigger_ref_type === "auto_new_lead"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-white text-slate-500"
                      }`}>
                        {task.trigger_ref_type === "auto_new_lead" ? "自动排期" : "手动/批量"}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getEmailTaskStatusClass(task.status)}`}>
                        {getEmailTaskStatusLabel(task.status)}
                      </span>
                      {task.route ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                          {task.route}
                        </span>
                      ) : null}
                    </div>
                    {task.subject ? (
                      <div className="mt-2 line-clamp-2 text-xs text-slate-600">{task.subject}</div>
                    ) : null}
                  </div>
                  <div className="shrink-0 space-y-2 lg:text-right">
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">{task.due}</div>
                    <div className="text-[11px] font-semibold text-slate-400">优先级 {task.priority}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEmailDraft(task)}
                    disabled={!task.email}
                    className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    打开邮件草稿
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyEmailDraft(task)}
                    className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700"
                  >
                    复制邮件内容
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateEmailTask(task, "sent")}
                    disabled={updateEmailTaskMutation.isPending || task.status === "sent"}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    标记已发送
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateEmailTask(task, "replied")}
                    disabled={updateEmailTaskMutation.isPending || task.status === "replied"}
                    className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    客户已回复
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateEmailTask(task, "canceled")}
                    disabled={updateEmailTaskMutation.isPending || task.status === "canceled"}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    取消
                  </button>
                </div>
              </div>
              ))
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                暂无邮件任务。可以点击批量生成，或选中线索后生成跟进邮件。
              </div>
            )}
          </div>
        </div>
      </div>

      {showCampaignBoard && (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Campaign 成效看板</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                把广告、SEO、官网询盘和转介绍放在一起看，区分“没有流量”和“有流量但不转化”。访问数据从新版页面埋点启用后开始累计。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyCampaignActionPlan}
                  className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  复制渠道行动计划
                </button>
                <button
                  type="button"
                  onClick={handleExportCampaignCsv}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  导出 Campaign CSV
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <SummaryStat label="页面访问" value={campaignSummary.pageViewCount} hint="近 90 天新埋点" />
              <SummaryStat label="独立会话" value={campaignSummary.visitorCount} hint="同会话去重" />
              <SummaryStat label="渠道线索" value={campaignSummary.leadCount} hint="匹配 campaign/source" />
              <SummaryStat label="访问转化" value={campaignSummary.conversionRateLabel} hint="会话 → 询盘" />
              <SummaryStat label="已报价" value={campaignSummary.quotedCount} hint="进入报价链路" />
              <SummaryStat label="平均 CPL" value={campaignSummary.cpl ? `$${campaignSummary.cpl.toFixed(0)}` : "-"} hint={formatMoney(campaignSummary.budget)} />
            </div>
          </div>

          {sourceOverviewError && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              当前无法读取 Supabase campaign 配置，已使用本地示例和线索来源生成看板。
            </div>
          )}
          {sourceOverview && sourceOverview.visitsAvailable === false ? (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              访问明细仅对 admin / manager / marketing 开放。登录对应角色后即可查看真实访问和转化率。
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {campaignActionRows.slice(0, 3).map((row) => (
              <article key={`action-${row.id}`} className={`rounded-3xl border p-4 ${getCampaignActionClass(row.action?.tone)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{row.action?.priority}</div>
                    <h4 className="mt-1 text-base font-bold">{row.action?.label}</h4>
                  </div>
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold">
                    {row.conversionRateLabel} 访问转化
                  </span>
                </div>
                <div className="mt-3 font-semibold">{row.name}</div>
                <p className="mt-2 text-sm leading-6 opacity-85">{row.action?.nextAction}</p>
                <p className="mt-2 text-xs leading-5 opacity-75">测试：{row.action?.experiment}</p>
              </article>
            ))}
          </div>

          {campaignActionPlanText && (
            <section className="mt-5 rounded-3xl border border-sky-200 bg-sky-50/70 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h4 className="text-base font-bold text-sky-950">渠道行动计划</h4>
                  <p className="mt-1 text-sm text-sky-700">
                    如果浏览器不允许自动复制，可以在这里选中文本同步给销售、投放或合作伙伴团队。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCampaignActionPlanText("")}
                  className="self-start rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800"
                >
                  收起
                </button>
              </div>
              <textarea
                readOnly
                value={campaignActionPlanText}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-3 min-h-64 w-full rounded-2xl border border-sky-200 bg-white p-4 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </section>
          )}

          <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-950">UTM 获客链接生成器</h4>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  生成带来源、媒介、活动名和内容标签的 `/quote` 链接，投放后表单会保留首次/最近触点归因，方便复盘 CPL 和报价转化。
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyCampaignLink}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
              >
                复制获客链接
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-6">
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                落地页
                <select
                  value={campaignLinkForm.landing_path}
                  onChange={(event) => updateCampaignLinkForm("landing_path", event.target.value)}
                  className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-300"
                >
                  {campaignLandingOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                utm_source
                <input
                  value={campaignLinkForm.utm_source}
                  onChange={(event) => updateCampaignLinkForm("utm_source", event.target.value)}
                  className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-300"
                  placeholder="google"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                utm_medium
                <input
                  value={campaignLinkForm.utm_medium}
                  onChange={(event) => updateCampaignLinkForm("utm_medium", event.target.value)}
                  className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-300"
                  placeholder="cpc"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                utm_campaign
                <input
                  value={campaignLinkForm.utm_campaign}
                  onChange={(event) => updateCampaignLinkForm("utm_campaign", event.target.value)}
                  className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-300"
                  placeholder="rail_lcl_europe"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                utm_term
                <input
                  value={campaignLinkForm.utm_term}
                  onChange={(event) => updateCampaignLinkForm("utm_term", event.target.value)}
                  className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-300"
                  placeholder="china europe rail"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                utm_content
                <input
                  value={campaignLinkForm.utm_content}
                  onChange={(event) => updateCampaignLinkForm("utm_content", event.target.value)}
                  className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-300"
                  placeholder="banner_a"
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-xs leading-6 text-slate-600 break-all">
              {buildTrackedCampaignUrl(campaignLinkForm)}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">来源</th>
                  <th className="px-4 py-3 text-right">预算</th>
                  <th className="px-4 py-3 text-right">访问</th>
                  <th className="px-4 py-3 text-right">会话</th>
                  <th className="px-4 py-3 text-right">线索</th>
                  <th className="px-4 py-3 text-right">访问转化</th>
                  <th className="px-4 py-3 text-right">高意向</th>
                  <th className="px-4 py-3 text-right">已报价</th>
                  <th className="px-4 py-3 text-right">报价率</th>
                  <th className="px-4 py-3 text-right">CPL</th>
                  <th className="px-4 py-3">建议</th>
                  <th className="px-4 py-3">链接</th>
                </tr>
              </thead>
              <tbody>
                {campaignRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top text-slate-700">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-950">{row.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.landingPage}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div>{row.source}</div>
                      <div className="mt-1 text-xs text-slate-400">{row.category}</div>
                    </td>
                    <td className="px-4 py-4 text-right font-medium">{formatMoney(row.budget)}</td>
                    <td className="px-4 py-4 text-right">{row.pageViewCount}</td>
                    <td className="px-4 py-4 text-right">{row.visitorCount}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-950">{row.leadCount}</td>
                    <td className="px-4 py-4 text-right font-semibold text-sky-700">{row.conversionRateLabel}</td>
                    <td className="px-4 py-4 text-right text-rose-700">{row.hotCount}</td>
                    <td className="px-4 py-4 text-right text-emerald-700">{row.quotedCount}</td>
                    <td className="px-4 py-4 text-right">{`${(row.quoteRate * 100).toFixed(0)}%`}</td>
                    <td className="px-4 py-4 text-right">{row.cpl ? `$${row.cpl.toFixed(0)}` : "-"}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getCampaignActionClass(row.action?.tone)}`}>
                        {row.action?.priority} · {row.action?.label}
                      </span>
                      <div className="mt-2 text-xs font-semibold text-slate-700">{row.action?.goal}</div>
                      <div className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{row.action?.nextAction}</div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => handleApplyCampaignToLinkBuilder(row)}
                        className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700"
                      >
                        套用参数
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">路线 / 落地页成效面板</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              按 SEO 页面、报价页或起运地-目的地聚合真实访问和线索，直接看哪些页面没流量、哪些有流量不转化、哪些路线值得复制。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyRouteActionPlan}
                className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                复制路线行动计划
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-7">
            <SummaryStat label="落地页/路线" value={routePerformanceSummary.landingCount} hint="按 landing 或路线聚合" />
            <SummaryStat label="页面访问" value={routePerformanceSummary.pageViewCount} hint="近 90 天新埋点" />
            <SummaryStat label="独立会话" value={routePerformanceSummary.visitorCount} hint="同会话去重" />
            <SummaryStat label="线索" value={routePerformanceSummary.leadCount} hint="当前可见线索" />
            <SummaryStat label="访问转化" value={routePerformanceSummary.conversionRateLabel} hint="会话 → 询盘" />
            <SummaryStat label="待首响" value={routePerformanceSummary.firstResponsePending} hint="new 且未首次响应" />
            <SummaryStat label="SLA超时" value={routePerformanceSummary.overdueCount} hint="需要优先处理" />
          </div>
        </div>

        {routeActionPlanText ? (
          <section className="mt-5 rounded-3xl border border-emerald-200 bg-white/80 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h4 className="text-base font-bold text-emerald-950">路线行动计划</h4>
                <p className="mt-1 text-sm text-emerald-700">
                  如果浏览器不允许自动复制，可以在这里选中文本同步给销售、投放或 SEO 内容团队。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRouteActionPlanText("")}
                className="self-start rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800"
              >
                收起
              </button>
            </div>
            <textarea
              readOnly
              value={routeActionPlanText}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-3 min-h-64 w-full rounded-2xl border border-emerald-200 bg-white p-4 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </section>
        ) : null}

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {routePerformanceRows.slice(0, 3).map((row) => (
            <article key={`route-action-${row.key}`} className={`rounded-3xl border p-4 ${getCampaignActionClass(row.action?.tone)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{row.action.priority}</div>
                  <h4 className="mt-1 text-base font-bold">{row.action.label}</h4>
                </div>
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold">
                  {row.conversionRateLabel} 访问转化
                </span>
              </div>
              <div className="mt-3 font-semibold">{row.label}</div>
              <p className="mt-2 text-sm leading-6 opacity-85">{row.action.nextAction}</p>
              <p className="mt-2 text-xs leading-5 opacity-75">测试：{row.action.experiment}</p>
            </article>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto rounded-3xl border border-emerald-100 bg-white">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-emerald-100 bg-emerald-50/70 text-left text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
                <th className="px-4 py-3">页面 / 路线</th>
                <th className="px-4 py-3 text-right">线索</th>
                <th className="px-4 py-3 text-right">高意向</th>
                <th className="px-4 py-3 text-right">待首响</th>
                <th className="px-4 py-3 text-right">SLA超时</th>
                <th className="px-4 py-3 text-right">已报价</th>
                <th className="px-4 py-3 text-right">报价率</th>
                <th className="px-4 py-3">建议</th>
                <th className="px-4 py-3">处理</th>
              </tr>
            </thead>
            <tbody>
              {routePerformanceRows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100 align-top text-slate-700">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-950">{row.label}</div>
                    <div className="mt-1 max-w-xs break-all text-xs text-slate-500">{row.path}</div>
                    <div className="mt-1 text-xs text-slate-400">最新线索 {row.latestLeadAt || "-"}</div>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-950">{row.leadCount}</td>
                  <td className="px-4 py-4 text-right text-rose-700">{row.hotCount}</td>
                  <td className="px-4 py-4 text-right text-amber-700">{row.firstResponsePending}</td>
                  <td className="px-4 py-4 text-right text-rose-700">{row.overdueCount}</td>
                  <td className="px-4 py-4 text-right text-emerald-700">{row.quotedCount}</td>
                  <td className="px-4 py-4 text-right">{row.quoteRateLabel}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getCampaignActionClass(row.action?.tone)}`}>
                      {row.action.priority} · {row.action.label}
                    </span>
                    <div className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{row.action.nextAction}</div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => handleFocusRoutePerformanceRow(row)}
                      className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700"
                    >
                      聚焦线索
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">线索查重提醒</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              按邮箱、电话、公司名称相似度检查重复，减少销售重复跟进和重复建客户。
            </p>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
            <div className="text-xs font-semibold text-amber-700">疑似重复组</div>
            <div className="mt-1 text-2xl font-bold text-slate-950">{duplicateGroups.length}</div>
          </div>
        </div>

        {duplicateGroups.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {duplicateGroups.slice(0, 4).map((group) => (
              <div key={group.key} className="rounded-2xl border border-amber-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{group.reason}</div>
                    <div className="mt-1 text-xs text-slate-500">{group.leads.length} 条线索可能重复</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFocusDuplicateGroup(group)}
                    className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                  >
                    聚焦处理
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.leads.slice(0, 4).map((lead) => (
                    <span key={lead.id} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      {leadDisplayName(lead)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
            当前可见线索未发现明显重复。新增官网询盘、报价页询盘或手工线索后会自动重新检测。
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex-1">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">搜索线索</label>
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="公司、联系人、路线、邮箱"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="flex flex-wrap gap-2 xl:max-w-[420px] xl:justify-end">
                {filterOptions.statuses.map((item) => (
                  <FilterButton key={item} active={status === item} onClick={() => setStatus(item)}>
                    {item === "all" ? "全部状态" : item}
                  </FilterButton>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {filterOptions.modes.map((item) => (
                  <FilterButton key={item} active={mode === item} onClick={() => setMode(item)}>
                    {item === "all" ? "全部方式" : item.toUpperCase()}
                  </FilterButton>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {filterOptions.shipmentTypes.map((item) => (
                  <FilterButton
                    key={item}
                    active={shipmentType === item}
                    onClick={() => setShipmentType(item)}
                  >
                    {item === "all" ? "全部货型" : item}
                  </FilterButton>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">线索处理队列</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {isError ? "当前使用本地/示例线索，登录有权限账号后读取 Supabase 实时数据。" : "可直接筛选、评分、排邮件、转客户或创建报价。"}
                </p>
              </div>
              <div className="text-sm font-medium text-slate-500">{filteredLeads.length} 条可见</div>
            </div>

            <div className="overflow-x-auto bg-white">
              <table className="min-w-[1120px] w-full">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-5 py-3">Lead</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Intent</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">SLA</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const isSelected = selectedLead?.id === lead.id;
                    const leadSla = getLeadFollowUpSla(lead);

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`cursor-pointer border-b border-slate-100 align-top transition hover:bg-slate-50 ${
                          isSelected ? "bg-sky-50/70" : "bg-white"
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{lead.company_name}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {lead.contact_name} · {lead.country}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-slate-400">{lead.lead_no}</span>
                            {duplicateLeadIds.has(lead.id) && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                疑似重复
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          <div>{lead.source_type}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-slate-400">
                            {leadChannelSummary(lead) || lead.campaign_name || "来源详情待补"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getIntentClass(lead.intent_level)}`}>
                            {lead.intent_level} · {lead.lead_score}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          <div className="font-medium text-slate-800">{lead.transport_mode_interest?.toUpperCase()}</div>
                          <div className="mt-1 text-xs text-slate-400">{lead.shipment_type_interest}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {lead.origin} → {lead.destination}
                        </td>
                        <td className="px-4 py-4">
                          <div className={`inline-flex flex-col rounded-2xl border px-3 py-2 text-xs font-semibold ${getSlaBadgeClass(leadSla.tone)}`}>
                            <span>{leadSla.label}</span>
                            <span className="mt-0.5 font-medium opacity-80">{leadSla.detail}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          <div className="flex flex-col items-start gap-2">
                            <span className={isLeadUnassigned(lead) ? "font-semibold text-amber-700" : ""}>
                              {leadOwnerLabel(lead, user)}
                            </span>
                            {isLeadUnassigned(lead) ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedLeadId(lead.id);
                                  handleClaimLead(lead);
                                }}
                                disabled={updateLeadMutation.isPending}
                                className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                认领
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(lead.status)}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500">{lead.created_at}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isLoading && (
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500">
                Loading live lead data...
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          {selectedLead && (
            <>
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Lead Detail</div>
                    <h3 className="mt-3 text-2xl font-bold">{selectedLead.company_name}</h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {selectedLead.contact_name} · {selectedLead.country}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getIntentClass(selectedLead.intent_level)}`}>
                    {selectedLead.intent_level}
                  </span>
                </div>

                <div className="mt-6 grid gap-3 text-sm text-slate-300">
                  <div className="rounded-2xl bg-white/5 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Contact</div>
                    <div className="mt-2">{selectedLead.email}</div>
                    <div className="mt-1">{selectedLead.phone}</div>
                  </div>
                  <div className={`rounded-2xl px-4 py-3 ${isLeadUnassigned(selectedLead) ? "border border-amber-300 bg-amber-400/10" : "bg-white/5"}`}>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Owner</div>
                    <div className={`mt-2 font-semibold ${isLeadUnassigned(selectedLead) ? "text-amber-100" : "text-slate-200"}`}>
                      {leadOwnerLabel(selectedLead, user)}
                    </div>
                    {isLeadUnassigned(selectedLead) ? (
                      <button
                        type="button"
                        onClick={() => handleClaimLead(selectedLead)}
                        disabled={updateLeadMutation.isPending}
                        className="mt-3 rounded-xl bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updateLeadMutation.isPending ? "认领中..." : "认领并跟进"}
                      </button>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-white/5 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Route</div>
                    <div className="mt-2">{selectedLead.origin} → {selectedLead.destination}</div>
                    <div className="mt-1 text-slate-400">
                      {selectedLead.transport_mode_interest?.toUpperCase()} · {selectedLead.shipment_type_interest}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-emerald-200">Next Action Card</div>
                        <div className="mt-2 text-base font-semibold text-white">{getNextBestAction(selectedLead)}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-950">
                        {selectedLead.lead_score ?? "-"} 分
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {selectedLeadFollowUpSla && (
                        <div className={`rounded-2xl border px-3 py-3 ${getSlaBadgeClass(selectedLeadFollowUpSla.tone)}`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">Follow-up SLA</div>
                          <div className="mt-1 text-lg font-bold">{selectedLeadFollowUpSla.label}</div>
                          <div className="mt-1 text-xs leading-5 opacity-80">{selectedLeadFollowUpSla.detail}</div>
                        </div>
                      )}
                      {selectedLeadSla && (
                        <div className={`rounded-2xl border px-3 py-3 ${getLeadActionToneClass(selectedLeadSla.tone)}`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">SLA</div>
                          <div className="mt-1 text-lg font-bold">{selectedLeadSla.label}</div>
                          <div className="mt-1 text-xs leading-5 opacity-80">{selectedLeadSla.detail}</div>
                        </div>
                      )}
                      {selectedLeadChannel && (
                        <div className="rounded-2xl border border-sky-300 bg-sky-400/10 px-3 py-3 text-sky-50">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">Channel</div>
                          <div className="mt-1 text-lg font-bold">{selectedLeadChannel.label}</div>
                          <div className="mt-1 break-all text-xs leading-5 opacity-80">{selectedLeadChannel.detail}</div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 text-xs text-slate-400">
                      Scored {selectedLead.last_scored_at ? String(selectedLead.last_scored_at).slice(0, 16).replace("T", " ") : "待刷新"} ·
                      {selectedLead.last_follow_up_at ? ` 最近跟进 ${String(selectedLead.last_follow_up_at).slice(0, 16).replace("T", " ")}` : " 暂无跟进"}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCopyLeadOutreachDraft}
                        className="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-bold text-slate-950"
                      >
                        复制首触话术
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenSelectedLeadWhatsApp}
                        disabled={!selectedLead.phone}
                        className="rounded-xl border border-emerald-200 bg-emerald-200/10 px-3 py-2 text-xs font-bold text-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        打开 WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenSelectedLeadEmail}
                        disabled={!selectedLead.email}
                        className="rounded-xl border border-sky-200 bg-sky-200/10 px-3 py-2 text-xs font-bold text-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        打开邮件
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyNextActionBrief}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-950"
                      >
                        复制行动简报
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyNextActionToFollowUp}
                        className="rounded-xl border border-emerald-200 bg-emerald-200/10 px-3 py-2 text-xs font-bold text-emerald-50"
                      >
                        套用到跟进记录
                      </button>
                    </div>
                  </div>
                  {selectedDuplicateGroup && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-400/10 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-amber-200">Duplicate Risk</div>
                      <div className="mt-2 text-amber-50">
                        {selectedDuplicateGroup.reason}，共 {selectedDuplicateGroup.leads.length} 条疑似重复线索。
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFocusDuplicateGroup(selectedDuplicateGroup)}
                        className="mt-3 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-slate-950"
                      >
                        查看重复线索
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h4 className="text-lg font-bold text-slate-900">Shipment Demand</h4>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cargo</div>
                    <div className="mt-2 text-sm text-slate-800">{selectedLead.cargo_desc}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Volume / Weight</div>
                    <div className="mt-2 text-sm text-slate-800">
                      {selectedLead.volume_cbm} CBM · {selectedLead.weight_kg} KG
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  {selectedLead.message}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">跟进时间线</h4>
                    <p className="mt-1 text-sm text-slate-500">状态变更、邮件、电话和业务备注会沉淀在这里。</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {selectedLeadActivities.length} 条
                  </span>
                </div>

                <form onSubmit={handleCreateFollowUpActivity} className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-slate-600">跟进方式</span>
                        <select
                          value={followUpForm.activity_type}
                          onChange={(event) => setFollowUpForm((prev) => ({ ...prev, activity_type: event.target.value }))}
                          className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="phone_call">电话</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="email_follow_up">邮件</option>
                          <option value="note">备注</option>
                        </select>
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-slate-600">下次跟进时间</span>
                        <input
                          type="datetime-local"
                          value={followUpForm.next_follow_up_at}
                          onChange={(event) => setFollowUpForm((prev) => ({ ...prev, next_follow_up_at: event.target.value }))}
                          className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                    </div>
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-slate-600">沟通结果</span>
                      <input
                        value={followUpForm.result}
                        onChange={(event) => setFollowUpForm((prev) => ({ ...prev, result: event.target.value }))}
                        className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        placeholder="例如：客户确认 12CBM，等供应商报价"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-slate-600">记录内容</span>
                      <textarea
                        value={followUpForm.content}
                        onChange={(event) => setFollowUpForm((prev) => ({ ...prev, content: event.target.value }))}
                        className="min-h-[86px] rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        placeholder="记录客户关注点、路线、货量、时效、价格或清关要求..."
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-slate-600">下一步动作</span>
                      <input
                        value={followUpForm.next_action}
                        onChange={(event) => setFollowUpForm((prev) => ({ ...prev, next_action: event.target.value }))}
                        className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        placeholder="例如：今天下班前创建报价并发送客户版报价单"
                      />
                    </label>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={addLeadActivityMutation.isPending || updateLeadMutation.isPending}
                        className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {addLeadActivityMutation.isPending ? "保存中..." : "保存跟进记录"}
                      </button>
                    </div>
                  </div>
                </form>

                <div className="mt-4 grid gap-3">
                  {isLeadActivityLoading ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      正在读取跟进记录...
                    </div>
                  ) : selectedLeadActivities.length ? (
                    selectedLeadActivities.map((activity) => (
                      <div key={activity.id || `${activity.activity_type}-${activity.created_at}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold text-slate-900">{activity.subject || formatActivityType(activity.activity_type)}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatActivityType(activity.activity_type)} · {formatDateTime(activity.created_at)}</div>
                          </div>
                          {activity.result ? (
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              {activity.result}
                            </span>
                          ) : null}
                        </div>
                        {activity.content ? (
                          <div className="mt-2 text-sm leading-6 text-slate-600">{activity.content}</div>
                        ) : null}
                        {activity.next_action ? (
                          <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-emerald-700">
                            下一步：{activity.next_action}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      暂无跟进记录。点击“标记已联系”“进入培育”或“标记丢失”后会自动生成记录。
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h4 className="text-lg font-bold text-slate-900">建议动作</h4>
                <div className="mt-4 grid gap-3">
                  {isLeadUnassigned(selectedLead) ? (
                    <button
                      type="button"
                      onClick={() => handleClaimLead(selectedLead)}
                      disabled={updateLeadMutation.isPending}
                      className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updateLeadMutation.isPending ? "认领中..." : "先认领线索"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSelectedLeadStatus({
                        status: "contacted",
                        label: "首次跟进",
                        result: "已联系客户",
                        nextAction: "确认货量、发货时间和服务范围后创建报价。",
                      })
                    }
                    disabled={updateLeadMutation.isPending || selectedLead.status === "contacted"}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updateLeadMutation.isPending ? "更新中..." : "标记已联系"}
                  </button>
                  <button
                    type="button"
                    onClick={handleScoreSelectedLead}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                  >
                    {scoreLeadMutation.isPending ? "评分中..." : "刷新评分/下一步"}
                  </button>
                  <button
                    type="button"
                    onClick={handleScheduleSelectedFollowUp}
                    className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700"
                  >
                    {scheduleLeadFollowUpMutation.isPending ? "排期中..." : "生成跟进邮件"}
                  </button>
                  <button
                    type="button"
                    onClick={handleConvertCustomer}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    转为客户
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateQuote?.(selectedLead)}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                  >
                    创建报价
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSelectedLeadStatus({
                        status: "nurturing",
                        label: "进入培育",
                        result: "客户暂未准备报价",
                        nextAction: "进入邮件培育，定期补充路线资料和案例。",
                      })
                    }
                    disabled={updateLeadMutation.isPending || selectedLead.status === "nurturing"}
                    className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    进入培育
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSelectedLeadStatus({
                        status: "lost",
                        label: "标记丢失",
                        result: "暂不推进或无效线索",
                        nextAction: "保留来源记录，后续按渠道复盘质量。",
                      })
                    }
                    disabled={updateLeadMutation.isPending || selectedLead.status === "lost"}
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    标记丢失
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                  当前推荐：{getNextBestAction(selectedLead)}
                  {selectedLeadSla ? ` 建议 ${selectedLeadSla.label} 完成。` : ""}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
