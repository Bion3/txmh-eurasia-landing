import { useMemo, useState } from "react";
import { useCustomerList } from "../../hooks/useCustomers";

function metricByKey(summary, key, fallback = 0) {
  const metric = summary?.metrics?.find?.((item) => item.key === key);
  return metric?.display_value ?? metric?.value ?? fallback;
}

function numericMetric(summary, key, fallback = 0) {
  const value = metricByKey(summary, key, fallback);
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseOverviewDate(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function overviewAgeDays(row) {
  const timestamp = parseOverviewDate(row?.last_activity_at) || parseOverviewDate(row?.updated_at) || parseOverviewDate(row?.created_at);
  if (!timestamp) return null;
  return Math.max(Math.floor((Date.now() - timestamp) / 86400000), 0);
}

function overviewCustomerMissingFields(customer) {
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

function scoreOverviewCustomer(customer) {
  let score = 100;
  const reasons = [];
  const missing = overviewCustomerMissingFields(customer);
  const ageDays = overviewAgeDays(customer);

  if (missing.length) {
    score -= Math.min(missing.length * 8, 40);
    reasons.push(`缺 ${missing.slice(0, 3).join("、")}`);
  }

  if (customer.status === "inactive") {
    score -= 28;
    reasons.push("沉睡客户");
  } else if (customer.status === "prospect") {
    score -= 10;
    reasons.push("潜客待推进");
  }

  if (ageDays !== null && ageDays > 30) {
    score -= 16;
    reasons.push(`${ageDays} 天未更新`);
  } else if (ageDays !== null && ageDays > 14) {
    score -= 8;
    reasons.push(`${ageDays} 天未更新`);
  }

  const normalizedScore = Math.max(Math.min(score, 100), 0);
  return {
    score: normalizedScore,
    priority: normalizedScore < 55 || customer.status === "inactive" ? "P1" : normalizedScore < 75 ? "P2" : "P3",
    reasons: reasons.length ? reasons : ["主数据和跟进节奏正常"],
  };
}

function buildCustomerRiskSummary(customers) {
  const rows = (customers || [])
    .map((customer) => ({
      customer,
      health: scoreOverviewCustomer(customer),
    }))
    .sort((first, second) => first.health.score - second.health.score);

  const highRiskRows = rows.filter((row) => row.health.priority === "P1");
  const watchRows = rows.filter((row) => row.health.priority === "P2");
  const topRisk = rows[0] || null;

  return {
    total: rows.length,
    highRiskCount: highRiskRows.length,
    watchCount: watchRows.length,
    lowestScore: topRisk?.health.score ?? 100,
    topRiskName: topRisk?.customer?.company_name || topRisk?.customer?.customer_no || "暂无风险客户",
    topRiskReason: topRisk?.health.reasons?.join("，") || "客户资料和跟进节奏正常",
  };
}

function buildOperatingQueues(summary, customerRiskSummary) {
  const workbench = summary?.workbench || {};

  return [
    { title: "待跟进线索", count: workbench.pending_email_tasks ?? 6, note: "待发送或即将到期的二次邮件任务", module: "leads", action: "进入线索池" },
    { title: "高风险客户", count: customerRiskSummary.highRiskCount, note: `${customerRiskSummary.topRiskName}：${customerRiskSummary.topRiskReason}`, module: "customers", action: "处理客户风险" },
    { title: "低毛利报价", count: workbench.low_margin_quotes ?? 8, note: "毛利率低于 18%，需要复核成本", module: "quotes", action: "复核报价" },
    { title: "待录成本订单", count: workbench.orders_need_costs ?? 12, note: "执行中但缺少已确认成本或应付", module: "orders", action: "处理订单" },
    { title: "待收款账单", count: workbench.pending_receivables ?? 9, note: "应收未关闭，等待收款登记", module: "finance", action: "登记收款" },
  ];
}

function buildModuleShortcuts(summary, customerRiskSummary) {
  return [
    { id: "leads", title: "营销获客", metric: `${metricByKey(summary, "today_leads", 18)} 今日新增`, action: "新建线索 / 二次邮件", color: "bg-sky-50 text-sky-800 border-sky-100" },
    { id: "customers", title: "客户管理", metric: `${customerRiskSummary.highRiskCount} 高风险`, action: "健康分 / 主数据 / 复购", color: "bg-indigo-50 text-indigo-800 border-indigo-100" },
    { id: "quotes", title: "报价中心", metric: `${metricByKey(summary, "active_quotes", 26)} 进行中`, action: "自动核价 / 毛利复核", color: "bg-emerald-50 text-emerald-800 border-emerald-100" },
    { id: "cost-center", title: "成本中心", metric: "费率库", action: "供应商 / 费用项", color: "bg-amber-50 text-amber-900 border-amber-100" },
    { id: "orders", title: "订单管理", metric: `${metricByKey(summary, "executing_orders", 41)} 执行中`, action: "录单 / 节点 / 文件", color: "bg-violet-50 text-violet-800 border-violet-100" },
    { id: "finance", title: "财务结算", metric: `${metricByKey(summary, "projected_profit", "$86.4K")} 毛利`, action: "应收 / 应付 / 核销", color: "bg-slate-100 text-slate-900 border-slate-200" },
  ];
}

const productLanes = [
  { title: "铁路拼箱", route: "中国仓 -> 欧洲站点", module: "quotes", action: "创建拼箱报价" },
  { title: "铁路整箱", route: "西安/成都/重庆 -> 华沙/汉堡", module: "quotes", action: "创建整箱报价" },
  { title: "海运整拼", route: "宁波/上海/青岛 -> 欧洲港口", module: "cost-center", action: "维护海运成本" },
  { title: "空运业务", route: "紧急样品/高时效订单", module: "orders", action: "录入空运订单" },
];

function buildFinanceChecks(summary) {
  const workbench = summary?.workbench || {};

  return [
    { label: "待二次邮件", value: workbench.pending_email_tasks ?? 6, module: "leads" },
    { label: "订单待成本", value: workbench.orders_need_costs ?? 12, module: "orders" },
    { label: "待收款账单", value: workbench.pending_receivables ?? 9, module: "finance" },
    { label: "报价低毛利", value: workbench.low_margin_quotes ?? 8, module: "quotes" },
  ];
}

function buildGrowthCommandRows(summary, customerRiskSummary) {
  const workbench = summary?.workbench || {};
  const todayLeads = numericMetric(summary, "today_leads", 18);
  const activeQuotes = numericMetric(summary, "active_quotes", 26);
  const executingOrders = numericMetric(summary, "executing_orders", 41);
  const projectedProfit = metricByKey(summary, "projected_profit", "$86.4K");

  return [
    {
      id: "lead-response",
      priority: (workbench.pending_email_tasks ?? 6) > 0 ? "P1" : "P3",
      module: "leads",
      title: "线索首响与二次触达",
      metric: `${workbench.pending_email_tasks ?? 6} 个待跟进`,
      impact: `${todayLeads} 个今日新增线索需要尽快承接`,
      nextAction: "先处理 SLA 到期、高意向未报价和未分配线索，4 小时内完成 WhatsApp/电话首触。",
    },
    {
      id: "quote-risk",
      priority: (workbench.low_margin_quotes ?? 8) > 0 ? "P1" : "P2",
      module: "quotes",
      title: "报价成交与毛利保护",
      metric: `${workbench.low_margin_quotes ?? 8} 个低毛利报价`,
      impact: `${activeQuotes} 个进行中报价影响本周成交`,
      nextAction: "先审批低毛利报价，再跟进已发未回复报价；可成交报价当天转订单。",
    },
    {
      id: "customer-health",
      priority: customerRiskSummary.highRiskCount > 0 ? "P1" : customerRiskSummary.watchCount > 0 ? "P2" : "P3",
      module: "customers",
      title: "客户健康与复购风险",
      metric: `${customerRiskSummary.highRiskCount} 个高风险客户`,
      impact: `最低健康分 ${customerRiskSummary.lowestScore}，${customerRiskSummary.topRiskName}`,
      nextAction: "先补主数据、联系人和税号/VAT，再处理沉睡客户唤醒和成交客户复购跟进。",
    },
    {
      id: "order-cost",
      priority: (workbench.orders_need_costs ?? 12) > 0 ? "P2" : "P3",
      module: "orders",
      title: "订单执行与成本锁定",
      metric: `${workbench.orders_need_costs ?? 12} 单待录成本`,
      impact: `${executingOrders} 个执行中订单决定履约体验`,
      nextAction: "优先补齐可执行、报关、放行和财务交接卡点，避免成交后利润不可控。",
    },
    {
      id: "cash-collection",
      priority: (workbench.pending_receivables ?? 9) > 0 ? "P2" : "P3",
      module: "finance",
      title: "回款与现金流",
      metric: `${workbench.pending_receivables ?? 9} 张待收款`,
      impact: `${projectedProfit} 当前毛利需要变成现金`,
      nextAction: "先催收到期/逾期应收，再确认预估成本和到期应付，避免利润停在账面。",
    },
  ].sort((first, second) => {
    const rank = { P1: 0, P2: 1, P3: 2 };
    return (rank[first.priority] ?? 9) - (rank[second.priority] ?? 9);
  });
}

function commandPriorityClass(priority) {
  if (priority === "P1") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "P2") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function buildGrowthCommandPlan(rows, summary, customerRiskSummary) {
  const workbench = summary?.workbench || {};
  const lines = [
    `增长作战清单 ${todayDate()}`,
    `今日新增线索：${metricByKey(summary, "today_leads", 18)}｜进行中报价：${metricByKey(summary, "active_quotes", 26)}｜执行中订单：${metricByKey(summary, "executing_orders", 41)}｜预计毛利：${metricByKey(summary, "projected_profit", "$86.4K")}`,
    `待跟进：${workbench.pending_email_tasks ?? 6}｜高风险客户：${customerRiskSummary.highRiskCount}｜低毛利报价：${workbench.low_margin_quotes ?? 8}｜订单待成本：${workbench.orders_need_costs ?? 12}｜待收款：${workbench.pending_receivables ?? 9}`,
    "",
  ];

  rows.forEach((row, index) => {
    lines.push(`${index + 1}. [${row.priority}] ${row.title}｜${row.metric}｜${row.impact}`);
    lines.push(`   下一步：${row.nextAction}`);
  });

  lines.push("");
  lines.push("执行建议：上午先救线索和报价，下午推进订单/成本/回款；每个模块处理完后回到总览复盘是否还有 P1。");
  return lines.join("\n");
}

function buildTraditionalSystemBenchmarkRows(summary, customerRiskSummary) {
  const workbench = summary?.workbench || {};
  const leadBacklog = workbench.pending_email_tasks ?? 6;
  const lowMarginQuotes = workbench.low_margin_quotes ?? 8;
  const ordersNeedCosts = workbench.orders_need_costs ?? 12;
  const pendingReceivables = workbench.pending_receivables ?? 9;

  return [
    {
      source: "传统 CRM",
      capability: "线索承接与销售节奏",
      adopted: "首响 SLA、二次触达、报价推进和来源归因",
      signal: `${leadBacklog} 个待跟进`,
      module: "leads",
      status: leadBacklog > 0 ? "P1" : "P3",
      nextAction: leadBacklog > 0 ? "先处理首响超时和高意向未报价线索。" : "保持线索到客户、报价的转化复盘。",
    },
    {
      source: "客户管理系统",
      capability: "客户健康与复购经营",
      adopted: "客户分层、资料缺口、沉睡唤醒和复购行动清单",
      signal: `${customerRiskSummary.highRiskCount} 个高风险客户`,
      module: "customers",
      status: customerRiskSummary.highRiskCount > 0 ? "P1" : customerRiskSummary.watchCount > 0 ? "P2" : "P3",
      nextAction: customerRiskSummary.highRiskCount > 0 ? "补齐主数据并安排沉睡客户唤醒。" : "继续记录采购窗口、路线偏好和联系人角色。",
    },
    {
      source: "供应商管理 / SRM",
      capability: "供应商与费率生命周期",
      adopted: "供应商档案、优势线路、费率有效期和补价优先级",
      signal: "费率库联动报价",
      module: "cost-center",
      status: "P2",
      nextAction: "继续沉淀供应商 KPI、报价响应时效、附件和费率审批。",
    },
    {
      source: "报价与合同系统",
      capability: "利润保护与报价版本",
      adopted: "自动核价、毛利预警、客户版报价输出和转订单",
      signal: `${lowMarginQuotes} 个低毛利报价`,
      module: "quotes",
      status: lowMarginQuotes > 0 ? "P1" : "P3",
      nextAction: lowMarginQuotes > 0 ? "低毛利报价先审批，再发送客户版报价。" : "继续补价格版本、有效期和报价审批记录。",
    },
    {
      source: "TMS / 履约系统",
      capability: "门到门执行与异常闭环",
      adopted: "订单节点、文件、成本、应收应付和财务交接",
      signal: `${ordersNeedCosts} 单待录成本`,
      module: "orders",
      status: ordersNeedCosts > 0 ? "P2" : "P3",
      nextAction: ordersNeedCosts > 0 ? "先补执行中订单的供应商成本和关键节点。" : "继续拆分订单详情深链和异常责任人。",
    },
    {
      source: "ERP / 财务系统",
      capability: "应收应付与现金流控制",
      adopted: "账龄、到期提醒、低毛利风险、收付款登记",
      signal: `${pendingReceivables} 张待收款`,
      module: "finance",
      status: pendingReceivables > 0 ? "P2" : "P3",
      nextAction: pendingReceivables > 0 ? "催收到期应收，并核对供应商应付。" : "继续补发票、对账和外部财务系统同步。",
    },
  ];
}

export default function SystemOverview({ dashboardSummary, onNavigate }) {
  const [growthPlanText, setGrowthPlanText] = useState("");
  const { data: customerList } = useCustomerList({ page: 1, page_size: 50 });
  const overviewCustomers = customerList?.items || [];
  const customerRiskSummary = useMemo(() => buildCustomerRiskSummary(overviewCustomers), [overviewCustomers]);
  const operatingQueues = buildOperatingQueues(dashboardSummary, customerRiskSummary);
  const moduleShortcuts = buildModuleShortcuts(dashboardSummary, customerRiskSummary);
  const financeChecks = buildFinanceChecks(dashboardSummary);
  const growthCommandRows = useMemo(() => buildGrowthCommandRows(dashboardSummary, customerRiskSummary), [customerRiskSummary, dashboardSummary]);
  const benchmarkRows = useMemo(() => buildTraditionalSystemBenchmarkRows(dashboardSummary, customerRiskSummary), [customerRiskSummary, dashboardSummary]);
  const growthCommandSummary = useMemo(
    () => ({
      p1Count: growthCommandRows.filter((row) => row.priority === "P1").length,
      p2Count: growthCommandRows.filter((row) => row.priority === "P2").length,
      leadBacklog: dashboardSummary?.workbench?.pending_email_tasks ?? 6,
      customerRisk: customerRiskSummary.highRiskCount,
      quoteRisk: dashboardSummary?.workbench?.low_margin_quotes ?? 8,
    }),
    [customerRiskSummary.highRiskCount, dashboardSummary?.workbench?.low_margin_quotes, dashboardSummary?.workbench?.pending_email_tasks, growthCommandRows]
  );
  const dataSource = dashboardSummary?.source === "database" ? "真实数据库" : "演示数据";

  const handleCopyGrowthCommandPlan = async () => {
    const text = buildGrowthCommandPlan(growthCommandRows, dashboardSummary, customerRiskSummary);

    try {
      await navigator.clipboard.writeText(text);
      setGrowthPlanText("");
    } catch (error) {
      setGrowthPlanText(text);
    }
  };

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),linear-gradient(135deg,_#020617,_#0f172a_52%,_#064e3b)] p-6 text-white md:p-7">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
              Growth Command
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">今日增长指挥台</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              把获客、报价、订单和回款放到同一个优先级队列里，负责人每天先抓会影响成交、利润和现金流的动作。
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">P1 动作</div>
                <div className="mt-2 text-3xl font-bold">{growthCommandSummary.p1Count}</div>
                <div className="mt-1 text-xs text-slate-400">先处理</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">P2 动作</div>
                <div className="mt-2 text-3xl font-bold">{growthCommandSummary.p2Count}</div>
                <div className="mt-1 text-xs text-slate-400">当天推进</div>
              </div>
              <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">待跟进</div>
                <div className="mt-2 text-3xl font-bold">{growthCommandSummary.leadBacklog}</div>
                <div className="mt-1 text-xs text-sky-100/70">影响获客转化</div>
              </div>
              <div className="rounded-2xl border border-indigo-300/20 bg-indigo-300/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">客户风险</div>
                <div className="mt-2 text-3xl font-bold">{growthCommandSummary.customerRisk}</div>
                <div className="mt-1 text-xs text-indigo-100/70">影响复购和成交</div>
              </div>
              <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-100">低毛利</div>
                <div className="mt-2 text-3xl font-bold">{growthCommandSummary.quoteRisk}</div>
                <div className="mt-1 text-xs text-rose-100/70">影响利润</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyGrowthCommandPlan}
              className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm"
            >
              复制增长作战清单
            </button>
          </div>

          <div className="bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-950">跨模块优先级</h3>
                <p className="mt-1 text-sm text-slate-500">点击动作可直接进入对应工作台处理。</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                来源：{dataSource}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {growthCommandRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onNavigate?.(row.module)}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${commandPriorityClass(row.priority)}`}>
                          {row.priority}
                        </span>
                        <span className="text-sm font-bold text-slate-950">{row.title}</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-500">{row.nextAction}</div>
                    </div>
                    <div className="min-w-32 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      <div>{row.metric}</div>
                      <div className="mt-1 text-xs font-normal text-slate-400">{row.impact}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {growthPlanText ? (
              <textarea
                className="mt-5 min-h-56 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 outline-none"
                value={growthPlanText}
                onChange={(event) => setGrowthPlanText(event.target.value)}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Benchmark radar</div>
            <h3 className="mt-2 text-xl font-bold text-slate-950">传统系统借鉴雷达</h3>
            <p className="mt-2 text-sm text-slate-500">
              对照成熟 CRM、客户管理、SRM、TMS 和财务系统，把可借鉴能力转成当前项目的下一步优化队列。
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="py-3 pr-4">来源系统</th>
                <th className="py-3 pr-4">成熟能力</th>
                <th className="py-3 pr-4">已借鉴到项目</th>
                <th className="py-3 pr-4">当前信号</th>
                <th className="py-3 pr-4">下一步优化</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {benchmarkRows.map((row) => (
                <tr key={`${row.source}-${row.capability}`} className="align-top text-slate-700">
                  <td className="py-4 pr-4">
                    <button
                      type="button"
                      onClick={() => onNavigate?.(row.module)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    >
                      {row.source}
                    </button>
                  </td>
                  <td className="py-4 pr-4 font-bold text-slate-950">{row.capability}</td>
                  <td className="py-4 pr-4 text-slate-500">{row.adopted}</td>
                  <td className="py-4 pr-4">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${commandPriorityClass(row.status)}`}>
                      {row.status}
                    </span>
                    <div className="mt-2 text-xs text-slate-500">{row.signal}</div>
                  </td>
                  <td className="py-4 pr-4 text-slate-500">{row.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">今日业务待办</h2>
              <p className="mt-2 text-sm text-slate-500">从获客、报价、订单到回款，优先处理会影响成交和利润的事项。当前来源：{dataSource}。</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.("leads")}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            >
              新建线索
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {operatingQueues.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => onNavigate?.(item.module)}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold text-slate-950">{item.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">{item.note}</div>
                    <div className="mt-4 text-xs font-semibold text-sky-700">{item.action}</div>
                  </div>
                  <div className="text-3xl font-bold text-slate-950">{item.count}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm md:p-6">
          <h3 className="text-xl font-bold">成本与财务预警</h3>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {financeChecks.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate?.(item.module)}
                className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
              >
                <div className="text-3xl font-bold">{item.value}</div>
                <div className="mt-2 text-sm text-slate-300">{item.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-950">业务模块入口</h3>
            <p className="mt-2 text-sm text-slate-500">选择模块开始处理列表、单据和下一步动作。</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {moduleShortcuts.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => onNavigate?.(module.id)}
              className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${module.color}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">{module.title}</div>
                  <div className="mt-2 text-sm opacity-80">{module.action}</div>
                </div>
                <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">{module.metric}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h3 className="text-xl font-bold text-slate-950">产品线快捷处理</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {productLanes.map((lane) => (
            <button
              key={lane.title}
              type="button"
              onClick={() => onNavigate?.(lane.module)}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
            >
              <div className="text-lg font-bold text-slate-950">{lane.title}</div>
              <div className="mt-2 text-sm text-slate-500">{lane.route}</div>
              <div className="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                {lane.action}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
