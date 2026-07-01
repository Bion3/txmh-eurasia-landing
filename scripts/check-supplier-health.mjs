const fixedToday = "2026-07-01";

const priorityRank = { P1: 1, P2: 2, P3: 3 };

function dateDistance(fromDate, toDate) {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Number.isFinite(from) && Number.isFinite(to) ? Math.round((to - from) / 86400000) : null;
}

function scoreSupplierHealth(row) {
  if (!row) {
    return {
      score: 0,
      grade: "N/A",
      tone: "slate",
      reasons: ["未选择供应商"],
    };
  }

  let score = 100;
  const reasons = [];

  if (row.expiredSheets.length) {
    score -= 35;
    reasons.push(`${row.expiredSheets.length} 张费率已过期`);
  }

  if (row.expiringSheets.length) {
    score -= 20;
    reasons.push(`${row.expiringSheets.length} 张费率 30 天内到期`);
  }

  if (!row.activeSheets.length) {
    score -= 25;
    reasons.push("没有可用于报价的有效费率");
  }

  if (row.missingProfile.length) {
    score -= Math.min(row.missingProfile.length * 8, 32);
    reasons.push(`档案缺口：${row.missingProfile.join("、")}`);
  }

  if (!row.modes.length) {
    score -= 10;
    reasons.push("服务运输方式未覆盖");
  }

  if (!row.lanes.length) {
    score -= 10;
    reasons.push("优势线路未配置");
  }

  const normalizedScore = Math.max(score, 0);
  const grade = normalizedScore >= 85 ? "A" : normalizedScore >= 70 ? "B" : normalizedScore >= 55 ? "C" : "D";
  const tone = grade === "A" ? "emerald" : grade === "B" ? "sky" : grade === "C" ? "amber" : "rose";

  return {
    score: normalizedScore,
    grade,
    tone,
    reasons: reasons.length ? reasons : ["供应商档案、费率有效期和线路覆盖健康"],
  };
}

function scoreSupplierKpiProfile(row) {
  if (!row) {
    return {
      score: 0,
      grade: "N/A",
      priority: "P1",
      metrics: [],
      risks: ["未选择供应商"],
      nextAction: "先选择供应商，再评估服务覆盖、费率、档案和财务准备度。",
    };
  }

  const profileTotal = 5;
  const profileReady = profileTotal - row.missingProfile.length;
  const modeCoverage = Math.min(row.modes.length, 3);
  const laneCoverage = Math.min(row.lanes.length, 4);
  const rateFreshness = row.sheets.length
    ? Math.max(0, Math.round(((row.activeSheets.length - row.expiredSheets.length) / row.sheets.length) * 100))
    : 0;
  const profileScore = Math.round(Math.max(profileReady, 0) / profileTotal * 100);
  const coverageScore = Math.round(((modeCoverage / 3) * 45) + ((laneCoverage / 4) * 55));
  const financeScore = row.vendor?.payment_term && row.vendor?.currency ? 100 : row.vendor?.payment_term || row.vendor?.currency ? 60 : 25;
  const exceptionScore = Math.max(100 - (row.expiredSheets.length * 30 + row.expiringSheets.length * 12 + row.missingProfile.length * 6), 0);
  const score = Math.round((rateFreshness * 0.3) + (profileScore * 0.2) + (coverageScore * 0.2) + (financeScore * 0.15) + (exceptionScore * 0.15));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const priority = grade === "D" || row.expiredSheets.length ? "P1" : grade === "C" || row.expiringSheets.length || row.missingProfile.length ? "P2" : "P3";
  const risks = [];

  if (rateFreshness < 70) risks.push("费率新鲜度不足");
  if (coverageScore < 60) risks.push("服务覆盖不足");
  if (profileScore < 80) risks.push("档案完整度不足");
  if (financeScore < 100) risks.push("账期/币种未准备好");
  if (exceptionScore < 75) risks.push("过期或临期风险偏高");

  let nextAction = "保持月度 KPI 复盘，记录优势线路、报价响应和异常处理表现。";
  if (priority === "P1") {
    nextAction = "暂停把该供应商作为自动报价首选，先补价、补档案并确认是否继续合作。";
  } else if (priority === "P2") {
    nextAction = "本周完成费率续价、档案补齐或覆盖线路复核，避免影响报价和对账。";
  }

  return {
    score,
    grade,
    priority,
    metrics: [
      { label: "费率新鲜度", value: rateFreshness },
      { label: "档案完整度", value: profileScore },
      { label: "服务覆盖", value: coverageScore },
      { label: "财务准备", value: financeScore },
      { label: "异常压力", value: exceptionScore },
    ],
    risks: risks.length ? risks : ["KPI 状态稳定"],
    nextAction,
  };
}

function hasAnyValue(source, keys) {
  return keys.some((key) => {
    const value = source?.[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

function scoreResponseHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return 45;
  if (hours <= 8) return 100;
  if (hours <= 24) return 80;
  if (hours <= 48) return 55;
  return 25;
}

function scoreSupplierDetailGovernance(row) {
  if (!row) {
    return {
      score: 0,
      grade: "N/A",
      priority: "P1",
      metrics: [],
      risks: ["未选择供应商"],
      nextAction: "先选择供应商，再检查附件、响应时效、对账和付款风险。",
    };
  }

  const vendor = row.vendor || {};
  const documents = [
    { label: "合同/框架协议", ready: hasAnyValue(vendor, ["contract_no", "contract_url", "contract_file_path", "agreement_url"]) },
    { label: "营业执照/注册号", ready: hasAnyValue(vendor, ["business_license_no", "license_no", "registration_no", "tax_id"]) },
    { label: "银行账户", ready: hasAnyValue(vendor, ["bank_name", "bank_account", "iban", "swift_code"]) },
    { label: "报价原件/费率附件", ready: row.sheets.some((sheet) => hasAnyValue(sheet, ["attachment_url", "source_document_url", "original_file_url", "file_path"])) },
    { label: "服务联系人", ready: Boolean(vendor.contact_name && (vendor.email || vendor.phone)) },
  ];
  const readyDocuments = documents.filter((item) => item.ready).length;
  const attachmentReady = Math.round((readyDocuments / documents.length) * 100);
  const responseSource = vendor.avg_response_hours ?? vendor.quote_response_hours ?? vendor.response_hours;
  const responseReady = scoreResponseHours(responseSource);
  const hasResponseRecord = Number.isFinite(Number(responseSource)) && Number(responseSource) > 0;
  const overduePayables = Number(vendor.overdue_payable_count || vendor.overdue_bills || 0);
  const disputeCount = Number(vendor.dispute_count || vendor.open_disputes || vendor.reconciliation_dispute_count || 0);
  const reconciliationBase = [
    hasAnyValue(vendor, ["payment_term"]),
    hasAnyValue(vendor, ["currency"]),
    hasAnyValue(vendor, ["bank_name", "bank_account", "iban", "swift_code"]),
    hasAnyValue(vendor, ["tax_id", "business_license_no", "license_no", "registration_no"]),
  ].filter(Boolean).length;
  const reconciliationReady = Math.max(0, Math.min(100, Math.round((reconciliationBase / 4) * 100) - overduePayables * 20 - disputeCount * 25));
  const hasRateAttachment = Boolean(documents.find((item) => item.label === "报价原件/费率附件")?.ready);
  const rateEvidenceReady = row.sheets.length
    ? Math.round((((row.activeSheets.length ? 1 : 0) + (hasRateAttachment ? 1 : 0)) / 2) * 100)
    : 0;
  const normalizedRateEvidence = Math.max(0, Math.min(100, rateEvidenceReady));
  const score = Math.round((attachmentReady * 0.3) + (responseReady * 0.25) + (reconciliationReady * 0.25) + (normalizedRateEvidence * 0.2));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const priority =
    grade === "D" || attachmentReady < 50 || overduePayables > 0 || disputeCount > 0
      ? "P1"
      : grade === "C" || !hasResponseRecord || reconciliationReady < 75
        ? "P2"
        : "P3";
  const risks = [];
  const missingDocuments = documents.filter((item) => !item.ready).map((item) => item.label);

  if (missingDocuments.length) risks.push(`附件缺口：${missingDocuments.join("、")}`);
  if (!hasResponseRecord) risks.push("缺少报价响应时效记录");
  else if (responseReady < 80) risks.push("报价响应超过 24 小时");
  if (reconciliationReady < 75) risks.push("对账/付款资料不足");
  if (overduePayables > 0) risks.push(`${overduePayables} 项应付逾期`);
  if (disputeCount > 0) risks.push(`${disputeCount} 项对账争议`);
  if (!row.activeSheets.length) risks.push("没有有效费率支撑报价");

  let nextAction = "供应商附件、响应、对账和费率证据稳定，可作为自动报价和履约首选。";
  if (priority === "P1") {
    nextAction = "先补合同/执照/银行资料和费率附件，关闭逾期应付或对账争议，再继续作为首选供应商。";
  } else if (priority === "P2") {
    nextAction = "本周补齐响应时效记录、付款资料或费率附件，形成可审计供应商详情。";
  }

  return {
    score,
    grade,
    priority,
    metrics: [
      { label: "附件合规", value: attachmentReady },
      { label: "响应时效", value: responseReady },
      { label: "对账付款", value: reconciliationReady },
      { label: "费率证据", value: normalizedRateEvidence },
    ],
    risks: risks.length ? risks : ["供应商详情治理稳定"],
    nextAction,
    missingDocuments,
  };
}

function rateVersionKey(sheet) {
  return [
    sheet.vendor_id || sheet.vendor?.vendor_name || "vendor",
    sheet.mode || "mode",
    sheet.shipment_type || "shipment",
    sheet.origin_port || sheet.origin_country || "origin",
    sheet.destination_port || sheet.destination_country || "destination",
  ].join("|").toLowerCase();
}

function scoreRateVersionReadiness(sheet, allSheets, selectedQuoteItemCount = null) {
  const daysToStart = sheet.effective_from ? dateDistance(fixedToday, sheet.effective_from) : null;
  const daysToExpiry = sheet.effective_to ? dateDistance(fixedToday, sheet.effective_to) : null;
  const sameLaneVersions = allSheets.filter((item) => rateVersionKey(item) === rateVersionKey(sheet));
  const hasNextVersion = sameLaneVersions.some((item) => {
    if (item.id === sheet.id || !sheet.effective_to || !item.effective_from) return false;
    return dateDistance(sheet.effective_to, item.effective_from) >= 0;
  });
  const quoteItemKnown = selectedQuoteItemCount !== null;
  const hasQuoteItems = !quoteItemKnown || selectedQuoteItemCount > 0;

  let score = 100;
  const risks = [];

  if (["expired", "archived"].includes(sheet.status)) {
    score -= 40;
    risks.push(`状态为 ${sheet.status}`);
  } else if (sheet.status === "draft") {
    score -= 25;
    risks.push("草稿未生效");
  }

  if (!sheet.effective_from || !sheet.effective_to) {
    score -= 20;
    risks.push("有效期不完整");
  }

  if (daysToStart !== null && daysToStart > 0) {
    score -= 12;
    risks.push(`${daysToStart} 天后才生效`);
  }

  if (daysToExpiry !== null && daysToExpiry < 0) {
    score -= 35;
    risks.push(`已过期 ${Math.abs(daysToExpiry)} 天`);
  } else if (daysToExpiry !== null && daysToExpiry <= 7) {
    score -= hasNextVersion ? 12 : 25;
    risks.push(hasNextVersion ? "即将到期但已有下一版" : "7 天内到期且无下一版");
  } else if (daysToExpiry !== null && daysToExpiry <= 30) {
    score -= hasNextVersion ? 5 : 12;
    risks.push(hasNextVersion ? "30 天内到期且已有下一版" : "30 天内到期待续价");
  }

  if (!sheet.vendor?.vendor_name && !sheet.vendor_id) {
    score -= 20;
    risks.push("未绑定供应商");
  }

  if ((!sheet.origin_port && !sheet.origin_country) || (!sheet.destination_port && !sheet.destination_country)) {
    score -= 10;
    risks.push("线路范围不完整");
  }

  if (!hasQuoteItems) {
    score -= 25;
    risks.push("缺少自动报价费项");
  }

  const normalizedScore = Math.max(Math.min(score, 100), 0);
  const grade = normalizedScore >= 85 ? "A" : normalizedScore >= 70 ? "B" : normalizedScore >= 55 ? "C" : "D";
  const priority =
    grade === "D" || daysToExpiry < 0 || !hasQuoteItems || (!sheet.vendor?.vendor_name && !sheet.vendor_id)
      ? "P1"
      : grade === "C" || sheet.status === "draft" || (daysToExpiry !== null && daysToExpiry <= 30 && !hasNextVersion)
        ? "P2"
        : "P3";

  const approvalLabel =
    ["expired", "archived"].includes(sheet.status)
      ? "需替换归档"
      : sheet.status === "draft"
        ? "待生效审批"
        : priority === "P1"
          ? "阻断自动报价"
          : priority === "P2"
            ? "需续价复核"
            : "可用于报价";

  return {
    score: normalizedScore,
    grade,
    priority,
    approvalLabel,
    hasNextVersion,
    versionCount: sameLaneVersions.length,
    risks: risks.length ? risks : ["版本、审批、生效窗口和报价费项健康"],
  };
}

function buildRateVersionApprovalRows(rateSheets, selectedSheetId, selectedQuoteItemCount) {
  return (rateSheets || [])
    .map((sheet) => ({
      id: sheet.id,
      sheet,
      readiness: scoreRateVersionReadiness(
        sheet,
        rateSheets,
        sheet.id === selectedSheetId ? selectedQuoteItemCount : null,
      ),
    }))
    .sort((first, second) => {
      const priorityDifference = priorityRank[first.readiness.priority] - priorityRank[second.readiness.priority];
      if (priorityDifference) return priorityDifference;
      return first.readiness.score - second.readiness.score;
    });
}

const scenarios = [
  {
    name: "healthy supplier gets grade A",
    row: {
      activeSheets: [{ id: "rs1" }],
      expiredSheets: [],
      expiringSheets: [],
      missingProfile: [],
      modes: ["rail"],
      lanes: ["XIAN -> DUISBURG"],
    },
    assert: (result) => result.score === 100 && result.grade === "A",
  },
  {
    name: "expiring rate downgrades to B",
    row: {
      activeSheets: [{ id: "rs1" }],
      expiredSheets: [],
      expiringSheets: [{ id: "rs1" }],
      missingProfile: [],
      modes: ["rail"],
      lanes: ["XIAN -> DUISBURG"],
    },
    assert: (result) => result.score === 80 && result.grade === "B",
  },
  {
    name: "profile gaps create supplier action risk",
    row: {
      activeSheets: [{ id: "rs1" }],
      expiredSheets: [],
      expiringSheets: [],
      missingProfile: ["联系人", "邮箱", "账期"],
      modes: ["sea"],
      lanes: ["NINGBO -> HAMBURG"],
    },
    assert: (result) => result.score === 76 && result.grade === "B" && result.reasons.some((reason) => reason.includes("档案缺口")),
  },
  {
    name: "expired and uncovered supplier becomes grade D",
    row: {
      activeSheets: [],
      expiredSheets: [{ id: "rs-old" }],
      expiringSheets: [],
      missingProfile: ["联系人", "邮箱"],
      modes: [],
      lanes: [],
    },
    assert: (result) => result.score === 4 && result.grade === "D",
  },
];

const kpiScenarios = [
  {
    name: "strong supplier KPI stays P3",
    row: {
      vendor: { payment_term: "30 days", currency: "USD" },
      sheets: [{ id: "rs1" }, { id: "rs2" }],
      activeSheets: [{ id: "rs1" }, { id: "rs2" }],
      expiredSheets: [],
      expiringSheets: [],
      missingProfile: [],
      modes: ["rail", "sea", "air"],
      lanes: ["XIAN -> DUISBURG", "NINGBO -> HAMBURG", "PVG -> FRA", "YIWU -> WARSAW"],
    },
    assert: (result) => result.score === 100 && result.grade === "A" && result.priority === "P3" && result.risks.includes("KPI 状态稳定"),
  },
  {
    name: "missing finance and narrow coverage lowers KPI",
    row: {
      vendor: { payment_term: "", currency: "" },
      sheets: [{ id: "rs1" }],
      activeSheets: [{ id: "rs1" }],
      expiredSheets: [],
      expiringSheets: [],
      missingProfile: ["账期", "币种"],
      modes: ["rail"],
      lanes: ["XIAN -> DUISBURG"],
    },
    assert: (result) => result.score === 65 && result.grade === "C" && result.priority === "P2" && result.risks.includes("账期/币种未准备好"),
  },
  {
    name: "expired supplier KPI becomes P1",
    row: {
      vendor: {},
      sheets: [{ id: "rs-old" }],
      activeSheets: [],
      expiredSheets: [{ id: "rs-old" }],
      expiringSheets: [],
      missingProfile: ["联系人", "邮箱", "电话", "账期", "币种"],
      modes: [],
      lanes: [],
    },
    assert: (result) => result.score === 10 && result.grade === "D" && result.priority === "P1" && result.nextAction.includes("暂停"),
  },
];

const supplierDetailGovernanceScenarios = [
  {
    name: "supplier detail governance clean supplier stays P3",
    row: {
      vendor: {
        contract_no: "CTR-2026-001",
        tax_id: "DE123456",
        bank_name: "HSBC",
        bank_account: "123456",
        contact_name: "Anna",
        email: "anna@example.com",
        payment_term: "30 days",
        currency: "USD",
        avg_response_hours: 6,
      },
      sheets: [{ id: "rs1", attachment_url: "rate.pdf" }],
      activeSheets: [{ id: "rs1" }],
    },
    assert: (result) => result.score === 100 && result.grade === "A" && result.priority === "P3" && result.risks.includes("供应商详情治理稳定"),
  },
  {
    name: "supplier detail governance catches attachment response and payable risk",
    row: {
      vendor: {
        currency: "USD",
        avg_response_hours: 72,
        overdue_payable_count: 1,
        dispute_count: 1,
      },
      sheets: [{ id: "rs1" }],
      activeSheets: [],
    },
    assert: (result) => result.score === 6 &&
      result.grade === "D" &&
      result.priority === "P1" &&
      result.risks.some((risk) => risk.includes("附件缺口")) &&
      result.risks.includes("报价响应超过 24 小时") &&
      result.risks.includes("1 项应付逾期") &&
      result.risks.includes("1 项对账争议"),
  },
  {
    name: "supplier detail governance missing response becomes P2",
    row: {
      vendor: {
        contract_url: "contract.pdf",
        tax_id: "CN123",
        bank_name: "BOC",
        contact_name: "Li",
        phone: "13800000000",
        payment_term: "15 days",
        currency: "CNY",
      },
      sheets: [{ id: "rs1" }],
      activeSheets: [{ id: "rs1" }],
    },
    assert: (result) => result.score === 70 &&
      result.grade === "B" &&
      result.priority === "P2" &&
      result.risks.includes("缺少报价响应时效记录") &&
      result.metrics.find((metric) => metric.label === "附件合规")?.value === 80,
  },
];

const rateVersionScenarios = [
  {
    name: "active approved rate version stays usable for quote engine",
    assert: () => {
      const rows = buildRateVersionApprovalRows([
        {
          id: "rs1",
          status: "active",
          vendor: { vendor_name: "TX Rail Partner" },
          mode: "rail",
          shipment_type: "LCL",
          origin_port: "XIAN",
          destination_port: "DUISBURG",
          effective_from: "2026-06-01",
          effective_to: "2026-08-15",
        },
      ], "rs1", 2);

      return rows[0].readiness.score === 100 &&
        rows[0].readiness.grade === "A" &&
        rows[0].readiness.priority === "P3" &&
        rows[0].readiness.approvalLabel === "可用于报价";
    },
  },
  {
    name: "draft rate version requires approval before activation",
    assert: () => {
      const result = scoreRateVersionReadiness({
        id: "rs-draft",
        status: "draft",
        vendor: { vendor_name: "Blue Ocean Carrier" },
        mode: "sea",
        shipment_type: "FCL",
        origin_port: "NINGBO",
        destination_port: "HAMBURG",
        effective_from: "2026-07-05",
        effective_to: "2026-09-01",
      }, [], 3);

      return result.score === 63 &&
        result.grade === "C" &&
        result.priority === "P2" &&
        result.approvalLabel === "待生效审批" &&
        result.risks.includes("草稿未生效") &&
        result.risks.includes("4 天后才生效");
    },
  },
  {
    name: "expired unbound rate without quote items blocks automatic pricing",
    assert: () => {
      const result = scoreRateVersionReadiness({
        id: "rs-old",
        status: "active",
        mode: "air",
        shipment_type: "air_cargo",
        origin_port: "PVG",
        destination_port: "FRA",
        effective_from: "2026-05-01",
        effective_to: "2026-06-30",
      }, [], 0);

      return result.score === 20 &&
        result.grade === "D" &&
        result.priority === "P1" &&
        result.approvalLabel === "阻断自动报价" &&
        result.risks.includes("已过期 1 天") &&
        result.risks.includes("未绑定供应商") &&
        result.risks.includes("缺少自动报价费项");
    },
  },
  {
    name: "expiring rate with next version is ranked after blockers",
    assert: () => {
      const rows = buildRateVersionApprovalRows([
        {
          id: "rs-current",
          status: "active",
          vendor: { vendor_name: "TX Rail Partner" },
          mode: "rail",
          shipment_type: "LCL",
          origin_port: "XIAN",
          destination_port: "DUISBURG",
          effective_from: "2026-06-01",
          effective_to: "2026-07-05",
        },
        {
          id: "rs-next",
          status: "draft",
          vendor: { vendor_name: "TX Rail Partner" },
          mode: "rail",
          shipment_type: "LCL",
          origin_port: "XIAN",
          destination_port: "DUISBURG",
          effective_from: "2026-07-05",
          effective_to: "2026-08-31",
        },
        {
          id: "rs-blocked",
          status: "active",
          mode: "sea",
          shipment_type: "FCL",
          origin_port: "NINGBO",
          destination_port: "HAMBURG",
          effective_from: "2026-05-01",
          effective_to: "2026-06-30",
        },
      ], "rs-current", 2);

      return rows[0].id === "rs-blocked" &&
        rows[1].id === "rs-next" &&
        rows[2].id === "rs-current" &&
        rows[2].readiness.hasNextVersion === true &&
        rows[2].readiness.risks.includes("即将到期但已有下一版");
    },
  },
];

let failures = 0;

for (const scenario of scenarios) {
  const result = scoreSupplierHealth(scenario.row);
  if (scenario.assert(result)) {
    console.log(`PASS  ${scenario.name} -> score ${result.score}, grade ${result.grade}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${scenario.name} -> ${JSON.stringify(result)}`);
  }
}

for (const scenario of kpiScenarios) {
  const result = scoreSupplierKpiProfile(scenario.row);
  if (scenario.assert(result)) {
    console.log(`PASS  ${scenario.name} -> score ${result.score}, grade ${result.grade}, ${result.priority}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${scenario.name} -> ${JSON.stringify(result)}`);
  }
}

for (const scenario of supplierDetailGovernanceScenarios) {
  const result = scoreSupplierDetailGovernance(scenario.row);
  if (scenario.assert(result)) {
    console.log(`PASS  ${scenario.name} -> score ${result.score}, grade ${result.grade}, ${result.priority}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${scenario.name} -> ${JSON.stringify(result)}`);
  }
}

for (const scenario of rateVersionScenarios) {
  if (scenario.assert()) {
    console.log(`PASS  ${scenario.name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${scenario.name}`);
  }
}

if (failures > 0) {
  console.error(`\nSupplier health check: ${failures} failed, ${scenarios.length + kpiScenarios.length + supplierDetailGovernanceScenarios.length + rateVersionScenarios.length} total.`);
  process.exit(1);
}

console.log(`\nSupplier health check: 0 failed, ${scenarios.length + kpiScenarios.length + supplierDetailGovernanceScenarios.length + rateVersionScenarios.length} total.`);
