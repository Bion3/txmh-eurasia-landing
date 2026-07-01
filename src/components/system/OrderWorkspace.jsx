import { useEffect, useMemo, useState } from "react";
import { useRpcGeneratePayablesForOrder, useRpcGenerateReceivableForOrder } from "../../hooks/useSystemRpc";
import {
  useCreateOrder,
  useCreateOrderOperationLog,
  useOrderDetail,
  useOrderList,
  useUpdateOrder,
  useUpdateOrderTask,
} from "../../hooks/useOrders";
import { orderDetailBlueprint, orderMilestonesByMode, referenceOrderRows } from "../../system/mockData";

function getMilestoneTone(status) {
  switch (status) {
    case "done":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "active":
      return "border-sky-200 bg-sky-50 text-sky-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </div>
  );
}

function FieldItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-900">{value || "-"}</div>
    </div>
  );
}

function StatusPill({ children, tone = "slate" }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

function FinanceRowsTable({ title, rows, partyLabel, paidLabel }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h5 className="font-bold text-slate-900">{title}</h5>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
          订单财务明细
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <th className="px-4 py-3">{partyLabel}</th>
              <th className="px-4 py-3">费项</th>
              <th className="px-4 py-3">单价</th>
              <th className="px-4 py-3">数量</th>
              <th className="px-4 py-3">汇率</th>
              <th className="px-4 py-3">含税总价</th>
              <th className="px-4 py-3">币种</th>
              <th className="px-4 py-3">{paidLabel}</th>
              <th className="px-4 py-3">账单/发票</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={`${title}-${row.id || row.party}-${row.fee}`} className="border-b border-slate-100 text-slate-700">
                <td className="px-4 py-3 font-medium text-slate-900">{row.party}</td>
                <td className="px-4 py-3">{row.fee}</td>
                <td className="px-4 py-3">{row.unitPrice}</td>
                <td className="px-4 py-3">{row.qty}</td>
                <td className="px-4 py-3">{row.fx}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{row.total}</td>
                <td className="px-4 py-3">{row.currency}</td>
                <td className="px-4 py-3">{row.paid}</td>
                <td className="px-4 py-3">{row.bill}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="9" className="px-4 py-6 text-center text-sm text-slate-500">
                  暂无{title}。保存订单后可从右侧生成应收/打开成本录入。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const orderLanes = [
  { label: "铁路拼箱", transport_mode: "rail", shipment_type: "LCL" },
  { label: "铁路整箱", transport_mode: "rail", shipment_type: "FCL" },
  { label: "海运拼箱", transport_mode: "sea", shipment_type: "LCL" },
  { label: "海运整箱", transport_mode: "sea", shipment_type: "FCL" },
  { label: "空运业务", transport_mode: "air", shipment_type: "air_cargo" },
  { label: "全部业务", transport_mode: "all", shipment_type: "all" },
];
const savedViews = [
  { key: "default", label: "默认" },
  { key: "fcl", label: "整箱", shipment_type: "FCL" },
  { key: "customs_pending", label: "未报关", localFilter: (order) => String(order.customs_status || "").includes("未") },
  { key: "unsettled", label: "未结清", localFilter: (order) => String(order.receivable_status || "").includes("未") || String(order.receivable_status || "").includes("待") },
  { key: "release_pending", label: "待放行", localFilter: (order) => String(order.release_status || "").includes("待") || String(order.release_status || "").includes("未") },
];
const orderModeOptions = [
  { value: "all", label: "全部方式" },
  { value: "rail", label: "铁路" },
  { value: "sea", label: "海运" },
  { value: "air", label: "空运" },
];
const orderShipmentOptions = [
  { value: "all", label: "全部货型" },
  { value: "LCL", label: "拼箱" },
  { value: "FCL", label: "整箱" },
  { value: "air_cargo", label: "空运货物" },
];

const taskGroups = [
  {
    title: "前段",
    tone: "sky",
    tasks: [
      { label: "待入集货仓", state: "进行中", progress: "0/1" },
      { label: "待入装箱仓", state: "未开始", progress: "0/1" },
      { label: "装箱完成", state: "未开始", progress: "0/1" },
    ],
  },
  {
    title: "报关",
    tone: "amber",
    tasks: [
      { label: "报关", state: "进行中", progress: "0/1" },
      { label: "完成", state: "未开始", progress: "0/1" },
    ],
  },
  {
    title: "在途",
    tone: "emerald",
    tasks: [
      { label: "待发车", state: "进行中", progress: "0/1" },
      { label: "待发送 Pre-alert", state: "未开始", progress: "0/1" },
      { label: "已到站", state: "未开始", progress: "0/1" },
    ],
  },
];

const attachmentGroups = [
  { title: "托书", count: 1, note: "订舱单、客户托书、订舱确认" },
  { title: "报关资料", count: 1, note: "箱单、发票、申报要素、报关资料压缩包" },
  { title: "提单", count: 0, note: "草单、正本/电放、确认记录" },
  { title: "账单发票", count: 0, note: "应收账单、供应商发票、付款凭证" },
  { title: "其它附件", count: 0, note: "异常说明、客户邮件、签收回单" },
];

const taskStatusLabels = {
  not_started: "未开始",
  pending: "待处理",
  in_progress: "进行中",
  done: "完成",
  blocked: "阻塞",
  skipped: "跳过",
};

const taskGroupTones = {
  前段: "sky",
  报关: "amber",
  在途: "emerald",
  财务: "slate",
};

function buildLocalLog(action, afterValue) {
  return {
    id: `local-log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    created_at: new Date().toISOString(),
    action,
    after_value: afterValue,
  };
}

function orderQueueKey(order) {
  return order.order_no || `${order.customer}-${order.pol}-${order.pod}`;
}

function orderQueueRoute(order) {
  return [order.pol, order.pod].filter(Boolean).join(" -> ") || "路线待补";
}

function getOrderExecutionAction(order) {
  const status = String(order.order_status || "").toLowerCase();
  const customs = String(order.customs_status || "");
  const receivable = String(order.receivable_status || "");
  const release = String(order.release_status || "");
  const owner = String(order.owner || "");

  if (!owner || owner.includes("未分配")) {
    return {
      priority: "P1",
      label: "先分配负责人",
      tone: "rose",
      queue: "owner",
      nextAction: "先指定销售/客服/操作负责人，再推进节点，避免订单进入无人区。",
    };
  }

  if (status.includes("草稿") || status.includes("新订单") || status.includes("booked") || status.includes("local_draft")) {
    return {
      priority: "P1",
      label: "标记可执行",
      tone: "amber",
      queue: "executable",
      nextAction: "确认客户、路线、货物和费用后标记可执行，初始化操作节点和财务交接。",
    };
  }

  if (customs.includes("未") || customs.includes("待")) {
    return {
      priority: "P1",
      label: "推进报关",
      tone: "sky",
      queue: "customs",
      nextAction: "确认箱单、发票和申报要素，今天推进报关资料或海关放行节点。",
    };
  }

  if (release.includes("待") || release.includes("未")) {
    return {
      priority: "P2",
      label: "跟进放行",
      tone: "violet",
      queue: "release",
      nextAction: "确认费用、单证和客户放货条件，避免到站后卡在放行。",
    };
  }

  if (receivable.includes("未") || receivable.includes("待")) {
    return {
      priority: "P2",
      label: "生成财务",
      tone: "emerald",
      queue: "finance",
      nextAction: "生成应收/应付并同步财务，确保成本和回款进入结算队列。",
    };
  }

  return {
    priority: "P3",
    label: "持续跟踪",
    tone: "slate",
    queue: "watch",
    nextAction: "按当前节点继续跟踪，异常、费用变化或客户反馈要写入操作日志。",
  };
}

function orderExecutionActionClass(tone) {
  switch (tone) {
    case "rose":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "violet":
      return "border-violet-200 bg-violet-50 text-violet-800";
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function orderPriorityRank(priority) {
  if (priority === "P1") return 1;
  if (priority === "P2") return 2;
  return 3;
}

function buildOrderExecutionPlan(rows, summary) {
  if (!rows.length) return "";

  const today = new Date().toISOString().slice(0, 10);
  const sortedRows = [...rows].sort(
    (a, b) =>
      orderPriorityRank(a.action.priority) - orderPriorityRank(b.action.priority) ||
      String(a.order_date || "").localeCompare(String(b.order_date || ""))
  );

  return [
    `订单执行行动清单 ${today}`,
    `总订单：${summary.total}｜待分配：${summary.ownerCount}｜待可执行：${summary.executableCount}｜待报关：${summary.customsCount}｜待放行：${summary.releaseCount}｜待财务：${summary.financeCount}`,
    "",
    ...sortedRows.slice(0, 15).map((row, index) => [
      `${index + 1}. ${row.order_no}｜${row.customer}｜${row.action.priority} ${row.action.label}`,
      `   路线：${orderQueueRoute(row)}`,
      `   状态：订单 ${row.order_status}｜报关 ${row.customs_status}｜收款 ${row.receivable_status}｜放行 ${row.release_status}`,
      `   负责人：${row.owner || "未分配"}｜ETD ${row.etd || "-"}`,
      `   下一步：${row.action.nextAction}`,
    ].join("\n")),
    "",
    "执行建议：先分配负责人和标记可执行，再推进报关/放行；费用确认后当天生成应收应付，避免操作和财务脱节。",
  ].join("\n");
}

const doorLifecycleSteps = [
  {
    key: "pickup",
    label: "提货 / 入仓",
    customerLabel: "Waiting for pickup or warehouse receiving",
    match: /提货|集货|入仓|入集货仓|warehouse|pickup/i,
    owner: "操作",
  },
  {
    key: "loading",
    label: "装箱 / 出库",
    customerLabel: "Cargo checked and loading arranged",
    match: /装箱|出库|loading|packing/i,
    owner: "仓库",
  },
  {
    key: "export_customs",
    label: "出口报关",
    customerLabel: "Export customs in progress",
    match: /报关|海关|customs|declaration/i,
    owner: "报关",
  },
  {
    key: "main_transport",
    label: "主运输",
    customerLabel: "Main transport in transit",
    match: /发车|开船|起飞|在途|班列|departure|main|transport/i,
    owner: "操作",
  },
  {
    key: "arrival_clearance",
    label: "到站 / 进口清关",
    customerLabel: "Arrival and import clearance",
    match: /到站|到港|清关|目的站|arrival|clearance/i,
    owner: "海外代理",
  },
  {
    key: "delivery",
    label: "末端派送 / 签收",
    customerLabel: "Final delivery or POD pending",
    match: /派送|签收|放行|delivery|pod|release/i,
    owner: "海外代理",
  },
  {
    key: "finance",
    label: "财务结算",
    customerLabel: "Settlement and invoice follow-up",
    match: /财务|应收|应付|结算|收款|付款|finance|receivable|payable/i,
    owner: "财务",
  },
];

function flattenTasks(groups) {
  return groups.flatMap((group) =>
    group.tasks.map((task) => ({
      ...task,
      groupTitle: group.title,
      labelText: `${group.title} ${task.label}`,
    })),
  );
}

function lifecycleStatusFromTasks(tasks, matcher) {
  const matched = tasks.filter((task) => matcher.test(task.labelText));
  if (!matched.length) return "not_started";
  if (matched.some((task) => task.status === "done")) return "done";
  if (matched.some((task) => ["in_progress", "pending", "blocked"].includes(task.status))) return "in_progress";
  return "not_started";
}

function buildDoorLifecycle({ taskGroups: groups, order, finance }) {
  const tasks = flattenTasks(groups);
  const steps = doorLifecycleSteps.map((step) => {
    let status = lifecycleStatusFromTasks(tasks, step.match);

    if (step.key === "finance") {
      const hasRevenue = Number(finance?.revenue || 0) > 0;
      const hasCost = Number(finance?.cost || 0) > 0;
      if (hasRevenue && hasCost && status === "not_started") status = "in_progress";
    }

    return {
      ...step,
      status,
    };
  });

  const doneCount = steps.filter((step) => step.status === "done").length;
  const activeStep = steps.find((step) => step.status === "in_progress") ||
    steps.find((step) => step.status !== "done") ||
    steps[steps.length - 1];
  const openExceptions = Array.isArray(order?.exceptions)
    ? order.exceptions.filter((item) => !["closed", "resolved", "done"].includes(String(item.status || "").toLowerCase()))
    : [];
  const receivableStatus = String(order?.receivable_status || "").toLowerCase();
  const isReceivableSettled = receivableStatus.includes("已结清") || receivableStatus.includes("settled") || receivableStatus.includes("paid");
  const hasReceivableRisk = Number(finance?.revenue || 0) > 0 && !isReceivableSettled;
  const hasCostRisk = Number(finance?.cost || 0) === 0 || String(order?.cost_status || "").includes("预估");

  const risks = [
    openExceptions.length ? `${openExceptions.length} 个打开异常` : null,
    hasReceivableRisk ? "应收未结清或待生成" : null,
    hasCostRisk ? "成本未确认或仍为预估" : null,
  ].filter(Boolean);

  return {
    steps,
    activeStep,
    progress: Math.round((doneCount / steps.length) * 100),
    doneCount,
    totalCount: steps.length,
    risks,
    customerStatus: activeStep?.customerLabel || "Order is being prepared",
  };
}

function countOpenExceptions(order) {
  return Array.isArray(order?.exceptions)
    ? order.exceptions.filter((item) => !["closed", "resolved", "done"].includes(String(item.status || "").toLowerCase())).length
    : 0;
}

function scoreOrderDetailGovernance({ order, doorLifecycle, documentGroups, taskGroups: groups, finance }) {
  const documents = documentGroups || [];
  const missingDocuments = documents.filter((group) => Number(group.count || 0) === 0);
  const tasks = flattenTasks(groups || []);
  const blockedTasks = tasks.filter((task) => ["blocked", "pending"].includes(String(task.status || "").toLowerCase()));
  const logs = order?.operation_logs || [];
  const openExceptions = countOpenExceptions(order);
  const parties = order?.parties || [];
  const cargoItems = order?.cargo_items || [];
  const hasOwner = Boolean(order?.owner || order?.sales_owner_name || order?.ops_owner_name || order?.operator_name);
  const hasRoute = Boolean(order?.origin && order?.destination);
  const hasCargo = cargoItems.length > 0 || Boolean(order?.cargo_desc || order?.goods_name_cn);
  const hasParties = parties.length >= 2 || Boolean(order?.customer_id || order?.company_name || order?.customer);
  const hasRevenue = Number(finance?.revenue || 0) > 0;
  const hasCost = Number(finance?.cost || 0) > 0;

  const deductions = [
    openExceptions ? Math.min(30, openExceptions * 12) : 0,
    missingDocuments.length ? Math.min(24, missingDocuments.length * 6) : 0,
    blockedTasks.length ? Math.min(16, blockedTasks.length * 8) : 0,
    hasOwner ? 0 : 10,
    hasRoute ? 0 : 8,
    hasCargo ? 0 : 8,
    hasParties ? 0 : 8,
    hasRevenue ? 0 : 8,
    hasCost ? 0 : 10,
    logs.length ? 0 : 6,
  ];
  const score = Math.max(0, 100 - deductions.reduce((sum, value) => sum + value, 0));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
  const priority = grade === "D" || openExceptions || !hasCost ? "P1" : grade === "C" || missingDocuments.length || blockedTasks.length ? "P2" : "P3";

  const risks = [
    openExceptions ? `${openExceptions} 个打开异常未闭环` : null,
    missingDocuments.length ? `${missingDocuments.length} 类附件缺失` : null,
    blockedTasks.length ? `${blockedTasks.length} 个任务阻塞/待处理` : null,
    hasOwner ? null : "负责人未明确",
    hasRoute ? null : "起运地/目的地缺失",
    hasCargo ? null : "货物资料缺失",
    hasParties ? null : "发货人/收货人资料不足",
    hasRevenue ? null : "应收未生成",
    hasCost ? null : "应付/成本未确认",
    logs.length ? null : "操作日志为空",
  ].filter(Boolean);

  const nextActions = [
    openExceptions ? "先关闭或指定异常责任人与预计解决时间。" : null,
    missingDocuments.length ? `补齐附件：${missingDocuments.map((group) => group.title).slice(0, 4).join("、")}。` : null,
    blockedTasks.length ? "把阻塞/待处理任务更新为进行中或完成，并写入操作日志。" : null,
    !hasCost || !hasRevenue ? "生成应收应付并确认供应商成本，避免履约和财务脱节。" : null,
    !hasOwner || !hasRoute || !hasCargo || !hasParties ? "补齐负责人、路线、货物和收发货人主数据。" : null,
  ].filter(Boolean);

  return {
    score,
    grade,
    priority,
    risks,
    nextActions: nextActions.length ? nextActions : ["当前订单详情较完整，按门到门节点继续推进并保持日志更新。"],
    metrics: {
      lifecycle: `${doorLifecycle?.progress || 0}%`,
      documents: `${documents.filter((group) => Number(group.count || 0) > 0).length}/${documents.length || 0}`,
      exceptions: openExceptions,
      logs: logs.length,
    },
  };
}

function buildOrderDetailGovernancePlan(order, governance) {
  if (!order || !governance) return "";

  const today = new Date().toISOString().slice(0, 10);
  const orderNo = order.order_no || order.order_id || order.id || "手工草稿";
  return [
    `订单详情治理清单 ${today}`,
    `${orderNo}｜${order.company_name || order.customer || "客户"}｜${governance.priority}｜${governance.score}/${governance.grade}`,
    `指标：门到门 ${governance.metrics.lifecycle}｜附件 ${governance.metrics.documents}｜打开异常 ${governance.metrics.exceptions}｜日志 ${governance.metrics.logs}`,
    "",
    "风险：",
    ...(governance.risks.length ? governance.risks.map((risk) => `- ${risk}`) : ["- 当前无关键阻断"]),
    "",
    "下一步：",
    ...governance.nextActions.map((action) => `- ${action}`),
  ].join("\n");
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function documentGroupMatches(group, pattern) {
  return pattern.test(`${group?.title || ""} ${group?.note || ""}`);
}

function scoreOrderVisibilityArchiveControl({ order, doorLifecycle, documentGroups, taskGroups: groups }) {
  if (!order) {
    return {
      score: 0,
      grade: "N/A",
      priority: "P1",
      risks: ["未选择订单"],
      metrics: [],
      nextAction: "先选择订单，再检查客户轨迹、异常责任和签收归档。",
    };
  }

  const documents = documentGroups || [];
  const tasks = flattenTasks(groups || []);
  const logs = order?.operation_logs || [];
  const openExceptions = Array.isArray(order?.exceptions)
    ? order.exceptions.filter((item) => !["closed", "resolved", "done"].includes(normalizeText(item.status)))
    : [];
  const customerUpdateLogs = logs.filter((log) => /客户|轨迹|进度|通知|share|tracking|update/i.test(`${log.action || ""} ${log.after_value || ""}`));
  const hasShareToken = Boolean(order?.customer_tracking_url || order?.customer_share_url || order?.tracking_token || order?.public_tracking_token);
  const hasCustomerVisibleStatus = Boolean(order?.customer_visible_status || order?.customer_status || doorLifecycle?.customerStatus);
  const customerTraceScore = Math.min(100, (hasCustomerVisibleStatus ? 45 : 0) + (hasShareToken ? 35 : 0) + (customerUpdateLogs.length ? 20 : 0));
  const responsibilityReady = openExceptions.length
    ? Math.round((openExceptions.filter((item) =>
        Boolean(item.owner || item.owner_name || item.responsible_person || item.due_at || item.due_date || item.expected_resolution_at || item.eta),
      ).length / openExceptions.length) * 100)
    : 100;
  const podGroups = documents.filter((group) => documentGroupMatches(group, /pod|签收|回单|delivery|receipt/i));
  const hasPodArchive = podGroups.some((group) => Number(group.count || 0) > 0);
  const deliveryDone = doorLifecycle?.steps?.some((step) => step.key === "delivery" && step.status === "done");
  const podArchiveScore = hasPodArchive ? 100 : deliveryDone ? 35 : 65;
  const requiredArchivePatterns = [/托书|booking|订舱/i, /报关|customs/i, /账单|发票|invoice|bill/i, /pod|签收|回单|delivery|receipt/i];
  const archivedCount = requiredArchivePatterns.filter((pattern) =>
    documents.some((group) => documentGroupMatches(group, pattern) && Number(group.count || 0) > 0),
  ).length;
  const archiveScore = Math.round((archivedCount / requiredArchivePatterns.length) * 100);
  const score = Math.round((customerTraceScore * 0.25) + (responsibilityReady * 0.25) + (podArchiveScore * 0.25) + (archiveScore * 0.25));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const priority =
    grade === "D" || responsibilityReady < 60 || (deliveryDone && !hasPodArchive)
      ? "P1"
      : grade === "C" || customerTraceScore < 70 || archiveScore < 75
        ? "P2"
        : "P3";
  const risks = [
    customerTraceScore < 70 ? "客户轨迹分享不足" : null,
    responsibilityReady < 100 ? `${openExceptions.length} 个异常责任或预计解决时间不完整` : null,
    deliveryDone && !hasPodArchive ? "已签收但 POD/回单未归档" : null,
    !deliveryDone && !hasPodArchive ? "POD/签收回单待归档" : null,
    archiveScore < 75 ? "关键附件归档不完整" : null,
    tasks.some((task) => normalizeText(task.status) === "blocked") ? "存在阻塞任务影响客户可视进度" : null,
  ].filter(Boolean);

  let nextAction = "客户轨迹、异常责任、POD 和关键附件归档稳定，可以对客户分享进度并进入结算归档。";
  if (priority === "P1") {
    nextAction = "先补异常责任人与预计解决时间，签收后立即上传 POD/回单，再对客户同步进度。";
  } else if (priority === "P2") {
    nextAction = "本周补客户轨迹链接、进度通知日志和关键附件归档，提升订单可视化与审计完整度。";
  }

  return {
    score,
    grade,
    priority,
    risks: risks.length ? risks : ["客户轨迹与归档稳定"],
    metrics: [
      { label: "客户轨迹", value: customerTraceScore, hint: hasShareToken ? "有分享入口" : "分享入口待补" },
      { label: "异常责任", value: responsibilityReady, hint: openExceptions.length ? `${openExceptions.length} 个打开异常` : "无打开异常" },
      { label: "POD归档", value: podArchiveScore, hint: hasPodArchive ? "已归档" : deliveryDone ? "签收后待归档" : "待签收" },
      { label: "附件归档", value: archiveScore, hint: `${archivedCount}/${requiredArchivePatterns.length} 类关键附件` },
    ],
    nextAction,
  };
}

function buildOrderVisibilityArchivePlan(order, control) {
  if (!order || !control) return "";

  const today = new Date().toISOString().slice(0, 10);
  const orderNo = order.order_no || order.order_id || order.id || "手工草稿";
  return [
    `订单客户轨迹/POD归档清单 ${today}`,
    `${orderNo}｜${order.company_name || order.customer || "客户"}｜${control.priority}｜${control.score}/${control.grade}`,
    "",
    `风险：${control.risks.join("、")}`,
    `下一步：${control.nextAction}`,
    "",
    "归档建议：客户可视状态、异常责任人、预计解决时间、签收回单和关键附件必须在结算前闭环，避免客户查不到进度或签收后无法回款。",
  ].join("\n");
}

export default function OrderWorkspace({ orderDraft, selectedOrderId, onBackToQuotes, onOpenOrder, onNotify }) {
  const [activeView, setActiveView] = useState(orderDraft || selectedOrderId ? "detail" : "list");
  const [activeDetailTab, setActiveDetailTab] = useState(orderDetailBlueprint[0].tab);
  const [savedOrder, setSavedOrder] = useState(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderModeFilter, setOrderModeFilter] = useState("all");
  const [orderShipmentFilter, setOrderShipmentFilter] = useState("all");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [activeSavedView, setActiveSavedView] = useState("default");
  const [localTaskOverrides, setLocalTaskOverrides] = useState({});
  const [localOperationLogs, setLocalOperationLogs] = useState([]);
  const [orderExecutionPlanText, setOrderExecutionPlanText] = useState("");
  const [orderDetailGovernancePlanText, setOrderDetailGovernancePlanText] = useState("");
  const [orderVisibilityArchivePlanText, setOrderVisibilityArchivePlanText] = useState("");
  const [form, setForm] = useState(() => ({
    company_name: orderDraft?.company_name || orderDraft?.customer || "",
    contact_name: orderDraft?.contact_name || "",
    booking_no: orderDraft?.booking_no || "",
    container_type: orderDraft?.container_type || "",
    incoterm: orderDraft?.incoterm || "FOB",
    transport_mode: orderDraft?.transport_mode || "rail",
    shipment_type: orderDraft?.shipment_type || "LCL",
    origin: orderDraft?.origin || "",
    destination: orderDraft?.destination || "",
    cargo_desc: orderDraft?.cargo_desc || "",
    package_type: orderDraft?.package_type || "",
    pieces: orderDraft?.pieces || "",
    volume_cbm: orderDraft?.volume_cbm || "",
    weight_kg: orderDraft?.weight_kg || "",
    currency: orderDraft?.currency || "USD",
    operator_name: orderDraft?.operator_name || "",
    quoted_revenue_total: orderDraft?.estimated_revenue_total || "",
    quoted_cost_total: orderDraft?.estimated_cost_total || "",
  }));
  const orderListQuery = useMemo(
    () => ({
      page: 1,
      page_size: 20,
      ...(orderSearch.trim() ? { search: orderSearch.trim() } : {}),
      ...(orderStatusFilter !== "all" ? { status: orderStatusFilter } : {}),
      ...(orderModeFilter !== "all" ? { transport_mode: orderModeFilter } : {}),
      ...(orderShipmentFilter !== "all" ? { shipment_type: orderShipmentFilter } : {}),
      ...(orderDateFrom ? { date_from: orderDateFrom } : {}),
      ...(orderDateTo ? { date_to: `${orderDateTo}T23:59:59` } : {}),
    }),
    [orderDateFrom, orderDateTo, orderModeFilter, orderSearch, orderShipmentFilter, orderStatusFilter]
  );
  const { data: orderList, isError: orderListError } = useOrderList(orderListQuery);
  const createOrderMutation = useCreateOrder();
  const updateOrderMutation = useUpdateOrder();
  const updateOrderTaskMutation = useUpdateOrderTask();
  const createOperationLogMutation = useCreateOrderOperationLog();
  const generateReceivableRpcMutation = useRpcGenerateReceivableForOrder();
  const generatePayablesRpcMutation = useRpcGeneratePayablesForOrder();
  const detailOrderId = savedOrder?.id || savedOrder?.order_id || selectedOrderId || orderDraft?.id || orderDraft?.order_id;
  const { data: liveOrderDetail } = useOrderDetail(detailOrderId);
  const baseDisplayOrder = liveOrderDetail || savedOrder || orderDraft || {
    ...form,
    customer: form.company_name,
    estimated_revenue_total: Number(form.quoted_revenue_total || 0),
    estimated_cost_total: Number(form.quoted_cost_total || 0),
    estimated_profit_total: Number(form.quoted_revenue_total || 0) - Number(form.quoted_cost_total || 0),
  };
  const displayOrder = {
    ...baseDisplayOrder,
    operation_logs: [
      ...(baseDisplayOrder?.operation_logs || []),
      ...localOperationLogs.filter((log) => !log.order_id || log.order_id === (baseDisplayOrder?.id || baseDisplayOrder?.order_id)),
    ],
  };

  useEffect(() => {
    if (!orderDraft) return;

    setSavedOrder(null);
    setLocalTaskOverrides({});
    setLocalOperationLogs([]);
    setActiveView("detail");
    setForm({
      company_name: orderDraft.company_name || orderDraft.customer || "",
      contact_name: orderDraft.contact_name || "",
      booking_no: orderDraft.booking_no || "",
      container_type: orderDraft.container_type || "",
      incoterm: orderDraft.incoterm || "FOB",
      transport_mode: orderDraft.transport_mode || "rail",
      shipment_type: orderDraft.shipment_type || "LCL",
      origin: orderDraft.origin || "",
      destination: orderDraft.destination || "",
      cargo_desc: orderDraft.cargo_desc || "",
      package_type: orderDraft.package_type || "",
      pieces: orderDraft.pieces || "",
      volume_cbm: orderDraft.volume_cbm || "",
      weight_kg: orderDraft.weight_kg || "",
      currency: orderDraft.currency || "USD",
      operator_name: orderDraft.operator_name || "",
      quoted_revenue_total: orderDraft.estimated_revenue_total || "",
      quoted_cost_total: orderDraft.estimated_cost_total || "",
    });
  }, [orderDraft]);

  useEffect(() => {
    if (!selectedOrderId) return;
    const currentId = savedOrder?.id || savedOrder?.order_id;
    if (currentId !== selectedOrderId) {
      setSavedOrder({ id: selectedOrderId });
    }
    setActiveDetailTab(orderDetailBlueprint[0].tab);
    setActiveView("detail");
  }, [selectedOrderId, savedOrder?.id, savedOrder?.order_id]);

  const milestones = useMemo(
    () => orderMilestonesByMode[displayOrder?.transport_mode] || orderMilestonesByMode.rail,
    [displayOrder]
  );

  const finance = useMemo(() => {
    const revenue = Number(displayOrder?.estimated_revenue_total || displayOrder?.quoted_revenue_total || 0);
    const cost = Number(displayOrder?.estimated_cost_total || displayOrder?.quoted_cost_total || 0);
    const profit = Number(displayOrder?.estimated_profit_total || displayOrder?.quoted_profit_total || revenue - cost);

    return {
      revenue,
      cost,
      profit,
      receivableOpen: revenue,
      payableOpen: cost,
    };
  }, [displayOrder]);

  const orderRows = useMemo(() => {
    const activeViewConfig = savedViews.find((view) => view.key === activeSavedView) || savedViews[0];
    const sourceRows = orderList?.items?.length
      ? orderList.items.map((order) => ({
        order_no: order.order_no,
        customer: order.customer_name || order.company_name || order.customer_id || "客户",
        order_date: order.created_at?.slice?.(0, 10) || "-",
        pol: order.origin || "-",
        pod: order.destination || "-",
        etd: order.etd || "-",
        pieces_weight_volume: `${order.pieces || "-"} / ${order.weight_kg || 0} / ${order.volume_cbm || 0} / ${order.chargeable_volume || order.volume_cbm || 0}`,
        container_qty: order.container_qty || "-",
        order_type: `${order.transport_mode?.toUpperCase() || "-"} ${order.shipment_type || ""}`,
        order_status: order.status || "待处理",
        customs_status: order.customs_status || "待确认",
        receivable_status: order.receivable_status || "待生成",
        release_status: order.release_status || "未申请",
        quote_no: order.quote_no || order.quote_id || "-",
        external_allocation: order.external_allocation ? "是" : "否",
        owner: order.owner || "未分配",
        train_no: order.train_no || "-",
        rawOrder: order,
      }))
      : referenceOrderRows.map((order) => ({ ...order, rawOrder: null }));

    return activeViewConfig.localFilter ? sourceRows.filter(activeViewConfig.localFilter) : sourceRows;
  }, [activeSavedView, orderList]);

  const orderExecutionRows = useMemo(
    () =>
      orderRows
        .map((order) => ({
          ...order,
          action: getOrderExecutionAction(order),
        }))
        .sort(
          (a, b) =>
            orderPriorityRank(a.action.priority) - orderPriorityRank(b.action.priority) ||
            String(a.order_date || "").localeCompare(String(b.order_date || ""))
        ),
    [orderRows]
  );

  const orderExecutionSummary = useMemo(() => ({
    total: orderExecutionRows.length,
    ownerCount: orderExecutionRows.filter((row) => row.action.queue === "owner").length,
    executableCount: orderExecutionRows.filter((row) => row.action.queue === "executable").length,
    customsCount: orderExecutionRows.filter((row) => row.action.queue === "customs").length,
    releaseCount: orderExecutionRows.filter((row) => row.action.queue === "release").length,
    financeCount: orderExecutionRows.filter((row) => row.action.queue === "finance").length,
  }), [orderExecutionRows]);

  const handleOpenOrder = (orderRow) => {
    const rawOrder = orderRow.rawOrder;
    const normalizedOrder = rawOrder
      ? {
          ...rawOrder,
          company_name: orderRow.customer,
          customer: orderRow.customer,
          origin: rawOrder.origin || orderRow.pol,
          destination: rawOrder.destination || orderRow.pod,
          estimated_revenue_total: rawOrder.quoted_revenue_total || rawOrder.estimated_revenue_total || 0,
          estimated_cost_total: rawOrder.quoted_cost_total || rawOrder.estimated_cost_total || 0,
          estimated_profit_total:
            rawOrder.quoted_profit_total ||
            rawOrder.estimated_profit_total ||
            Number(rawOrder.quoted_revenue_total || 0) - Number(rawOrder.quoted_cost_total || 0),
        }
      : {
          ...orderRow,
          company_name: orderRow.customer,
          customer: orderRow.customer,
          origin: orderRow.pol,
          destination: orderRow.pod,
          transport_mode: orderRow.order_type?.includes("海") ? "sea" : orderRow.order_type?.includes("空") ? "air" : "rail",
          shipment_type: orderRow.order_type?.includes("整箱") ? "FCL" : "LCL",
          status: orderRow.order_status,
          estimated_revenue_total: 0,
          estimated_cost_total: 0,
          estimated_profit_total: 0,
        };

    setSavedOrder(normalizedOrder);
    setActiveDetailTab(orderDetailBlueprint[0].tab);
    setActiveView("detail");
    onOpenOrder?.(normalizedOrder.id || normalizedOrder.order_id);
  };

  const handleShowOrderList = () => {
    setActiveView("list");
    onOpenOrder?.(null);
  };

  const activeBlueprint =
    orderDetailBlueprint.find((section) => section.tab === activeDetailTab) || orderDetailBlueprint[0];

  const orderNo = displayOrder?.order_no || "手工草稿";
  const customerName = displayOrder?.company_name || displayOrder?.customer || form.company_name || "客户";
  const profitMargin = finance.revenue ? ((finance.profit / finance.revenue) * 100).toFixed(1) : "0.0";
  const primaryCargo = displayOrder?.cargo_items?.[0];
  const partyByRole = (role, fallback) => {
    const party = displayOrder?.parties?.find((item) => item.role === role);
    if (!party) return fallback;
    return [party.company_name, party.contact_name, party.email].filter(Boolean).join(" · ") || fallback;
  };
  const liveTaskGroups = useMemo(() => {
    if (!displayOrder?.task_items?.length) {
      return taskGroups.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) => {
          const override = localTaskOverrides[task.label] || {};
          const status = override.status || (task.state === "进行中" ? "in_progress" : task.state === "完成" ? "done" : "not_started");
          return {
            ...task,
            id: task.label,
            status,
            state: taskStatusLabels[status] || task.state,
            tone: status === "done" ? "emerald" : status === "in_progress" || status === "pending" ? "amber" : "slate",
            progress: status === "done" ? "1/1" : task.progress,
            isLocal: true,
          };
        }),
      }));
    }

    return Object.entries(
      displayOrder.task_items.reduce((groups, task) => {
        const groupName = task.group_name || "其它";
        const override = localTaskOverrides[task.id] || localTaskOverrides[task.task_name] || {};
        groups[groupName] = groups[groupName] || [];
        groups[groupName].push({ ...task, ...override });
        return groups;
      }, {})
    ).map(([title, tasks]) => ({
      title,
      tone: taskGroupTones[title] || "slate",
      tasks: tasks.map((task) => ({
        id: task.id,
        label: task.task_name,
        status: task.status,
        state: taskStatusLabels[task.status] || task.status,
        tone: task.status === "done" ? "emerald" : task.status === "in_progress" || task.status === "pending" ? "amber" : "slate",
        progress: `${task.completed_count || 0}/${task.total_count || 1}`,
        isLocal: false,
      })),
    }));
  }, [displayOrder?.task_items, localTaskOverrides]);
  const doorLifecycle = useMemo(
    () => buildDoorLifecycle({ taskGroups: liveTaskGroups, order: displayOrder, finance }),
    [displayOrder, finance, liveTaskGroups],
  );
  const financeLineRows = useMemo(() => {
    const lines = displayOrder?.finance_lines || [];
    const toRow = (line) => ({
      id: line.id,
      party: line.party_name || (line.line_type === "receivable" ? customerName : "供应商"),
      fee: line.fee_name || line.fee_code,
      unitPrice: String(line.unit_price || 0),
      qty: String(line.quantity || 1),
      fx: String(line.fx_rate || 1),
      total: String(line.total_amount || 0),
      currency: line.currency || "USD",
      paid: String(line.settled_amount || 0),
      bill: line.bill_no || line.invoice_no || "待生成",
    });

    return {
      receivables: lines.filter((line) => line.line_type === "receivable").map(toRow),
      payables: lines.filter((line) => line.line_type === "payable").map(toRow),
    };
  }, [customerName, displayOrder?.finance_lines]);
  const currentFinanceRows = useMemo(() => ({
    receivables: financeLineRows.receivables.length
      ? financeLineRows.receivables
      : finance.revenue > 0
        ? [{
            id: "current-revenue-preview",
            party: customerName,
            fee: "主运费收入",
            unitPrice: String(finance.revenue),
            qty: "1",
            fx: "1",
            total: String(finance.revenue),
            currency: displayOrder?.currency || form.currency || "USD",
            paid: "0",
            bill: "待生成应收",
          }]
        : [],
    payables: financeLineRows.payables.length
      ? financeLineRows.payables
      : finance.cost > 0
        ? [{
            id: "current-cost-preview",
            party: "待匹配供应商",
            fee: "主运费成本",
            unitPrice: String(finance.cost),
            qty: "1",
            fx: "1",
            total: String(finance.cost),
            currency: displayOrder?.currency || form.currency || "USD",
            paid: "0",
            bill: "待生成应付",
          }]
        : [],
  }), [customerName, displayOrder?.currency, finance.cost, finance.revenue, financeLineRows.payables, financeLineRows.receivables, form.currency]);
  const documentGroups = useMemo(() => {
    if (!displayOrder?.documents?.length) return attachmentGroups;

    return Object.entries(
      displayOrder.documents.reduce((groups, document) => {
        const category = document.category || "other";
        groups[category] = groups[category] || [];
        groups[category].push(document);
        return groups;
      }, {})
    ).map(([title, documents]) => ({
      title,
      count: documents.length,
      note: documents.map((document) => document.document_name).join(" / "),
    }));
  }, [displayOrder?.documents]);
  const orderDetailGovernance = useMemo(
    () => scoreOrderDetailGovernance({
      order: displayOrder,
      doorLifecycle,
      documentGroups,
      taskGroups: liveTaskGroups,
      finance,
    }),
    [displayOrder, documentGroups, doorLifecycle, finance, liveTaskGroups],
  );
  const orderVisibilityArchiveControl = useMemo(
    () => scoreOrderVisibilityArchiveControl({
      order: displayOrder,
      doorLifecycle,
      documentGroups,
      taskGroups: liveTaskGroups,
    }),
    [displayOrder, documentGroups, doorLifecycle, liveTaskGroups],
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplySavedView = (view) => {
    setActiveSavedView(view.key);
    if (view.shipment_type) {
      setOrderShipmentFilter(view.shipment_type);
    }
    if (view.transport_mode) {
      setOrderModeFilter(view.transport_mode);
    }
    if (view.status) {
      setOrderStatusFilter(view.status);
    }
  };

  const handleCopyOrderExecutionPlan = async () => {
    const text = buildOrderExecutionPlan(orderExecutionRows, orderExecutionSummary);

    if (!text) {
      onNotify?.({
        type: "info",
        title: "暂无订单队列",
        message: "当前筛选下没有可整理的订单。",
      });
      return;
    }

    setOrderExecutionPlanText(text);

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "订单执行清单已复制",
        message: "已按负责人、可执行、报关、放行和财务优先级整理，可直接发给操作团队执行。",
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，已在页面展开清单，可手动选中复制。",
      });
    }
  };

  const handleCopyOrderDetailGovernancePlan = async () => {
    const text = buildOrderDetailGovernancePlan(displayOrder, orderDetailGovernance);

    if (!text) {
      onNotify?.({
        type: "info",
        title: "暂无订单详情",
        message: "当前没有可整理的订单详情治理清单。",
      });
      return;
    }

    setOrderDetailGovernancePlanText(text);

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "订单详情治理清单已复制",
        message: "已按异常、附件、任务、日志和财务缺口整理，可同步给操作、客服和财务。",
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，已在页面展开订单详情治理清单。",
      });
    }
  };

  const handleCopyOrderVisibilityArchivePlan = async () => {
    const text = buildOrderVisibilityArchivePlan(displayOrder, orderVisibilityArchiveControl);

    if (!text) {
      onNotify?.({
        type: "info",
        title: "暂无客户轨迹归档清单",
        message: "当前没有可整理的订单客户轨迹和 POD 归档内容。",
      });
      return;
    }

    setOrderVisibilityArchivePlanText(text);

    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({
        type: "success",
        title: "客户轨迹归档清单已复制",
        message: "已按客户可视进度、异常责任、POD 和关键附件归档整理，可同步客服、操作和财务。",
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "复制失败",
        message: "浏览器未授权剪贴板，已在页面展开客户轨迹归档清单。",
      });
    }
  };

  const handleFocusOrderExecutionRow = (row) => {
    setOrderSearch(row.order_no || row.customer || "");
    setActiveSavedView("default");
    setOrderStatusFilter("all");
    setOrderModeFilter("all");
    setOrderShipmentFilter("all");
    onNotify?.({
      type: "info",
      title: "已聚焦订单",
      message: `${row.order_no} 已填入搜索框，可点击订单详情处理：${row.action.nextAction}`,
    });
  };

  const pushLocalLog = (action, afterValue = {}) => {
    const log = buildLocalLog(action, {
      order_no: orderNo,
      ...afterValue,
    });
    setLocalOperationLogs((prev) => [log, ...prev]);
    return log;
  };

  const syncOperationLog = async (action, afterValue = {}) => {
    const orderId = displayOrder?.id || displayOrder?.order_id;
    pushLocalLog(action, afterValue);

    if (!orderId || String(orderId).startsWith("local-")) return;

    try {
      await createOperationLogMutation.mutateAsync({
        orderId,
        action,
        after_value: {
          order_no: orderNo,
          ...afterValue,
        },
      });
    } catch (error) {
      // Local log already keeps the workflow visible if permissions are missing.
    }
  };

  const handleMarkExecutable = async () => {
    const orderId = displayOrder?.id || displayOrder?.order_id;
    const nextStatus = "in_transit";

    if (!orderId || String(orderId).startsWith("local-")) {
      setSavedOrder((prev) => ({
        ...(prev || displayOrder),
        status: nextStatus,
      }));
      syncOperationLog("订单已标记可执行", { status: nextStatus });
      onNotify?.({
        type: "success",
        title: "订单已标记可执行",
        message: `${orderNo} 已进入操作执行状态，本地工作台已记录。`,
      });
      return;
    }

    try {
      const result = await updateOrderMutation.mutateAsync({
        orderId,
        status: nextStatus,
        action: "订单已标记可执行",
      });
      setSavedOrder((prev) => ({ ...(prev || displayOrder), ...result }));
      onNotify?.({
        type: "success",
        title: "订单已标记可执行",
        message: `${result.order_no || orderNo} 已进入操作执行状态，任务和财务可继续推进。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "真实订单状态更新失败",
        message: error.message || "数据库未更新，请确认登录账号具备订单编辑权限。",
      });
    }
  };

  const handleUpdateTaskStatus = async (task, status) => {
    const orderId = displayOrder?.id || displayOrder?.order_id;
    const nextTask = {
      status,
      completed_count: status === "done" ? 1 : 0,
      completed_at: status === "done" ? new Date().toISOString() : null,
    };
    const overrideKey = task.id || task.label;

    const action = `任务「${task.label}」已更新为${taskStatusLabels[status] || status}`;

    if (task.isLocal || !orderId || String(orderId).startsWith("local-")) {
      setLocalTaskOverrides((prev) => ({
        ...prev,
        [overrideKey]: nextTask,
        [task.label]: nextTask,
      }));
      await syncOperationLog(action, { task: task.label, status });
      onNotify?.({
        type: "success",
        title: "任务状态已更新",
        message: `${orderNo} 的 ${task.label} 已标记为${taskStatusLabels[status] || status}。`,
      });
      return;
    }

    try {
      const result = await updateOrderTaskMutation.mutateAsync({
        taskId: task.id,
        orderId,
        ...nextTask,
      });
      setLocalTaskOverrides((prev) => ({
        ...prev,
        [task.id]: result,
        [task.label]: result,
      }));
      await syncOperationLog(action, { task: task.label, status });
      onNotify?.({
        type: "success",
        title: "任务状态已同步",
        message: `${orderNo} 的 ${task.label} 已同步为${taskStatusLabels[status] || status}。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "真实任务状态更新失败",
        message: error.message || "数据库未更新，请确认账号具备订单任务编辑权限。",
      });
    }
  };

  const handleSaveOrder = async () => {
    const requiredFields = [
      { field: "company_name", label: "客户名称" },
      { field: "origin", label: "起运地" },
      { field: "destination", label: "目的地" },
      { field: "cargo_desc", label: "货物描述" },
    ];
    const missing = requiredFields.filter((item) => !String(form[item.field] || "").trim());
    const revenue = Number(form.quoted_revenue_total || 0);
    const cost = Number(form.quoted_cost_total || 0);
    const volume = Number(form.volume_cbm || 0);
    const weight = Number(form.weight_kg || 0);
    const pieces = Number(form.pieces || 0);

    if (missing.length) {
      onNotify?.({
        type: "info",
        title: "订单信息不完整",
        message: `请先填写：${missing.map((item) => item.label).join("、")}。`,
      });
      return;
    }

    if ([revenue, cost, volume, weight, pieces].some((value) => Number.isNaN(value) || value < 0)) {
      onNotify?.({
        type: "info",
        title: "订单数值异常",
        message: "收入、成本、体积、重量和件数必须是 0 或正数，避免生成错误财务记录。",
      });
      return;
    }

    const payload = {
      ...form,
      customer_id: orderDraft?.customer_id,
      contact_id: orderDraft?.contact_id,
      quote_id: orderDraft?.quote_id,
      company_name: form.company_name,
      customer: form.company_name,
      pieces,
      volume_cbm: volume,
      weight_kg: weight,
      quoted_revenue_total: revenue,
      quoted_cost_total: cost,
    };

    try {
      const result = await createOrderMutation.mutateAsync(payload);
      const savedOrderPayload = {
        ...result,
        company_name: form.company_name,
        customer: form.company_name,
        contact_name: form.contact_name,
        booking_no: form.booking_no,
        container_type: form.container_type,
        incoterm: form.incoterm,
        cargo_desc: form.cargo_desc,
        package_type: form.package_type,
        pieces,
        volume_cbm: volume,
        weight_kg: weight,
        currency: form.currency,
        operator_name: form.operator_name,
        estimated_revenue_total: result.quoted_revenue_total,
        estimated_cost_total: result.quoted_cost_total,
        estimated_profit_total: result.quoted_profit_total,
      };
      setSavedOrder(savedOrderPayload);
      setActiveView("detail");
      onOpenOrder?.(savedOrderPayload.id || savedOrderPayload.order_id);
      onNotify?.({
        type: "success",
        title: "订单已保存",
        message: `${result.order_no || "订单"} 已记录，可进入财务交接。`,
      });
    } catch (error) {
      const localOrder = {
        ...payload,
        order_id: `local-order-${Date.now()}`,
        order_no: "LOCAL-ORDER-DRAFT",
        status: "local_draft",
        settlement_status: "local_only",
        estimated_revenue_total: payload.quoted_revenue_total,
        estimated_cost_total: payload.quoted_cost_total,
        estimated_profit_total: payload.quoted_revenue_total - payload.quoted_cost_total,
      };
      setSavedOrder(localOrder);
      setActiveView("detail");
      onNotify?.({
        type: "info",
        title: "订单已暂存本地",
        message: `${form.company_name || "手工订单"} 已在本地暂存，配置 Supabase 登录和环境变量后可持久化。`,
      });
    }
  };

  const buildFinanceDraft = (extra = {}) => ({
    order_id: displayOrder?.order_id || displayOrder?.id,
    order_no: displayOrder?.order_no || orderNo,
    customer_id: displayOrder?.customer_id,
    customer: displayOrder?.company_name || displayOrder?.customer || form.company_name || "客户",
    contact_id: displayOrder?.contact_id,
    quote_id: displayOrder?.quote_id,
    origin: displayOrder?.origin,
    destination: displayOrder?.destination,
    transport_mode: displayOrder?.transport_mode,
    shipment_type: displayOrder?.shipment_type,
    receivableOpen: finance.receivableOpen,
    payableOpen: finance.payableOpen,
    ...extra,
  });

  const handleGenerateReceivable = async () => {
    if (displayOrder?.order_id || displayOrder?.id) {
      try {
        const result = await generateReceivableRpcMutation.mutateAsync({
          orderId: displayOrder.order_id || displayOrder.id,
        });
        onNotify?.({
          type: "success",
          title: "应收流程已生成",
          message: `${orderNo} 的应收记录 ${result.receivable_id || ""} 已进入财务模块。`,
          receivable_id: result.receivable_id,
          financeDraft: buildFinanceDraft({
            receivable_id: result.receivable_id,
            focus: "receivables",
          }),
        });
        return;
      } catch (error) {
        // Fall back to staged workflow notice.
      }
    }

    onNotify?.({
      type: "success",
      title: "应收流程已准备",
      message: `${orderNo} 的应收生成流程已可进入财务模块。`,
      financeDraft: buildFinanceDraft({ focus: "receivables" }),
    });
  };

  const handleOpenCostCapture = async () => {
    if (displayOrder?.order_id || displayOrder?.id) {
      try {
        const result = await generatePayablesRpcMutation.mutateAsync({
          orderId: displayOrder.order_id || displayOrder.id,
        });
        onNotify?.({
          type: "info",
          title: "成本录入已排队",
          message: `${orderNo} 已生成 ${result.created_count || 0} 组应付成本，可在财务模块查看。`,
          payable_ids: result.payable_ids,
          financeDraft: buildFinanceDraft({
            payable_ids: result.payable_ids,
            focus: "costs",
          }),
        });
        return;
      } catch (error) {
        // Fall back to staged workflow notice.
      }
    }

    onNotify?.({
      type: "info",
      title: "成本录入已准备",
      message: `操作团队现在可以为 ${orderNo} 录入供应商成本。`,
      financeDraft: buildFinanceDraft({ focus: "costs" }),
    });
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-violet-700">
            订单管理
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">订单管理</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            订单模块应该先管理订单列表，再进入录单、详情、执行节点和财务交接。现在支持报价转订单，也支持直接手工录单。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleShowOrderList}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
              activeView === "list"
                ? "bg-slate-950 text-white"
                : "border border-slate-200 text-slate-700"
            }`}
          >
            订单列表
          </button>
          <button
            type="button"
            onClick={() => setActiveView("entry")}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
              activeView === "entry"
                ? "bg-violet-600 text-white"
                : "border border-slate-200 text-slate-700"
            }`}
          >
            手工录单
          </button>
          <button
            type="button"
            onClick={onBackToQuotes}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            返回报价
          </button>
          {activeView !== "list" && (
            <button
              type="button"
              onClick={handleMarkExecutable}
              disabled={updateOrderMutation.isPending}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updateOrderMutation.isPending ? "更新中..." : "标记可执行"}
            </button>
          )}
        </div>
      </div>

      {activeView === "list" && (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="订单总数" value={orderRows.length} hint={orderListError ? "显示参考结构" : "当前可见订单"} />
            <SummaryCard label="未报关" value={orderRows.filter((order) => order.customs_status === "未报关").length} hint="需要单独跟踪" />
            <SummaryCard label="未结清" value={orderRows.filter((order) => order.receivable_status === "未结清").length} hint="应收状态前置" />
            <SummaryCard label="可录单" value="报价转单 / 手工" hint="两条路径已支持" />
          </div>

          <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">订单执行指挥台</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  按当前可见订单自动整理待分配、待可执行、待报关、待放行和待财务队列，让操作每天先处理最容易卡住履约和回款的订单。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyOrderExecutionPlan}
                    className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    复制订单执行清单
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-6">
                <SummaryCard label="执行队列" value={orderExecutionSummary.total} hint="当前筛选" />
                <SummaryCard label="待分配" value={orderExecutionSummary.ownerCount} hint="先定负责人" />
                <SummaryCard label="待可执行" value={orderExecutionSummary.executableCount} hint="确认后开工" />
                <SummaryCard label="待报关" value={orderExecutionSummary.customsCount} hint="资料/放行" />
                <SummaryCard label="待放行" value={orderExecutionSummary.releaseCount} hint="费用/单证" />
                <SummaryCard label="待财务" value={orderExecutionSummary.financeCount} hint="应收应付" />
              </div>
            </div>

            {orderExecutionPlanText ? (
              <section className="mt-5 rounded-3xl border border-violet-200 bg-white/80 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="text-base font-bold text-violet-950">订单执行清单</h4>
                    <p className="mt-1 text-sm text-violet-700">
                      如果浏览器不允许自动复制，可以在这里选中文本同步给操作、客服、财务或销售团队。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOrderExecutionPlanText("")}
                    className="self-start rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800"
                  >
                    收起
                  </button>
                </div>
                <textarea
                  readOnly
                  value={orderExecutionPlanText}
                  onFocus={(event) => event.currentTarget.select()}
                  className="mt-3 min-h-64 w-full rounded-2xl border border-violet-200 bg-white p-4 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </section>
            ) : null}

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {orderExecutionRows.slice(0, 3).map((row) => (
                <article key={`order-action-${orderQueueKey(row)}`} className={`rounded-3xl border p-4 ${orderExecutionActionClass(row.action.tone)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{row.action.priority}</div>
                      <h4 className="mt-1 text-base font-bold">{row.action.label}</h4>
                    </div>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold">
                      {row.order_status || "状态待补"}
                    </span>
                  </div>
                  <div className="mt-3 font-semibold">{row.order_no}</div>
                  <p className="mt-2 text-sm leading-6 opacity-85">{row.action.nextAction}</p>
                  <p className="mt-2 text-xs leading-5 opacity-75">{row.customer} · {orderQueueRoute(row)}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 overflow-x-auto rounded-3xl border border-violet-100 bg-white">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-violet-100 bg-violet-50/70 text-left text-xs font-semibold uppercase tracking-[0.16em] text-violet-800">
                    <th className="px-4 py-3">订单</th>
                    <th className="px-4 py-3">客户 / 路线</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">负责人</th>
                    <th className="px-4 py-3">建议</th>
                    <th className="px-4 py-3">处理</th>
                  </tr>
                </thead>
                <tbody>
                  {orderExecutionRows.map((row) => (
                    <tr key={`queue-${orderQueueKey(row)}`} className="border-b border-slate-100 align-top text-slate-700">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-950">{row.order_no}</div>
                        <div className="mt-1 text-xs text-slate-500">ETD {row.etd || "-"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{row.customer}</div>
                        <div className="mt-1 max-w-xs text-xs text-slate-500">{orderQueueRoute(row)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-800">{row.order_status}</div>
                        <div className="mt-1 text-xs text-slate-500">报关 {row.customs_status} / 放行 {row.release_status}</div>
                        <div className="mt-1 text-xs text-slate-500">收款 {row.receivable_status}</div>
                      </td>
                      <td className="px-4 py-4">{row.owner || "未分配"}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${orderExecutionActionClass(row.action.tone)}`}>
                          {row.action.priority} · {row.action.label}
                        </span>
                        <div className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{row.action.nextAction}</div>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => handleFocusOrderExecutionRow(row)}
                          className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700"
                        >
                          聚焦订单
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">订单速查与高级筛选</h3>
                <p className="mt-1 text-sm text-slate-500">搜索、状态、运输方式、货型和日期会直接刷新订单列表。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {orderLanes.map((lane) => (
                  <button
                    key={lane.label}
                    type="button"
                    onClick={() => {
                      setOrderModeFilter(lane.transport_mode);
                      setOrderShipmentFilter(lane.shipment_type);
                      setActiveSavedView("default");
                    }}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                      orderModeFilter === lane.transport_mode && orderShipmentFilter === lane.shipment_type
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {lane.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[1.2fr_0.75fr_0.75fr_0.75fr_0.75fr_0.75fr_auto]">
              <input
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                placeholder="搜索订单号 / 订舱号 / 起运地 / 目的地"
              />
              <select
                value={orderStatusFilter}
                onChange={(event) => setOrderStatusFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
              >
                <option value="all">全部状态</option>
                <option value="booked">已订舱</option>
                <option value="in_transit">运输中</option>
                <option value="customs">报关中</option>
                <option value="delivered">已送达</option>
                <option value="closed">已关闭</option>
                <option value="exception">异常</option>
              </select>
              <select
                value={orderModeFilter}
                onChange={(event) => {
                  setOrderModeFilter(event.target.value);
                  setActiveSavedView("default");
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
              >
                {orderModeOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <select
                value={orderShipmentFilter}
                onChange={(event) => {
                  setOrderShipmentFilter(event.target.value);
                  setActiveSavedView("default");
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
              >
                {orderShipmentOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={orderDateFrom}
                onChange={(event) => setOrderDateFrom(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                aria-label="订单开始日期"
              />
              <input
                type="date"
                value={orderDateTo}
                onChange={(event) => setOrderDateTo(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                aria-label="订单结束日期"
              />
              <button
                type="button"
                onClick={() => {
                  setOrderSearch("");
                  setOrderStatusFilter("all");
                  setOrderModeFilter("all");
                  setOrderShipmentFilter("all");
                  setOrderDateFrom("");
                  setOrderDateTo("");
                  setActiveSavedView("default");
                }}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
              >
                重置
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-semibold text-slate-500">
              当前筛选：{[
                orderSearch.trim() ? `关键词 ${orderSearch.trim()}` : null,
                orderStatusFilter !== "all" ? `状态 ${orderStatusFilter}` : null,
                orderModeFilter !== "all" ? `方式 ${orderModeFilter}` : null,
                orderShipmentFilter !== "all" ? `货型 ${orderShipmentFilter}` : null,
                orderDateFrom ? `起 ${orderDateFrom}` : null,
                orderDateTo ? `止 ${orderDateTo}` : null,
                activeSavedView !== "default" ? `视图 ${savedViews.find((view) => view.key === activeSavedView)?.label}` : null,
              ].filter(Boolean).join(" / ") || "无，显示全部可见订单"}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">订单列表</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {orderListError ? "Supabase 未连接或权限不足，当前显示订单模块结构。" : "订单进入这里后再分配操作、维护节点、生成财务。"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {savedViews.map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    onClick={() => handleApplySavedView(view)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                      activeSavedView === view.key
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveView("entry")}
                  className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  新建订单
                </button>
              </div>
            </div>

            <div className="overflow-x-auto bg-white">
              <table className="w-full min-w-[1680px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-5 py-3">订单号</th>
                    <th className="px-4 py-3">客户</th>
                    <th className="px-4 py-3">订单日期</th>
                    <th className="px-4 py-3">POL</th>
                    <th className="px-4 py-3">POD</th>
                    <th className="px-4 py-3">ETD</th>
                    <th className="px-4 py-3">件/毛/体/计费体积</th>
                    <th className="px-4 py-3">箱型箱量</th>
                    <th className="px-4 py-3">订单类型</th>
                    <th className="px-4 py-3">订单状态</th>
                    <th className="px-4 py-3">报关状态</th>
                    <th className="px-4 py-3">收款情况</th>
                    <th className="px-4 py-3">放行状态</th>
                    <th className="px-4 py-3">报价单号</th>
                    <th className="px-4 py-3">外配</th>
                    <th className="px-4 py-3">销售/客服组</th>
                    <th className="px-4 py-3">班列号</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.length ? (
                    orderRows.map((order) => (
                      <tr
                        key={order.order_no}
                        onClick={() => handleOpenOrder(order)}
                        className="cursor-pointer border-b border-slate-100 text-sm text-slate-700 transition hover:bg-violet-50/60"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{order.order_no}</div>
                          <div className="mt-1 text-xs font-medium text-violet-600">点击查看详情</div>
                        </td>
                        <td className="px-4 py-4">{order.customer}</td>
                        <td className="px-4 py-4">{order.order_date}</td>
                        <td className="px-4 py-4">{order.pol}</td>
                        <td className="px-4 py-4">{order.pod}</td>
                        <td className="px-4 py-4">{order.etd}</td>
                        <td className="px-4 py-4">{order.pieces_weight_volume}</td>
                        <td className="px-4 py-4">{order.container_qty}</td>
                        <td className="px-4 py-4">{order.order_type}</td>
                        <td className="px-4 py-4">{order.order_status}</td>
                        <td className="px-4 py-4">{order.customs_status}</td>
                        <td className="px-4 py-4">{order.receivable_status}</td>
                        <td className="px-4 py-4">{order.release_status}</td>
                        <td className="px-4 py-4">{order.quote_no}</td>
                        <td className="px-4 py-4">{order.external_allocation}</td>
                        <td className="px-4 py-4">{order.owner}</td>
                        <td className="px-4 py-4">{order.train_no}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="17" className="px-5 py-8 text-center text-sm text-slate-500">
                        暂无订单。可以从报价转订单，也可以点击“新增订单”手工录入。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeView !== "list" && (
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">订单详情</div>
                  <h3 className="mt-2 text-2xl font-bold">{orderNo}</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {displayOrder?.origin || "POL"} → {displayOrder?.destination || "POD"} · {displayOrder?.transport_mode?.toUpperCase()} · {displayOrder?.shipment_type}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950"
                  onClick={handleShowOrderList}
                >
                  返回列表
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
              {orderDetailBlueprint.map((section) => (
                <button
                  key={section.tab}
                  type="button"
                  onClick={() => setActiveDetailTab(section.tab)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    activeDetailTab === section.tab
                      ? "bg-violet-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {section.tab}
                </button>
              ))}
            </div>

            <div className="p-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{activeBlueprint.focus}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    当前订单的执行节点、主数据、单证和财务交接在这里集中处理。
                  </p>
                </div>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  {activeBlueprint.blocks.length} 组字段
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {activeBlueprint.blocks.map((block) => (
                  <div key={block} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                    {block}
                  </div>
                ))}
              </div>

              {activeDetailTab === "概况" && (
                <div className="mt-6 space-y-5">
                  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="grid gap-4 bg-slate-950 p-5 text-white lg:grid-cols-[260px_1fr]">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Door-to-door control tower</div>
                        <h5 className="mt-2 text-xl font-bold">门到门全周期</h5>
                        <div className="mt-4 flex items-end gap-2">
                          <span className="text-4xl font-bold">{doorLifecycle.progress}%</span>
                          <span className="pb-1 text-sm text-slate-300">
                            {doorLifecycle.doneCount}/{doorLifecycle.totalCount} 节点完成
                          </span>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-sky-300" style={{ width: `${doorLifecycle.progress}%` }} />
                        </div>
                        <div className="mt-4 rounded-2xl bg-white/10 p-3">
                          <div className="text-xs text-slate-300">客户可见状态</div>
                          <div className="mt-1 text-sm font-semibold">{doorLifecycle.customerStatus}</div>
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-7">
                        {doorLifecycle.steps.map((step, index) => (
                          <div key={step.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-950">
                                {index + 1}
                              </span>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                step.status === "done"
                                  ? "bg-emerald-300 text-emerald-950"
                                  : step.status === "in_progress"
                                    ? "bg-amber-300 text-amber-950"
                                    : "bg-slate-700 text-slate-200"
                              }`}>
                                {taskStatusLabels[step.status] || step.status}
                              </span>
                            </div>
                            <div className="mt-3 text-sm font-bold leading-5">{step.label}</div>
                            <div className="mt-2 text-[11px] leading-4 text-slate-400">责任：{step.owner}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 lg:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">当前节点</div>
                        <div className="mt-2 text-lg font-bold text-slate-950">{doorLifecycle.activeStep?.label || "待确认"}</div>
                        <div className="mt-1 text-sm text-slate-500">{doorLifecycle.activeStep?.customerLabel}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">操作下一步</div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">
                          {doorLifecycle.activeStep?.key === "finance"
                            ? "确认应收应付、成本供应商、账单和付款状态。"
                            : `推进 ${doorLifecycle.activeStep?.label || "当前节点"}，并在完成后更新任务和操作日志。`}
                        </div>
                      </div>
                      <div className={`rounded-2xl border p-4 ${
                        doorLifecycle.risks.length
                          ? "border-amber-200 bg-amber-50"
                          : "border-emerald-200 bg-emerald-50"
                      }`}>
                        <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                          doorLifecycle.risks.length ? "text-amber-700" : "text-emerald-700"
                        }`}>
                          风险提示
                        </div>
                        <div className={`mt-2 text-sm leading-6 ${
                          doorLifecycle.risks.length ? "text-amber-800" : "text-emerald-800"
                        }`}>
                          {doorLifecycle.risks.length ? doorLifecycle.risks.join("；") : "当前没有打开异常，财务和成本风险正常。"}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">DETAIL GOVERNANCE</div>
                        <h5 className="mt-2 text-xl font-bold text-slate-950">订单详情治理 / 异常闭环</h5>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                          把门到门节点、单证附件、异常、操作日志和财务交接统一评分，先处理会卡履约、客户可视状态和回款的缺口。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyOrderDetailGovernancePlan}
                        className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white"
                      >
                        复制详情治理清单
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <SummaryCard label="治理评分" value={`${orderDetailGovernance.score}/${orderDetailGovernance.grade}`} hint={orderDetailGovernance.priority} />
                      <SummaryCard label="门到门进度" value={orderDetailGovernance.metrics.lifecycle} hint="节点完成率" />
                      <SummaryCard label="附件准备" value={orderDetailGovernance.metrics.documents} hint="已上传/应准备" />
                      <SummaryCard label="打开异常" value={orderDetailGovernance.metrics.exceptions} hint="需闭环" />
                      <SummaryCard label="操作日志" value={orderDetailGovernance.metrics.logs} hint="审计记录" />
                    </div>

                    {orderDetailGovernancePlanText ? (
                      <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4">
                        <div className="text-sm font-bold text-violet-950">订单详情治理清单</div>
                        <textarea
                          readOnly
                          value={orderDetailGovernancePlanText}
                          className="mt-3 h-48 w-full rounded-2xl border border-violet-100 bg-white p-3 text-sm leading-6 text-slate-700 outline-none"
                        />
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                      <div className={`rounded-2xl border p-4 ${
                        orderDetailGovernance.risks.length
                          ? "border-amber-200 bg-amber-50"
                          : "border-emerald-200 bg-emerald-50"
                      }`}>
                        <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                          orderDetailGovernance.risks.length ? "text-amber-700" : "text-emerald-700"
                        }`}>
                          风险缺口
                        </div>
                        <div className={`mt-3 flex flex-wrap gap-2 text-sm ${
                          orderDetailGovernance.risks.length ? "text-amber-800" : "text-emerald-800"
                        }`}>
                          {orderDetailGovernance.risks.length ? orderDetailGovernance.risks.map((risk) => (
                            <span key={risk} className="rounded-full bg-white px-3 py-1.5 font-semibold">
                              {risk}
                            </span>
                          )) : (
                            <span className="rounded-full bg-white px-3 py-1.5 font-semibold">当前无关键阻断</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">下一步动作</div>
                        <div className="mt-3 space-y-2">
                          {orderDetailGovernance.nextActions.map((action) => (
                            <div key={action} className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                              {action}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Customer Visibility / POD Archive</div>
                        <h5 className="mt-2 text-xl font-bold text-slate-950">客户轨迹 / 异常责任 / POD归档</h5>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                          把客户可视进度、异常责任人、预计解决时间、签收回单和关键附件归档单独评分，避免订单完成后客户查不到进度、异常无人负责或签收回单无法支持回款。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyOrderVisibilityArchivePlan}
                        className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white"
                      >
                        复制客户轨迹归档清单
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <SummaryCard label="归档评分" value={`${orderVisibilityArchiveControl.score}/${orderVisibilityArchiveControl.grade}`} hint={orderVisibilityArchiveControl.priority} />
                      {orderVisibilityArchiveControl.metrics.map((metric) => (
                        <SummaryCard key={metric.label} label={metric.label} value={`${metric.value}%`} hint={metric.hint} />
                      ))}
                    </div>

                    {orderVisibilityArchivePlanText ? (
                      <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                        <div className="text-sm font-bold text-sky-950">客户轨迹归档清单</div>
                        <textarea
                          readOnly
                          value={orderVisibilityArchivePlanText}
                          className="mt-3 h-40 w-full rounded-2xl border border-sky-100 bg-white p-3 text-sm leading-6 text-slate-700 outline-none"
                        />
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                      <div className={`rounded-2xl border p-4 ${
                        orderVisibilityArchiveControl.priority === "P1"
                          ? "border-rose-200 bg-rose-50"
                          : orderVisibilityArchiveControl.priority === "P2"
                            ? "border-amber-200 bg-amber-50"
                            : "border-emerald-200 bg-emerald-50"
                      }`}>
                        <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                          orderVisibilityArchiveControl.priority === "P1"
                            ? "text-rose-700"
                            : orderVisibilityArchiveControl.priority === "P2"
                              ? "text-amber-700"
                              : "text-emerald-700"
                        }`}>
                          可视 / 归档风险
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          {orderVisibilityArchiveControl.risks.map((risk) => (
                            <span key={risk} className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700">
                              {risk}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">客服 / 操作 / 财务下一步</div>
                        <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                          {orderVisibilityArchiveControl.nextAction}
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-4 lg:grid-cols-3">
                    {liveTaskGroups.map((group) => (
                      <div key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-slate-900">{group.title}</h5>
                          <StatusPill tone={group.tone}>任务流程</StatusPill>
                        </div>
                        <div className="mt-4 space-y-3">
                          {group.tasks.map((task) => (
                            <div key={task.label} className="rounded-2xl bg-slate-50 px-3 py-3">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-medium text-slate-800">{task.label}</span>
                                <StatusPill tone={task.tone || (task.state === "进行中" ? "amber" : "slate")}>{task.state}</StatusPill>
                              </div>
                              <div className="mt-2 text-xs text-slate-500">已完成 {task.progress}</div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {task.status !== "in_progress" && task.status !== "done" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateTaskStatus(task, "in_progress")}
                                    disabled={updateOrderTaskMutation.isPending}
                                    className="rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    开始处理
                                  </button>
                                ) : null}
                                {task.status !== "done" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateTaskStatus(task, "done")}
                                    disabled={updateOrderTaskMutation.isPending}
                                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    标记完成
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateTaskStatus(task, "in_progress")}
                                    disabled={updateOrderTaskMutation.isPending}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    重新打开
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-4">
                    <FieldItem label="提单状态" value="草单 / 未确认" />
                    <FieldItem label="控货状态" value="未申请" />
                    <FieldItem label="运费状态" value="未结清" />
                    <FieldItem label="杂费状态" value="未结清" />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <SummaryCard label="应收" value={`CNY ${finance.revenue ? finance.revenue.toFixed(0) : "2268"}`} hint="含 USD 汇率折算" />
                    <SummaryCard label="应付" value={`CNY ${finance.cost ? finance.cost.toFixed(0) : "1457"}`} hint="供应商成本待确认" />
                    <SummaryCard label="毛利率" value={`${profitMargin === "0.0" ? "35.8" : profitMargin}%`} hint="应收 - 应付 / 应收" />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-amber-950">风险预警</h5>
                        <StatusPill tone="amber">只看打开</StatusPill>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-amber-800">
                        {displayOrder?.exceptions?.length
                          ? displayOrder.exceptions.map((item) => item.title).join(" / ")
                          : "当前无打开异常。后续异常应关联节点、责任人、预计解决时间。"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h5 className="font-bold text-slate-900">操作日志</h5>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        {(displayOrder?.operation_logs?.length
                          ? displayOrder.operation_logs
                          : [
                              { created_at: "2026-05-28 17:05", action: "修改订单总重量" },
                              { created_at: "2026-05-28 15:29", action: "订单受理" },
                              { created_at: "2026-05-28 15:29", action: "新增订单" },
                            ]
                        ).map((log) => (
                          <div key={`${log.created_at}-${log.action}`}>
                            {String(log.created_at || "").slice(0, 16).replace("T", " ")} {log.action}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDetailTab === "基本信息" && (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <FieldItem label="订单号" value={orderNo} />
                    <FieldItem label="订单类型" value={`${displayOrder?.transport_mode?.toUpperCase() || "铁路"} ${displayOrder?.shipment_type || "拼箱"}`} />
                    <FieldItem label="客户名称" value={customerName} />
                    <FieldItem label="贸易条款" value={displayOrder?.incoterm || form.incoterm || "待确认"} />
                    <FieldItem label="销售" value={displayOrder?.sales_owner_name || displayOrder?.owner || "待分配"} />
                    <FieldItem label="操作负责人" value={displayOrder?.ops_owner_name || displayOrder?.operator_name || form.operator_name || "待分配"} />
                    <FieldItem label="是否外配" value={displayOrder?.external_allocation ? "外配" : "非外配"} />
                    <FieldItem label="托书" value={displayOrder?.booking_no || "订舱单待上传"} />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h5 className="font-bold text-slate-900">发货人</h5>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {partyByRole("shipper", "发货人待维护")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h5 className="font-bold text-slate-900">收货人</h5>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {partyByRole("consignee", "收货人待维护")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h5 className="font-bold text-slate-900">通知人</h5>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {partyByRole("notify", "通知人待维护")}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <FieldItem label="货物名称" value={primaryCargo?.goods_name_cn || displayOrder?.cargo_desc || "货物待维护"} />
                    <FieldItem label="HS Code" value={primaryCargo?.hs_code || "待维护"} />
                    <FieldItem label="件/毛/体" value={`${primaryCargo?.pieces || displayOrder?.pieces || 0} / ${primaryCargo?.gross_weight_kg || displayOrder?.weight_kg || 0} / ${primaryCargo?.volume_cbm || displayOrder?.volume_cbm || 0}`} />
                    <FieldItem label="包装/尺寸" value={[primaryCargo?.package_type || displayOrder?.package_type || form.package_type || "包装待维护", primaryCargo?.dimensions].filter(Boolean).join(" · ")} />
                    <FieldItem label="箱型/箱量" value={displayOrder?.container_type || form.container_type || "待维护"} />
                    <FieldItem label="班列/船名/航班" value={displayOrder?.train_no || displayOrder?.vessel_voyage || displayOrder?.flight_no || "待维护"} />
                    <FieldItem label="报关状态" value={displayOrder?.customs_status || "待确认"} />
                    <FieldItem label="尾程" value={displayOrder?.delivery_mode || "待维护"} />
                  </div>
                </div>
              )}

              {activeDetailTab === "单证与附件" && (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {documentGroups.map((group) => (
                    <div key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-slate-900">{group.title}</h5>
                        <StatusPill tone={group.count ? "emerald" : "slate"}>{group.count} 个文件</StatusPill>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-500">{group.note}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeDetailTab === "费用明细" && (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 lg:grid-cols-4">
                    <FieldItem label="公司视图" value="分公司 / 全部" />
                    <FieldItem label="内部转结" value="显示" />
                    <FieldItem label="财务汇率" value="USD 6.8527 / CNY 1" />
                    <FieldItem label="推送状态" value="待推送用友" />
                  </div>
                  <FinanceRowsTable title="应收费用" rows={currentFinanceRows.receivables} partyLabel="客户" paidLabel="已收" />
                  <FinanceRowsTable title="应付费用" rows={currentFinanceRows.payables} partyLabel="供应商" paidLabel="已付" />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">手工录单</h3>
                <p className="mt-1 text-sm text-slate-500">适用于客户直接下单，或暂时没有报价单但已经确认订舱的业务。</p>
              </div>
              <button
                type="button"
                onClick={handleSaveOrder}
                disabled={createOrderMutation.isPending}
                className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createOrderMutation.isPending ? "保存中..." : "保存订单"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">客户</span>
                <input value={form.company_name} onChange={(event) => handleChange("company_name", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">联系人</span>
                <input value={form.contact_name} onChange={(event) => handleChange("contact_name", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">订舱号</span>
                <input value={form.booking_no} onChange={(event) => handleChange("booking_no", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">箱型 / 箱量</span>
                <input value={form.container_type} onChange={(event) => handleChange("container_type", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" placeholder="例如 40HQ*1 / LCL" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">贸易条款</span>
                <select value={form.incoterm} onChange={(event) => handleChange("incoterm", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                  <option value="EXW">EXW</option>
                  <option value="FOB">FOB</option>
                  <option value="CIF">CIF</option>
                  <option value="DAP">DAP</option>
                  <option value="DDP">DDP</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">运输方式</span>
                <select value={form.transport_mode} onChange={(event) => handleChange("transport_mode", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                  <option value="rail">铁路</option>
                  <option value="sea">海运</option>
                  <option value="air">空运</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">货型</span>
                <select value={form.shipment_type} onChange={(event) => handleChange("shipment_type", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                  <option value="LCL">拼箱</option>
                  <option value="FCL">整箱</option>
                  <option value="air_cargo">空运货物</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">起运地</span>
                <input value={form.origin} onChange={(event) => handleChange("origin", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">目的地</span>
                <input value={form.destination} onChange={(event) => handleChange("destination", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">体积 CBM</span>
                <input type="number" min="0" step="0.01" value={form.volume_cbm} onChange={(event) => handleChange("volume_cbm", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">重量 KG</span>
                <input type="number" min="0" step="0.01" value={form.weight_kg} onChange={(event) => handleChange("weight_kg", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">件数</span>
                <input type="number" min="0" step="1" value={form.pieces} onChange={(event) => handleChange("pieces", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">包装</span>
                <input value={form.package_type} onChange={(event) => handleChange("package_type", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" placeholder="PALLET / CARTON / CASE" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">收入</span>
                <input type="number" min="0" step="0.01" value={form.quoted_revenue_total} onChange={(event) => handleChange("quoted_revenue_total", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">成本</span>
                <input type="number" min="0" step="0.01" value={form.quoted_cost_total} onChange={(event) => handleChange("quoted_cost_total", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">币种</span>
                <select value={form.currency} onChange={(event) => handleChange("currency", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100">
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">操作负责人</span>
                <input value={form.operator_name} onChange={(event) => handleChange("operator_name", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" placeholder="例如 Eva / Rosa" />
              </label>
              <label className="grid gap-2 xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">货物描述</span>
                <input value={form.cargo_desc} onChange={(event) => handleChange("cargo_desc", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">订单号</div>
                <div className="mt-2 text-2xl font-bold text-slate-950">{orderNo}</div>
                <div className="mt-2 text-sm text-slate-500">
                  {displayOrder?.company_name || displayOrder?.customer || "客户"} · {displayOrder?.transport_mode?.toUpperCase()} · {displayOrder?.shipment_type}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard label="起运地" value={displayOrder?.origin || "-"} hint="提货 / 发运点" />
                <SummaryCard label="目的地" value={displayOrder?.destination || "-"} hint="到达 / 派送点" />
                <SummaryCard
                  label="货物"
                  value={`${displayOrder?.volume_cbm || 0} CBM`}
                  hint={`${displayOrder?.weight_kg || 0} KG`}
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">执行节点</h3>
            <div className="mt-5 space-y-3">
              {milestones.map((item, index) => (
                <div
                  key={`${item.node}-${index}`}
                  className={`rounded-2xl border px-4 py-4 ${getMilestoneTone(item.status)}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold">{item.node}</div>
                      <div className="mt-1 text-sm opacity-80">目标日期: {item.eta}</div>
                    </div>
                    <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">执行备注</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">操作交接</div>
                <div className="mt-2 text-sm leading-7 text-slate-700">
                  正式执行前确认最终订舱号、提货窗口和目的港清关服务范围。
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">客户预期</div>
                <div className="mt-2 text-sm leading-7 text-slate-700">
                  报价中如已包含清关和末端派送，订单执行清单必须保持一致。
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <h3 className="text-xl font-bold">财务快照</h3>
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">报价收入</span>
                <span className="font-semibold text-white">${finance.revenue.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">报价成本</span>
                <span className="font-semibold text-slate-300">${finance.cost.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">预计利润</span>
                <span className="font-semibold text-emerald-300">${finance.profit.toFixed(0)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">结算状态</h3>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                应收未收：${finance.receivableOpen.toFixed(0)}
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                应付未付：${finance.payableOpen.toFixed(0)}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                下一步：供应商确认后生成结构化成本和应付记录。
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={handleGenerateReceivable}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {generateReceivableRpcMutation.isPending ? "生成中..." : "生成应收"}
              </button>
              <button
                type="button"
                onClick={handleOpenCostCapture}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                {generatePayablesRpcMutation.isPending ? "打开中..." : "打开成本录入"}
              </button>
            </div>
          </div>
        </aside>
      </div>
      )}
    </section>
  );
}
