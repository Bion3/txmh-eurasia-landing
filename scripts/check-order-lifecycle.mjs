const taskStatusLabels = {
  not_started: "未开始",
  pending: "待处理",
  in_progress: "进行中",
  done: "完成",
  blocked: "阻塞",
  skipped: "跳过",
};

const doorLifecycleSteps = [
  { key: "pickup", label: "提货 / 入仓", customerLabel: "Waiting for pickup or warehouse receiving", match: /提货|集货|入仓|入集货仓|warehouse|pickup/i, owner: "操作" },
  { key: "loading", label: "装箱 / 出库", customerLabel: "Cargo checked and loading arranged", match: /装箱|出库|loading|packing/i, owner: "仓库" },
  { key: "export_customs", label: "出口报关", customerLabel: "Export customs in progress", match: /报关|海关|customs|declaration/i, owner: "报关" },
  { key: "main_transport", label: "主运输", customerLabel: "Main transport in transit", match: /发车|开船|起飞|在途|班列|departure|main|transport/i, owner: "操作" },
  { key: "arrival_clearance", label: "到站 / 进口清关", customerLabel: "Arrival and import clearance", match: /到站|到港|清关|目的站|arrival|clearance/i, owner: "海外代理" },
  { key: "delivery", label: "末端派送 / 签收", customerLabel: "Final delivery or POD pending", match: /派送|签收|放行|delivery|pod|release/i, owner: "海外代理" },
  { key: "finance", label: "财务结算", customerLabel: "Settlement and invoice follow-up", match: /财务|应收|应付|结算|收款|付款|finance|receivable|payable/i, owner: "财务" },
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

function buildDoorLifecycle({ taskGroups, order, finance }) {
  const tasks = flattenTasks(taskGroups);
  const steps = doorLifecycleSteps.map((step) => {
    let status = lifecycleStatusFromTasks(tasks, step.match);

    if (step.key === "finance") {
      const hasRevenue = Number(finance?.revenue || 0) > 0;
      const hasCost = Number(finance?.cost || 0) > 0;
      if (hasRevenue && hasCost && status === "not_started") status = "in_progress";
    }

    return { ...step, status };
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

function scoreOrderDetailGovernance({ order, doorLifecycle, documentGroups, taskGroups, finance }) {
  const documents = documentGroups || [];
  const missingDocuments = documents.filter((group) => Number(group.count || 0) === 0);
  const tasks = flattenTasks(taskGroups || []);
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

  return {
    score,
    grade,
    priority,
    risks,
    metrics: {
      lifecycle: `${doorLifecycle?.progress || 0}%`,
      documents: `${documents.filter((group) => Number(group.count || 0) > 0).length}/${documents.length || 0}`,
      exceptions: openExceptions,
      logs: logs.length,
    },
  };
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function documentGroupMatches(group, pattern) {
  return pattern.test(`${group?.title || ""} ${group?.note || ""}`);
}

function scoreOrderVisibilityArchiveControl({ order, doorLifecycle, documentGroups, taskGroups }) {
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
  const tasks = flattenTasks(taskGroups || []);
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

  return {
    score,
    grade,
    priority,
    risks: risks.length ? risks : ["客户轨迹与归档稳定"],
    metrics: [
      { label: "客户轨迹", value: customerTraceScore },
      { label: "异常责任", value: responsibilityReady },
      { label: "POD归档", value: podArchiveScore },
      { label: "附件归档", value: archiveScore },
    ],
  };
}

const cases = [
  {
    name: "new order starts at pickup and flags missing cost",
    input: {
      taskGroups: [],
      order: {},
      finance: { revenue: 1000, cost: 0 },
    },
    assert: (result) => result.progress === 0 && result.activeStep.key === "pickup" && result.risks.includes("成本未确认或仍为预估"),
  },
  {
    name: "customs in progress after pickup and loading done",
    input: {
      taskGroups: [
        { title: "前段", tasks: [{ label: "待入集货仓", status: "done" }, { label: "装箱完成", status: "done" }] },
        { title: "报关", tasks: [{ label: "报关资料确认", status: "in_progress" }] },
      ],
      order: { receivable_status: "未结清" },
      finance: { revenue: 2000, cost: 1200 },
    },
    assert: (result) => result.progress === 29 && result.activeStep.key === "export_customs" && result.risks.includes("应收未结清或待生成"),
  },
  {
    name: "complete order lands on finance without open risks",
    input: {
      taskGroups: [
        { title: "前段", tasks: [{ label: "待入集货仓", status: "done" }, { label: "装箱完成", status: "done" }] },
        { title: "报关", tasks: [{ label: "报关资料确认", status: "done" }] },
        { title: "在途", tasks: [{ label: "待发车/开船/起飞", status: "done" }, { label: "目的站到达", status: "done" }, { label: "派送签收 POD", status: "done" }] },
        { title: "财务", tasks: [{ label: "应收应付确认", status: "done" }] },
      ],
      order: { receivable_status: "已结清" },
      finance: { revenue: 3000, cost: 1800 },
    },
    assert: (result) => result.progress === 100 && result.activeStep.key === "finance" && result.risks.length === 0,
  },
];

const governanceCases = [
  {
    name: "detail governance promotes open exception to P1",
    input: {
      order: {
        origin: "Xi'an",
        destination: "Duisburg",
        cargo_desc: "Auto parts",
        owner: "Eva",
        customer: "ACME",
        exceptions: [{ title: "海关查验", status: "open" }],
        operation_logs: [{ action: "新增异常" }],
      },
      taskGroups: [{ title: "报关", tasks: [{ label: "报关资料确认", status: "pending" }] }],
      documentGroups: [{ title: "托书", count: 1 }, { title: "报关资料", count: 0 }],
      finance: { revenue: 3000, cost: 1800 },
    },
    assert: (result) => result.priority === "P1" && result.risks.some((risk) => risk.includes("打开异常")),
  },
  {
    name: "detail governance flags document and cost gaps",
    input: {
      order: {
        origin: "Yiwu",
        destination: "Warsaw",
        cargo_desc: "E-commerce goods",
        owner: "Rosa",
        customer: "Marketplace",
        operation_logs: [{ action: "订单受理" }],
      },
      taskGroups: [{ title: "前段", tasks: [{ label: "待入集货仓", status: "in_progress" }] }],
      documentGroups: [{ title: "托书", count: 1 }, { title: "报关资料", count: 0 }, { title: "账单发票", count: 0 }],
      finance: { revenue: 2200, cost: 0 },
    },
    assert: (result) => result.priority === "P1" && result.risks.includes("应付/成本未确认") && result.metrics.documents === "1/3",
  },
  {
    name: "detail governance clean order stays P3",
    input: {
      order: {
        origin: "Shenzhen",
        destination: "Hamburg",
        cargo_desc: "Machinery",
        owner: "Eva",
        customer: "Clean GmbH",
        parties: [{ role: "shipper" }, { role: "consignee" }],
        operation_logs: [{ action: "订单受理" }, { action: "完成签收" }],
      },
      taskGroups: [{ title: "财务", tasks: [{ label: "应收应付确认", status: "done" }] }],
      documentGroups: [{ title: "托书", count: 1 }, { title: "报关资料", count: 1 }, { title: "账单发票", count: 1 }],
      finance: { revenue: 5000, cost: 3200 },
    },
    assert: (result) => result.priority === "P3" && result.grade === "A" && result.risks.length === 0,
  },
];

const visibilityArchiveCases = [
  {
    name: "visibility archive clean order stays P3",
    input: {
      order: {
        customer_visible_status: "Delivered and archived",
        customer_tracking_url: "https://track.example/orders/TX-001",
        exceptions: [],
        operation_logs: [{ action: "客户进度通知", after_value: "签收回单已归档" }],
      },
      taskGroups: [
        { title: "在途", tasks: [{ label: "派送签收 POD", status: "done" }] },
        { title: "财务", tasks: [{ label: "应收应付确认", status: "done" }] },
      ],
      documentGroups: [
        { title: "托书", count: 1 },
        { title: "报关资料", count: 1 },
        { title: "账单发票", count: 1 },
        { title: "POD签收回单", count: 1 },
      ],
      finance: { revenue: 3000, cost: 1800 },
    },
    assert: (result) => result.score === 100 && result.grade === "A" && result.priority === "P3" && result.risks.includes("客户轨迹与归档稳定"),
  },
  {
    name: "signed order missing POD becomes P1",
    input: {
      order: {
        exceptions: [],
        operation_logs: [],
      },
      taskGroups: [{ title: "在途", tasks: [{ label: "派送签收 POD", status: "done" }] }],
      documentGroups: [
        { title: "托书", count: 1 },
        { title: "报关资料", count: 1 },
        { title: "账单发票", count: 1 },
        { title: "POD签收回单", count: 0 },
      ],
      finance: { revenue: 2000, cost: 1200 },
    },
    assert: (result) => result.score === 64 && result.priority === "P1" && result.risks.includes("已签收但 POD/回单未归档"),
  },
  {
    name: "visibility archive catches exception without owner",
    input: {
      order: {
        exceptions: [{ title: "目的港查验", status: "open" }],
        operation_logs: [],
      },
      taskGroups: [{ title: "到站", tasks: [{ label: "目的站到达", status: "blocked" }] }],
      documentGroups: [{ title: "托书", count: 1 }],
      finance: { revenue: 1800, cost: 900 },
    },
    assert: (result) =>
      result.priority === "P1" &&
      result.risks.includes("1 个异常责任或预计解决时间不完整") &&
      result.risks.includes("存在阻塞任务影响客户可视进度"),
  },
];

let failures = 0;

for (const item of cases) {
  const result = buildDoorLifecycle(item.input);
  if (item.assert(result)) {
    console.log(`PASS  ${item.name} -> ${result.progress}%, active ${result.activeStep.key}, risks ${result.risks.length}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${item.name} -> ${JSON.stringify({
      progress: result.progress,
      active: result.activeStep.key,
      risks: result.risks,
      labels: taskStatusLabels,
    })}`);
  }
}

for (const item of governanceCases) {
  const lifecycle = buildDoorLifecycle(item.input);
  const result = scoreOrderDetailGovernance({ ...item.input, doorLifecycle: lifecycle });
  if (item.assert(result)) {
    console.log(`PASS  ${item.name} -> score ${result.score}, grade ${result.grade}, ${result.priority}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${item.name} -> ${JSON.stringify(result)}`);
  }
}

for (const item of visibilityArchiveCases) {
  const lifecycle = buildDoorLifecycle(item.input);
  const result = scoreOrderVisibilityArchiveControl({ ...item.input, doorLifecycle: lifecycle });
  if (item.assert(result)) {
    console.log(`PASS  ${item.name} -> score ${result.score}, grade ${result.grade}, ${result.priority}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${item.name} -> ${JSON.stringify(result)}`);
  }
}

if (failures > 0) {
  console.error(`\nOrder lifecycle check: ${failures} failed, ${cases.length + governanceCases.length + visibilityArchiveCases.length} total.`);
  process.exit(1);
}

console.log(`\nOrder lifecycle check: 0 failed, ${cases.length + governanceCases.length + visibilityArchiveCases.length} total.`);
