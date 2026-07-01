import { useEffect, useMemo, useState } from "react";
import { useCreateRateSheetItem, useRateSheetItems, useRateSheetList, useVendorList } from "../../hooks/useCostCenter";

function businessDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offsetDays));
  return date.toISOString().slice(0, 10);
}

const fallbackRateSheets = [
  {
    id: "fallback-rail-lcl",
    rate_sheet_no: "RS-RAIL-LCL-001",
    name: "Rail LCL Europe Base Rate",
    mode: "rail",
    shipment_type: "LCL",
    origin_port: "XI'AN",
    destination_port: "DUISBURG",
    currency: "USD",
    effective_from: businessDate(-30),
    effective_to: businessDate(5),
    status: "active",
    priority: 10,
    vendor: { vendor_name: "TX Rail Partner", vendor_type: "rail" },
    isFallback: true,
  },
  {
    id: "fallback-sea-fcl",
    rate_sheet_no: "RS-SEA-FCL-001",
    name: "Sea FCL Europe Base Rate",
    mode: "sea",
    shipment_type: "FCL",
    origin_port: "NINGBO",
    destination_port: "HAMBURG",
    currency: "USD",
    effective_from: businessDate(-90),
    effective_to: businessDate(-1),
    status: "active",
    priority: 20,
    vendor: { vendor_name: "Blue Ocean Carrier", vendor_type: "ocean" },
    isFallback: true,
  },
  {
    id: "fallback-air",
    rate_sheet_no: "RS-AIR-GEN-001",
    name: "Air Cargo General Rate",
    mode: "air",
    shipment_type: "air_cargo",
    origin_port: "PVG",
    destination_port: "FRA",
    currency: "USD",
    effective_from: businessDate(-15),
    effective_to: businessDate(45),
    status: "active",
    priority: 30,
    vendor: { vendor_name: "SkyBridge Air", vendor_type: "air" },
    isFallback: true,
  },
];

const fallbackItemsBySheet = {
  "fallback-rail-lcl": [
    { id: "rail-main", fee_code: "RAIL-LCL", fee_name: "铁路拼箱运费", calc_method: "per_cbm", unit: "CBM", min_charge: 120, unit_price: 88, currency: "USD", included_in_quote: true },
    { id: "rail-doc", fee_code: "DOC", fee_name: "文件费", calc_method: "fixed", unit: "SHIPMENT", min_charge: 0, unit_price: 35, currency: "USD", included_in_quote: true },
    { id: "rail-customs", fee_code: "CUST", fee_name: "出口报关成本", calc_method: "fixed", unit: "SHIPMENT", min_charge: 0, unit_price: 55, currency: "USD", included_in_quote: false },
  ],
  "fallback-sea-fcl": [
    { id: "sea-main", fee_code: "SEA-FCL", fee_name: "海运整柜主运费", calc_method: "per_container", unit: "CONTAINER", min_charge: 0, unit_price: 1450, currency: "USD", included_in_quote: true },
    { id: "sea-thc", fee_code: "THC", fee_name: "码头操作费", calc_method: "per_container", unit: "CONTAINER", min_charge: 0, unit_price: 190, currency: "USD", included_in_quote: true },
  ],
  "fallback-air": [
    { id: "air-main", fee_code: "AIR", fee_name: "空运运费", calc_method: "per_kg", unit: "KG", min_charge: 90, unit_price: 3.8, currency: "USD", included_in_quote: true },
    { id: "air-sec", fee_code: "SEC", fee_name: "安检费", calc_method: "fixed", unit: "SHIPMENT", min_charge: 0, unit_price: 28, currency: "USD", included_in_quote: true },
  ],
};

const modeLabels = {
  rail: "铁路",
  sea: "海运",
  air: "空运",
};

const shipmentLabels = {
  FCL: "整箱",
  LCL: "拼箱",
  air_cargo: "空运货",
};

const calcMethodLabels = {
  fixed: "固定费",
  per_cbm: "按 CBM",
  per_kg: "按 KG",
  per_shipment: "按票",
  per_container: "按柜",
  tiered: "阶梯价",
};

const vendorTypeLabels = {
  rail: "铁路承运",
  ocean: "海运船司/订舱",
  sea: "海运船司/订舱",
  air: "空运代理",
  trucking: "拖车",
  customs: "报关",
  warehouse: "仓储",
  overseas_agent: "海外代理",
  agent: "代理",
};

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

const priorityRank = { P1: 1, P2: 2, P3: 3 };

function dateDistance(fromDate, toDate) {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Number.isFinite(from) && Number.isFinite(to) ? Math.round((to - from) / 86400000) : null;
}

function formatRateDate(value) {
  return value || "未设置";
}

function buildRateHealthRows(rateSheets, selectedSheetId, quoteItemCount, selectedItemAuditReady) {
  const today = businessDate();

  return rateSheets
    .map((sheet) => {
      const issues = [];
      const daysToStart = sheet.effective_from ? dateDistance(today, sheet.effective_from) : null;
      const daysToExpiry = sheet.effective_to ? dateDistance(today, sheet.effective_to) : null;

      if (["expired", "archived"].includes(sheet.status)) {
        issues.push({ priority: "P1", issue: `状态为 ${sheet.status}`, action: "确认是否替换为供应商最新费率并重新生效" });
      } else if (sheet.status === "draft") {
        issues.push({ priority: "P2", issue: "费率仍为草稿", action: "完成复核后生效，避免报价匹配不到" });
      }

      if (daysToStart !== null && daysToStart > 0) {
        issues.push({ priority: "P2", issue: `${daysToStart} 天后才生效`, action: "确认当前报价是否需要补一张过渡费率" });
      }

      if (daysToExpiry !== null && daysToExpiry < 0) {
        issues.push({ priority: "P1", issue: `已过期 ${Math.abs(daysToExpiry)} 天`, action: "立即向供应商补价并替换过期费率" });
      } else if (daysToExpiry !== null && daysToExpiry <= 7) {
        issues.push({ priority: "P1", issue: `${daysToExpiry} 天内到期`, action: "今天发起续价，避免询盘无法自动核价" });
      } else if (daysToExpiry !== null && daysToExpiry <= 30) {
        issues.push({ priority: "P2", issue: `${daysToExpiry} 天内到期`, action: "本周向供应商询价并准备下一版本" });
      }

      if (!sheet.effective_from || !sheet.effective_to) {
        issues.push({ priority: "P2", issue: "有效期不完整", action: "补齐生效和失效日期，降低误用旧价风险" });
      }

      if (!sheet.vendor?.vendor_name && !sheet.vendor_id) {
        issues.push({ priority: "P1", issue: "未绑定供应商", action: "绑定责任供应商，确保补价和对账可追踪" });
      }

      if ((!sheet.origin_port && !sheet.origin_country) || (!sheet.destination_port && !sheet.destination_country)) {
        issues.push({ priority: "P2", issue: "线路范围不完整", action: "补齐起运地和目的地，提升自动匹配准确率" });
      }

      if (sheet.id === selectedSheetId && selectedItemAuditReady && quoteItemCount === 0) {
        issues.push({ priority: "P1", issue: "没有自动报价费项", action: "至少配置一项参与自动报价的主运费" });
      }

      if (!issues.length) {
        issues.push({ priority: "P3", issue: "费率健康", action: "保持供应商与有效期的周期复核" });
      }

      issues.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

      return {
        id: sheet.id,
        sheet,
        priority: issues[0].priority,
        issue: issues.map((item) => item.issue).join("；"),
        action: issues[0].action,
        daysToExpiry,
      };
    })
    .sort((a, b) => {
      const priorityDifference = priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDifference) return priorityDifference;
      return (a.daysToExpiry ?? Number.MAX_SAFE_INTEGER) - (b.daysToExpiry ?? Number.MAX_SAFE_INTEGER);
    });
}

function buildRateHealthPlan(rows, selectedSheet, quoteItemCount) {
  const actionRows = rows.filter((row) => row.priority !== "P3");
  const lines = [
    `费率健康/补价行动清单 ${businessDate()}`,
    `P1 ${rows.filter((row) => row.priority === "P1").length} 项 · P2 ${rows.filter((row) => row.priority === "P2").length} 项`,
    "",
  ];

  if (!actionRows.length) {
    lines.push("当前费率健康，无需紧急补价。");
  } else {
    actionRows.slice(0, 12).forEach((row, index) => {
      lines.push(`${index + 1}. [${row.priority}] ${row.sheet.rate_sheet_no || row.sheet.name}`);
      lines.push(`问题：${row.issue}`);
      lines.push(`行动：${row.action}`);
    });
  }

  if (selectedSheet) {
    lines.push("");
    lines.push(`当前核验：${selectedSheet.rate_sheet_no || selectedSheet.name}，${quoteItemCount} 项参与自动报价。`);
  }

  return lines.join("\n");
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
  const today = businessDate();
  const daysToStart = sheet.effective_from ? dateDistance(today, sheet.effective_from) : null;
  const daysToExpiry = sheet.effective_to ? dateDistance(today, sheet.effective_to) : null;
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

  const nextAction =
    priority === "P1"
      ? "先补供应商、有效期、报价费项或下一版本，再允许报价中心自动调用。"
      : priority === "P2"
        ? "本周完成续价、版本审批或生效窗口复核，避免月底报价断档。"
        : "保持当前版本，提前 30 天准备下一轮供应商询价和生效审批。";

  return {
    score: normalizedScore,
    grade,
    priority,
    approvalLabel,
    hasNextVersion,
    versionCount: sameLaneVersions.length,
    risks: risks.length ? risks : ["版本、审批、生效窗口和报价费项健康"],
    nextAction,
    metrics: [
      { label: "版本连续性", value: hasNextVersion || daysToExpiry === null || daysToExpiry > 30 ? 100 : daysToExpiry > 7 ? 75 : 45 },
      { label: "审批状态", value: sheet.status === "active" ? 100 : sheet.status === "draft" ? 55 : 25 },
      { label: "生效窗口", value: daysToExpiry === null ? 70 : daysToExpiry < 0 ? 15 : daysToExpiry <= 7 ? 45 : daysToExpiry <= 30 ? 75 : 100 },
      { label: "报价可用", value: hasQuoteItems ? 100 : 35 },
    ],
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

function buildRateVersionApprovalPlan(rows) {
  const actionRows = rows.filter((row) => row.readiness.priority !== "P3");
  const lines = [
    `费率版本/生效审批清单 ${businessDate()}`,
    `P1 ${rows.filter((row) => row.readiness.priority === "P1").length} 项 · P2 ${rows.filter((row) => row.readiness.priority === "P2").length} 项`,
    "",
  ];

  if (!actionRows.length) {
    lines.push("当前费率版本、生效审批和自动报价可用性稳定。");
  } else {
    actionRows.slice(0, 12).forEach((row, index) => {
      lines.push(`${index + 1}. [${row.readiness.priority}] ${row.sheet.rate_sheet_no || row.sheet.name}｜${row.readiness.approvalLabel}｜${row.readiness.score}/${row.readiness.grade}`);
      lines.push(`   风险：${row.readiness.risks.join("、")}`);
      lines.push(`   下一步：${row.readiness.nextAction}`);
    });
  }

  lines.push("");
  lines.push("审批建议：草稿费率先核供应商原始报价、有效期、币种和自动报价费项；过期费率必须有下一版本或归档。");
  return lines.join("\n");
}

function vendorDisplayName(vendor) {
  return vendor?.vendor_name || vendor?.name || "未绑定供应商";
}

function vendorIdentity(vendor) {
  return vendor?.id || vendorDisplayName(vendor);
}

function rateSheetVendorIdentity(sheet) {
  return sheet.vendor_id || sheet.vendor?.id || vendorIdentity(sheet.vendor);
}

function buildVendorRows(vendors, rateSheets) {
  const vendorMap = new Map();

  vendors.forEach((vendor) => {
    vendorMap.set(vendorIdentity(vendor), {
      vendor,
      sheets: [],
    });
  });

  rateSheets.forEach((sheet) => {
    const key = rateSheetVendorIdentity(sheet);
    const fallbackVendor = sheet.vendor || {
      id: key,
      vendor_name: key,
      vendor_type: sheet.mode,
      country: sheet.destination_country || sheet.origin_country,
      currency: sheet.currency,
      status: "active",
    };

    if (!vendorMap.has(key)) {
      vendorMap.set(key, {
        vendor: fallbackVendor,
        sheets: [],
      });
    }

    vendorMap.get(key).sheets.push(sheet);
  });

  const today = businessDate();

  return [...vendorMap.values()]
    .map(({ vendor, sheets }) => {
      const activeSheets = sheets.filter((sheet) => sheet.status === "active");
      const expiredSheets = sheets.filter((sheet) => {
        const daysToExpiry = sheet.effective_to ? dateDistance(today, sheet.effective_to) : null;
        return daysToExpiry !== null && daysToExpiry < 0;
      });
      const expiringSheets = sheets.filter((sheet) => {
        const daysToExpiry = sheet.effective_to ? dateDistance(today, sheet.effective_to) : null;
        return daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30;
      });
      const modes = new Set(sheets.map((sheet) => sheet.mode).filter(Boolean));
      const lanes = sheets
        .map((sheet) => [sheet.origin_port || sheet.origin_country, sheet.destination_port || sheet.destination_country].filter(Boolean).join(" -> "))
        .filter(Boolean);
      const missingProfile = [
        ["联系人", vendor?.contact_name],
        ["邮箱", vendor?.email],
        ["电话", vendor?.phone],
        ["账期", vendor?.payment_term],
        ["币种", vendor?.currency],
      ].filter(([, value]) => !value).map(([label]) => label);

      let priority = "P3";
      let nextAction = "保持月度费率复核，记录该供应商优势线路和异常反馈。";

      if (expiredSheets.length) {
        priority = "P1";
        nextAction = "立即要求供应商补最新价格，过期费率不能继续自动核价。";
      } else if (expiringSheets.length) {
        priority = "P1";
        nextAction = "今天发起续价，确认下一周期价格、舱位和有效期。";
      } else if (!activeSheets.length) {
        priority = "P2";
        nextAction = "确认供应商是否仍合作，至少补一张可用于报价的有效费率表。";
      } else if (missingProfile.length) {
        priority = "P2";
        nextAction = `补齐供应商档案：${missingProfile.join("、")}，避免对账和异常处理找不到责任人。`;
      }

      return {
        id: vendorIdentity(vendor),
        vendor,
        sheets,
        activeSheets,
        expiredSheets,
        expiringSheets,
        modes: [...modes],
        lanes,
        missingProfile,
        priority,
        nextAction,
      };
    })
    .sort((a, b) => {
      const priorityDifference = priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDifference) return priorityDifference;
      return b.activeSheets.length - a.activeSheets.length || vendorDisplayName(a.vendor).localeCompare(vendorDisplayName(b.vendor));
    });
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
      { label: "费率新鲜度", value: rateFreshness, hint: `${row.activeSheets.length}/${row.sheets.length || 0} 张可用` },
      { label: "档案完整度", value: profileScore, hint: row.missingProfile.length ? `缺 ${row.missingProfile.join("、")}` : "联系人/账期/币种齐全" },
      { label: "服务覆盖", value: coverageScore, hint: `${row.modes.length} 种方式 · ${row.lanes.length} 条线路` },
      { label: "财务准备", value: financeScore, hint: `账期 ${row.vendor?.payment_term || "待补"} · 币种 ${row.vendor?.currency || "待补"}` },
      { label: "异常压力", value: exceptionScore, hint: `过期 ${row.expiredSheets.length} · 临期 ${row.expiringSheets.length}` },
    ],
    risks: risks.length ? risks : ["KPI 状态稳定"],
    nextAction,
  };
}

function supplierHealthClass(tone) {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "sky") return "border-sky-200 bg-sky-50 text-sky-800";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function supplierKpiClass(priority) {
  if (priority === "P1") return "border-rose-200 bg-rose-50 text-rose-800";
  if (priority === "P2") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
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
      { label: "附件合规", value: attachmentReady, hint: `${readyDocuments}/${documents.length} 项齐全` },
      { label: "响应时效", value: responseReady, hint: hasResponseRecord ? `${Number(responseSource)} 小时` : "待记录" },
      { label: "对账付款", value: reconciliationReady, hint: `逾期 ${overduePayables} · 争议 ${disputeCount}` },
      { label: "费率证据", value: normalizedRateEvidence, hint: `${row.activeSheets.length} 张有效费率` },
    ],
    risks: risks.length ? risks : ["供应商详情治理稳定"],
    nextAction,
    missingDocuments,
  };
}

function buildSupplierDetailGovernancePlan(row, control) {
  if (!row || !control) return "";

  return [
    `供应商详情治理清单 ${businessDate()}`,
    `${vendorDisplayName(row.vendor)}｜${control.priority}｜${control.score}/${control.grade}`,
    "",
    `附件缺口：${control.missingDocuments.length ? control.missingDocuments.join("、") : "无"}`,
    `治理风险：${control.risks.join("、")}`,
    `下一步：${control.nextAction}`,
    "",
    "执行建议：供应商附件、报价响应、对账争议和应付逾期要和费率版本一起复核，避免未审供应商进入客户报价或门到门履约。",
  ].join("\n");
}

function buildSupplierActionPlan(rows) {
  const actionRows = rows.filter((row) => row.priority !== "P3");
  const lines = [
    `供应商管理行动清单 ${businessDate()}`,
    `供应商：${rows.length}｜P1：${rows.filter((row) => row.priority === "P1").length}｜P2：${rows.filter((row) => row.priority === "P2").length}`,
    "",
  ];

  if (!actionRows.length) {
    lines.push("当前供应商档案和费率状态没有紧急问题，建议继续按月复核重点线路价格和账期。");
  } else {
    actionRows.slice(0, 12).forEach((row, index) => {
      const kpi = scoreSupplierKpiProfile(row);
      lines.push(`${index + 1}. [${row.priority}] ${vendorDisplayName(row.vendor)}｜${vendorTypeLabels[row.vendor?.vendor_type] || row.vendor?.vendor_type || "供应商"}`);
      lines.push(`   有效率表：${row.activeSheets.length}｜过期：${row.expiredSheets.length}｜30天内到期：${row.expiringSheets.length}`);
      lines.push(`   覆盖：${row.modes.map((mode) => modeLabels[mode] || mode).join("、") || "待补"}｜档案缺口：${row.missingProfile.join("、") || "无"}`);
      lines.push(`   KPI：${kpi.score} / ${kpi.grade}｜风险：${kpi.risks.join("、")}`);
      lines.push(`   下一步：${row.nextAction}`);
    });
  }

  lines.push("");
  lines.push("管理建议：像 CRM 管客户一样管理供应商，把联系人、账期、优势线路、费率有效期和异常记录集中维护。");
  return lines.join("\n");
}

export default function CostCenterWorkspace({ onNavigateQuotes, onNotify }) {
  const [filters, setFilters] = useState({
    mode: "",
    shipment_type: "",
    status: "",
    keyword: "",
  });
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [rateHealthPlanText, setRateHealthPlanText] = useState("");
  const [supplierPlanText, setSupplierPlanText] = useState("");
  const [rateApprovalPlanText, setRateApprovalPlanText] = useState("");
  const [supplierGovernancePlanText, setSupplierGovernancePlanText] = useState("");
  const [itemDraft, setItemDraft] = useState({
    fee_code: "",
    fee_name: "",
    calc_method: "fixed",
    unit: "SHIPMENT",
    min_charge: "",
    unit_price: "",
    currency: "USD",
    included_in_quote: true,
  });

  const vendorQuery = useVendorList({ status: "active", page_size: 100 });
  const rateSheetQuery = useRateSheetList({ ...filters, page_size: 100 });
  const liveRateSheets = rateSheetQuery.data?.items || [];
  const displayRateSheets = liveRateSheets.length ? liveRateSheets : fallbackRateSheets;
  const selectedSheet = displayRateSheets.find((sheet) => sheet.id === selectedSheetId) || displayRateSheets[0];
  const itemQuery = useRateSheetItems(selectedSheet?.isFallback ? null : selectedSheet?.id, { page_size: 100 });
  const createItemMutation = useCreateRateSheetItem(selectedSheet?.id);
  const liveItems = itemQuery.data?.items || [];
  const displayItems = selectedSheet?.isFallback ? fallbackItemsBySheet[selectedSheet.id] || [] : liveItems;
  const vendors = vendorQuery.data?.items || [];

  useEffect(() => {
    if (displayRateSheets.length && !displayRateSheets.some((sheet) => sheet.id === selectedSheetId)) {
      setSelectedSheetId(displayRateSheets[0].id);
    }
  }, [displayRateSheets, selectedSheetId]);

  const summary = useMemo(() => {
    const quoteItems = displayItems.filter((item) => item.included_in_quote);
    const modes = new Set(displayRateSheets.map((sheet) => sheet.mode));

    return {
      vendors: vendors.length || new Set(displayRateSheets.map((sheet) => sheet.vendor?.vendor_name).filter(Boolean)).size,
      sheets: displayRateSheets.filter((sheet) => sheet.status === "active").length,
      items: displayItems.length,
      coverage: modes.size ? `${modes.size}/3` : "0/3",
      quoteItemCount: quoteItems.length,
    };
  }, [displayItems, displayRateSheets, vendors]);

  const selectedItemAuditReady = Boolean(selectedSheet?.isFallback || (!itemQuery.isLoading && !itemQuery.isFetching));
  const rateHealthRows = useMemo(
    () => buildRateHealthRows(displayRateSheets, selectedSheet?.id, summary.quoteItemCount, selectedItemAuditReady),
    [displayRateSheets, selectedItemAuditReady, selectedSheet?.id, summary.quoteItemCount],
  );
  const rateHealthSummary = useMemo(() => ({
    p1: rateHealthRows.filter((row) => row.priority === "P1").length,
    p2: rateHealthRows.filter((row) => row.priority === "P2").length,
    expired: rateHealthRows.filter((row) => row.daysToExpiry !== null && row.daysToExpiry < 0).length,
    expiring: rateHealthRows.filter((row) => row.daysToExpiry !== null && row.daysToExpiry >= 0 && row.daysToExpiry <= 30).length,
  }), [rateHealthRows]);
  const rateApprovalRows = useMemo(
    () => buildRateVersionApprovalRows(displayRateSheets, selectedSheet?.id, summary.quoteItemCount),
    [displayRateSheets, selectedSheet?.id, summary.quoteItemCount],
  );
  const rateApprovalSummary = useMemo(() => ({
    p1: rateApprovalRows.filter((row) => row.readiness.priority === "P1").length,
    p2: rateApprovalRows.filter((row) => row.readiness.priority === "P2").length,
    drafts: rateApprovalRows.filter((row) => row.sheet.status === "draft").length,
    missingNextVersion: rateApprovalRows.filter((row) => row.readiness.risks.some((risk) => risk.includes("无下一版") || risk.includes("待续价"))).length,
  }), [rateApprovalRows]);
  const supplierRows = useMemo(() => buildVendorRows(vendors, displayRateSheets), [displayRateSheets, vendors]);
  const supplierSummary = useMemo(() => ({
    total: supplierRows.length,
    p1: supplierRows.filter((row) => row.priority === "P1").length,
    p2: supplierRows.filter((row) => row.priority === "P2").length,
    profileGaps: supplierRows.filter((row) => row.missingProfile.length).length,
    averageKpi: supplierRows.length
      ? Math.round(supplierRows.reduce((sum, row) => sum + scoreSupplierKpiProfile(row).score, 0) / supplierRows.length)
      : 0,
  }), [supplierRows]);
  const selectedSupplier = supplierRows.find((row) => row.id === selectedSupplierId) || supplierRows[0] || null;
  const selectedSupplierHealth = useMemo(() => scoreSupplierHealth(selectedSupplier), [selectedSupplier]);
  const selectedSupplierKpi = useMemo(() => scoreSupplierKpiProfile(selectedSupplier), [selectedSupplier]);
  const selectedSupplierGovernance = useMemo(() => scoreSupplierDetailGovernance(selectedSupplier), [selectedSupplier]);

  useEffect(() => {
    if (supplierRows.length && !supplierRows.some((row) => row.id === selectedSupplierId)) {
      setSelectedSupplierId(supplierRows[0].id);
    }
  }, [selectedSupplierId, supplierRows]);

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const updateDraft = (field, value) => {
    setItemDraft((prev) => ({ ...prev, [field]: value }));
  };

  const resetDraft = () => {
    setItemDraft({
      fee_code: "",
      fee_name: "",
      calc_method: "fixed",
      unit: "SHIPMENT",
      min_charge: "",
      unit_price: "",
      currency: selectedSheet?.currency || "USD",
      included_in_quote: true,
    });
  };

  const handleFocusRateSheet = (row) => {
    setFilters((prev) => ({ ...prev, status: "", keyword: "" }));
    setSelectedSheetId(row.sheet.id);
  };

  const handleCopyRateHealthPlan = async () => {
    const text = buildRateHealthPlan(rateHealthRows, selectedSheet, summary.quoteItemCount);

    try {
      await navigator.clipboard.writeText(text);
      setRateHealthPlanText("");
      onNotify?.({
        type: "success",
        title: "补价清单已复制",
        message: "可直接发给采购、运营或供应商负责人推进续价。",
      });
    } catch {
      setRateHealthPlanText(text);
      onNotify?.({
        type: "info",
        title: "请手动复制补价清单",
        message: "浏览器未授权剪贴板，已在页面展开完整文本。",
      });
    }
  };

  const handleCopyRateApprovalPlan = async () => {
    const text = buildRateVersionApprovalPlan(rateApprovalRows);

    try {
      await navigator.clipboard.writeText(text);
      setRateApprovalPlanText("");
      onNotify?.({
        type: "success",
        title: "费率审批清单已复制",
        message: "已按版本连续性、生效状态和自动报价可用性整理，可同步采购或主管复核。",
      });
    } catch {
      setRateApprovalPlanText(text);
      onNotify?.({
        type: "info",
        title: "请手动复制费率审批清单",
        message: "浏览器未授权剪贴板，已在页面展开完整文本。",
      });
    }
  };

  const handleFocusSupplier = (row) => {
    const sheet = row.activeSheets[0] || row.sheets[0];
    setSelectedSupplierId(row.id);
    if (sheet) {
      setFilters((prev) => ({ ...prev, status: "", keyword: "" }));
      setSelectedSheetId(sheet.id);
    }
  };

  const handleOpenSupplier = (row) => {
    setSelectedSupplierId(row.id);
    const sheet = row.activeSheets[0] || row.sheets[0];
    if (sheet) setSelectedSheetId(sheet.id);
  };

  const handleCopySupplierPlan = async () => {
    const text = buildSupplierActionPlan(supplierRows);

    try {
      await navigator.clipboard.writeText(text);
      setSupplierPlanText("");
      onNotify?.({
        type: "success",
        title: "供应商行动清单已复制",
        message: "已按续价、档案缺口和有效费率整理，可直接同步给采购或运营负责人。",
      });
    } catch {
      setSupplierPlanText(text);
      onNotify?.({
        type: "info",
        title: "请手动复制供应商清单",
        message: "浏览器未授权剪贴板，已在页面展开完整文本。",
      });
    }
  };

  const handleCopySupplierGovernancePlan = async () => {
    const text = buildSupplierDetailGovernancePlan(selectedSupplier, selectedSupplierGovernance);

    if (!text) {
      onNotify?.({
        type: "info",
        title: "暂无供应商详情可整理",
        message: "先选择供应商后，再复制附件、响应和对账付款治理清单。",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setSupplierGovernancePlanText("");
      onNotify?.({
        type: "success",
        title: "供应商详情治理清单已复制",
        message: "已按附件、响应时效、对账付款和费率证据整理，可同步采购、操作和财务。",
      });
    } catch {
      setSupplierGovernancePlanText(text);
      onNotify?.({
        type: "info",
        title: "请手动复制供应商详情清单",
        message: "浏览器未授权剪贴板，已在页面展开完整文本。",
      });
    }
  };

  const handleCreateItem = async (event) => {
    event.preventDefault();

    if (!selectedSheet || selectedSheet.isFallback) {
      onNotify?.({
        type: "info",
        title: "请先登录后维护真实费率",
        message: "当前展示的是示例成本表。登录拥有 admin/manager 权限的账号后，可直接新增费项并参与报价自动核算。",
      });
      return;
    }

    try {
      const payload = {
        fee_code: itemDraft.fee_code.trim().toUpperCase(),
        fee_name: itemDraft.fee_name.trim(),
        calc_method: itemDraft.calc_method,
        unit: itemDraft.unit.trim() || null,
        min_charge: Number(itemDraft.min_charge || 0),
        unit_price: Number(itemDraft.unit_price || 0),
        currency: itemDraft.currency || selectedSheet.currency || "USD",
        included_in_quote: itemDraft.included_in_quote,
        sort_order: displayItems.length * 10 + 10,
      };

      if (!payload.fee_code || !payload.fee_name || payload.unit_price < 0) {
        throw new Error("费项代码、名称和单价必填。");
      }

      const result = await createItemMutation.mutateAsync(payload);
      resetDraft();
      onNotify?.({
        type: "success",
        title: "费项已新增",
        message: `${result.fee_name || payload.fee_name} 已写入 ${selectedSheet.rate_sheet_no || selectedSheet.name}，勾选自动报价的费项会被报价中心读取。`,
      });
    } catch (error) {
      onNotify?.({
        type: "info",
        title: "费项未写入",
        message: error.message || "请确认当前账号拥有成本中心维护权限。",
      });
    }
  };

  const dataStateMessage = rateSheetQuery.isError
    ? "当前账号未登录或无权读取成本中心，页面先展示示例费率。"
    : liveRateSheets.length
      ? "已连接真实 Supabase 成本中心。"
      : "暂未读到真实费率，页面先展示可替换的示例费率。";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="供应商" value={summary.vendors} hint="承运商、拖车、报关、海外代理" />
        <SummaryCard label="有效费率表" value={summary.sheets} hint="按运输方式和货型匹配报价" />
        <SummaryCard label="当前费项" value={summary.items} hint={`${summary.quoteItemCount} 项参与自动报价`} />
        <SummaryCard label="自动核价覆盖" value={summary.coverage} hint="铁路、海运、空运基础覆盖" />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Supplier operations</div>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">供应商运营台</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              借鉴传统 SRM，把供应商当作可运营对象：联系人、账期、优势线路、费率有效期和补价动作集中管理。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
                <div className="text-xs font-semibold text-rose-700">P1 供应商</div>
                <div className="mt-1 text-2xl font-bold text-rose-950">{supplierSummary.p1}</div>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                <div className="text-xs font-semibold text-amber-700">P2 供应商</div>
                <div className="mt-1 text-2xl font-bold text-amber-950">{supplierSummary.p2}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-500">供应商总数</div>
                <div className="mt-1 text-xl font-bold text-slate-950">{supplierSummary.total}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-500">档案缺口</div>
                <div className="mt-1 text-xl font-bold text-slate-950">{supplierSummary.profileGaps}</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                <div className="text-xs font-semibold text-emerald-700">平均 KPI</div>
                <div className="mt-1 text-xl font-bold text-emerald-950">{supplierSummary.averageKpi || "-"}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopySupplierPlan}
              className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              复制供应商行动清单
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-3 py-3">供应商</th>
                  <th className="px-3 py-3">覆盖</th>
                  <th className="px-3 py-3">费率状态</th>
                  <th className="px-3 py-3">档案</th>
                  <th className="px-3 py-3">下一步</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierRows.slice(0, 8).map((row) => (
                  <tr key={row.id} className="align-top text-slate-700">
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                          row.priority === "P1"
                            ? "bg-rose-100 text-rose-700"
                            : row.priority === "P2"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {row.priority}
                        </span>
                        <span className="font-bold text-slate-950">{vendorDisplayName(row.vendor)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {vendorTypeLabels[row.vendor?.vendor_type] || row.vendor?.vendor_type || "供应商"} · {row.vendor?.country || "国家待补"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {row.vendor?.contact_name || "联系人待补"} {row.vendor?.email ? `· ${row.vendor.email}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="font-medium text-slate-900">
                        {row.modes.map((mode) => modeLabels[mode] || mode).join(" / ") || "待补"}
                      </div>
                      <div className="mt-1 max-w-xs text-xs text-slate-500">
                        {row.lanes.slice(0, 2).join("；") || "线路待补"}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-xs text-slate-500">有效 {row.activeSheets.length} · 过期 {row.expiredSheets.length} · 临期 {row.expiringSheets.length}</div>
                      <div className="mt-1 text-xs text-slate-400">账期：{row.vendor?.payment_term || "待补"} · 币种：{row.vendor?.currency || "待补"}</div>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        row.missingProfile.length ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {row.missingProfile.length ? `缺 ${row.missingProfile.join("、")}` : "完整"}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="max-w-sm text-xs leading-5 text-slate-500">{row.nextAction}</div>
                      <button
                        type="button"
                        onClick={() => handleFocusSupplier(row)}
                        className="mt-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        查看费率
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenSupplier(row)}
                        className="ml-2 mt-2 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        供应商详情
                      </button>
                    </td>
                  </tr>
                ))}
                {!supplierRows.length ? (
                  <tr>
                    <td colSpan="5" className="px-3 py-8 text-center text-sm text-slate-500">
                      暂无供应商数据。登录并配置供应商/费率表后，这里会显示供应商运营优先级。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {selectedSupplier ? (
          <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 xl:grid-cols-[300px_1fr]">
            <div className={`rounded-3xl border p-5 ${supplierHealthClass(selectedSupplierHealth.tone)}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">Supplier health</div>
              <div className="mt-3 flex items-end gap-3">
                <div className="text-5xl font-bold">{selectedSupplierHealth.score}</div>
                <div className="pb-2 text-sm font-bold">Grade {selectedSupplierHealth.grade}</div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
                <div className="h-full rounded-full bg-current" style={{ width: `${selectedSupplierHealth.score}%` }} />
              </div>
              <div className="mt-4 text-sm font-bold">{vendorDisplayName(selectedSupplier.vendor)}</div>
              <div className="mt-1 text-xs leading-5 opacity-80">
                {vendorTypeLabels[selectedSupplier.vendor?.vendor_type] || selectedSupplier.vendor?.vendor_type || "供应商"} · {selectedSupplier.vendor?.country || "国家待补"}
              </div>
              <div className="mt-4 space-y-1 text-xs leading-5">
                {selectedSupplierHealth.reasons.map((reason) => (
                  <div key={reason}>• {reason}</div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-bold text-slate-950">供应商档案</h4>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>联系人：{selectedSupplier.vendor?.contact_name || "待补"}</div>
                  <div>邮箱：{selectedSupplier.vendor?.email || "待补"}</div>
                  <div>电话：{selectedSupplier.vendor?.phone || "待补"}</div>
                  <div>账期：{selectedSupplier.vendor?.payment_term || "待补"}</div>
                  <div>币种：{selectedSupplier.vendor?.currency || "待补"}</div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-bold text-slate-950">服务覆盖</h4>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>运输方式：{selectedSupplier.modes.map((mode) => modeLabels[mode] || mode).join(" / ") || "待补"}</div>
                  <div>有效费率：{selectedSupplier.activeSheets.length}</div>
                  <div>过期费率：{selectedSupplier.expiredSheets.length}</div>
                  <div>30 天内到期：{selectedSupplier.expiringSheets.length}</div>
                  <div className="text-xs leading-5 text-slate-500">
                    {selectedSupplier.lanes.slice(0, 3).join("；") || "暂无线路覆盖"}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-bold text-slate-950">下一步动作</h4>
                <p className="mt-3 text-sm leading-6 text-slate-600">{selectedSupplier.nextAction}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleFocusSupplier(selectedSupplier)}
                    className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                  >
                    聚焦该供应商费率
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySupplierPlan}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    复制行动清单
                  </button>
                </div>
              </section>
            </div>

            <div className="xl:col-span-2">
              <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Supplier KPI</div>
                    <h4 className="mt-1 text-lg font-bold text-slate-950">供应商 KPI / 风险画像</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      结合费率新鲜度、档案完整度、服务覆盖、财务准备和异常压力，判断该供应商是否适合作为自动报价和履约首选。
                    </p>
                  </div>
                  <div className={`rounded-2xl border px-4 py-3 text-center ${supplierKpiClass(selectedSupplierKpi.priority)}`}>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{selectedSupplierKpi.priority}</div>
                    <div className="mt-1 text-3xl font-black">{selectedSupplierKpi.score}</div>
                    <div className="text-xs font-bold">Grade {selectedSupplierKpi.grade}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {selectedSupplierKpi.metrics.map((metric) => (
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
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">KPI 风险</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedSupplierKpi.risks.map((risk) => (
                        <span key={risk} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${supplierKpiClass(selectedSupplierKpi.priority)}`}>
                          {risk}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">采购 / 运营下一步</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{selectedSupplierKpi.nextAction}</div>
                  </div>
                </div>
              </div>

              <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Supplier Detail Governance</div>
                    <h4 className="mt-1 text-lg font-bold text-slate-950">供应商附件 / 响应 / 对账付款</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      把供应商详情页必须沉淀的合同、执照、银行资料、报价原件、响应时效和对账付款风险统一检查，避免未审供应商进入报价或履约。
                    </p>
                  </div>
                  <div className={`rounded-2xl border px-4 py-3 text-center ${supplierKpiClass(selectedSupplierGovernance.priority)}`}>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{selectedSupplierGovernance.priority}</div>
                    <div className="mt-1 text-3xl font-black">{selectedSupplierGovernance.score}</div>
                    <div className="text-xs font-bold">Grade {selectedSupplierGovernance.grade}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  {selectedSupplierGovernance.metrics.map((metric) => (
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

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr_auto] lg:items-start">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">详情风险</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedSupplierGovernance.risks.map((risk) => (
                        <span key={risk} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${supplierKpiClass(selectedSupplierGovernance.priority)}`}>
                          {risk}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">供应商详情下一步</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{selectedSupplierGovernance.nextAction}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySupplierGovernancePlan}
                    className="rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    复制详情治理清单
                  </button>
                </div>

                {supplierGovernancePlanText ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-sm font-bold text-slate-900">手动复制供应商详情治理清单</div>
                      <button type="button" onClick={() => setSupplierGovernancePlanText("")} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                        收起
                      </button>
                    </div>
                    <textarea
                      value={supplierGovernancePlanText}
                      onChange={(event) => setSupplierGovernancePlanText(event.target.value)}
                      rows="8"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                ) : null}
              </div>

              <div className="mb-2 text-sm font-bold text-slate-900">供应商费率表</div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {selectedSupplier.sheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => setSelectedSheetId(sheet.id)}
                    className={`rounded-2xl border p-3 text-left text-sm transition ${
                      selectedSheet?.id === sheet.id ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="font-bold text-slate-950">{sheet.rate_sheet_no || sheet.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {modeLabels[sheet.mode] || sheet.mode} · {shipmentLabels[sheet.shipment_type] || sheet.shipment_type}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {formatRateDate(sheet.effective_from)} 至 {formatRateDate(sheet.effective_to)}
                    </div>
                  </button>
                ))}
                {!selectedSupplier.sheets.length ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                    暂无费率表。先创建有效费率后，报价中心才能自动匹配。
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {supplierPlanText ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-900">手动复制供应商行动清单</div>
              <button type="button" onClick={() => setSupplierPlanText("")} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                收起
              </button>
            </div>
            <textarea
              value={supplierPlanText}
              onChange={(event) => setSupplierPlanText(event.target.value)}
              rows="9"
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
        <div className="grid gap-5 p-5 lg:grid-cols-[0.8fr_1.2fr] lg:p-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Rate readiness</div>
            <h3 className="mt-2 text-2xl font-bold">费率健康 / 补价指挥台</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              把过期、临期、缺供应商和自动报价缺口提前暴露，先处理会阻断报价的问题。
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-rose-500/15 p-3">
                <div className="text-xs text-rose-200">P1 今日处理</div>
                <div className="mt-1 text-2xl font-bold">{rateHealthSummary.p1}</div>
              </div>
              <div className="rounded-2xl bg-amber-400/15 p-3">
                <div className="text-xs text-amber-200">P2 本周处理</div>
                <div className="mt-1 text-2xl font-bold">{rateHealthSummary.p2}</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-slate-300">已过期</div>
                <div className="mt-1 text-xl font-bold">{rateHealthSummary.expired}</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <div className="text-xs text-slate-300">30 天内到期</div>
                <div className="mt-1 text-xl font-bold">{rateHealthSummary.expiring}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyRateHealthPlan}
              className="mt-4 w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-200"
            >
              复制费率补价清单
            </button>
          </div>

          <div className="space-y-2">
            {rateHealthRows.slice(0, 6).map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                        row.priority === "P1"
                          ? "bg-rose-400 text-rose-950"
                          : row.priority === "P2"
                            ? "bg-amber-300 text-amber-950"
                            : "bg-emerald-300 text-emerald-950"
                      }`}>
                        {row.priority}
                      </span>
                      <span className="truncate text-sm font-bold">{row.sheet.rate_sheet_no || row.sheet.name}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-200">{row.issue}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {row.sheet.origin_port || row.sheet.origin_country || "任意起运地"} → {row.sheet.destination_port || row.sheet.destination_country || "任意目的地"}
                      {" · "}{formatRateDate(row.sheet.effective_from)} 至 {formatRateDate(row.sheet.effective_to)}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-amber-200">建议：{row.action}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFocusRateSheet(row)}
                    className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                  >
                    聚焦费率
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {rateHealthPlanText ? (
          <div className="border-t border-white/10 bg-slate-900 p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-bold">手动复制行动清单</div>
              <button type="button" onClick={() => setRateHealthPlanText("")} className="text-xs text-slate-300 hover:text-white">
                收起
              </button>
            </div>
            <textarea
              value={rateHealthPlanText}
              onChange={(event) => setRateHealthPlanText(event.target.value)}
              rows="10"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 p-3 text-sm leading-6 text-slate-100 outline-none"
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Rate governance</div>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">费率版本 / 生效审批</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              借鉴成熟成本中心的版本控制：草稿、有效期、下一版本、供应商和自动报价费项一起检查，避免旧价或未审批价格进入客户报价。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
                <div className="text-xs font-semibold text-rose-700">P1 阻断</div>
                <div className="mt-1 text-2xl font-bold text-rose-950">{rateApprovalSummary.p1}</div>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                <div className="text-xs font-semibold text-amber-700">P2 待复核</div>
                <div className="mt-1 text-2xl font-bold text-amber-950">{rateApprovalSummary.p2}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-500">草稿费率</div>
                <div className="mt-1 text-xl font-bold text-slate-950">{rateApprovalSummary.drafts}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-500">缺下一版</div>
                <div className="mt-1 text-xl font-bold text-slate-950">{rateApprovalSummary.missingNextVersion}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyRateApprovalPlan}
              className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              复制费率审批清单
            </button>
          </div>

          <div className="grid gap-3">
            {rateApprovalRows.slice(0, 5).map((row) => (
              <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr_auto] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        row.readiness.priority === "P1"
                          ? "bg-rose-100 text-rose-700"
                          : row.readiness.priority === "P2"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {row.readiness.priority}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {row.readiness.approvalLabel}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-950">{row.sheet.rate_sheet_no || row.sheet.name}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {modeLabels[row.sheet.mode] || row.sheet.mode} · {shipmentLabels[row.sheet.shipment_type] || row.sheet.shipment_type} · {formatRateDate(row.sheet.effective_from)} 至 {formatRateDate(row.sheet.effective_to)}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      版本 {row.readiness.versionCount} · {row.readiness.hasNextVersion ? "已有下一版" : "下一版待补"}
                    </div>
                  </div>

                  <div>
                    <div className="grid gap-2 sm:grid-cols-4">
                      {row.readiness.metrics.map((metric) => (
                        <div key={metric.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[11px] font-semibold text-slate-500">{metric.label}</div>
                          <div className="mt-1 text-lg font-black text-slate-950">{metric.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.readiness.risks.map((risk) => (
                        <span key={risk} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {risk}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{row.readiness.nextAction}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFocusRateSheet({ sheet: row.sheet })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    聚焦费率
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        {rateApprovalPlanText ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-900">手动复制费率审批清单</div>
              <button type="button" onClick={() => setRateApprovalPlanText("")} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                收起
              </button>
            </div>
            <textarea
              value={rateApprovalPlanText}
              onChange={(event) => setRateApprovalPlanText(event.target.value)}
              rows="8"
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </div>
        ) : null}
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="运输方式">
              <select value={filters.mode} onChange={(event) => updateFilter("mode", event.target.value)} className={inputClass}>
                <option value="">全部</option>
                <option value="rail">铁路</option>
                <option value="sea">海运</option>
                <option value="air">空运</option>
              </select>
            </Field>
            <Field label="货型">
              <select value={filters.shipment_type} onChange={(event) => updateFilter("shipment_type", event.target.value)} className={inputClass}>
                <option value="">全部</option>
                <option value="FCL">整箱</option>
                <option value="LCL">拼箱</option>
                <option value="air_cargo">空运货</option>
              </select>
            </Field>
            <Field label="状态">
              <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={inputClass}>
                <option value="">全部</option>
                <option value="active">生效</option>
                <option value="draft">草稿</option>
                <option value="expired">过期</option>
                <option value="archived">归档</option>
              </select>
            </Field>
            <Field label="搜索">
              <input
                value={filters.keyword}
                onChange={(event) => updateFilter("keyword", event.target.value)}
                placeholder="线路/费率号/港口"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {dataStateMessage}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-950">费率表</h3>
              <p className="text-sm text-slate-500">报价按优先级匹配第一张有效表</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateQuotes?.()}
              className="rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
            >
              去报价验证
            </button>
          </div>

          <div className="space-y-2">
            {displayRateSheets.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => setSelectedSheetId(sheet.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedSheet?.id === sheet.id
                    ? "border-sky-300 bg-sky-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-950">{sheet.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{sheet.rate_sheet_no || "未编号"}</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    sheet.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {sheet.status || "draft"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <span>{modeLabels[sheet.mode] || sheet.mode} / {shipmentLabels[sheet.shipment_type] || sheet.shipment_type}</span>
                  <span className="text-right">{sheet.currency || "USD"}</span>
                  <span>{sheet.origin_port || "任意起运地"}</span>
                  <span className="text-right">{sheet.destination_port || "任意目的地"}</span>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  供应商：{sheet.vendor?.vendor_name || "未绑定"}，优先级 {sheet.priority || 100}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950">{selectedSheet?.name || "费项明细"}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedSheet?.origin_port || "任意起运地"} → {selectedSheet?.destination_port || "任意目的地"}，{selectedSheet?.vendor?.vendor_name || "未绑定供应商"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white">
                <div className="text-xs text-slate-300">自动报价费项</div>
                <div className="text-xl font-bold">{summary.quoteItemCount}</div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">费项</th>
                    <th className="px-3 py-3">计费</th>
                    <th className="px-3 py-3 text-right">最低</th>
                    <th className="px-3 py-3 text-right">单价</th>
                    <th className="px-3 py-3">报价</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayItems.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-950">{item.fee_name}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.fee_code}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <div>{calcMethodLabels[item.calc_method] || item.calc_method}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.unit || "-"}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-slate-700">
                        {Number(item.min_charge || 0).toLocaleString()} {item.currency || selectedSheet?.currency || "USD"}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-950">
                        {Number(item.unit_price || 0).toLocaleString()} {item.currency || selectedSheet?.currency || "USD"}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          item.included_in_quote ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {item.included_in_quote ? "自动带入" : "仅成本"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!displayItems.length && (
                    <tr>
                      <td colSpan="5" className="px-3 py-10 text-center text-sm text-slate-500">
                        当前费率表还没有费项。新增费项后，勾选自动报价即可进入报价核算。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <form onSubmit={handleCreateItem} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950">新增费项</h3>
                <p className="mt-1 text-sm text-slate-500">例如主运费、文件费、报关费、拖车费、海外派送费。</p>
              </div>
              <label className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                <input
                  type="checkbox"
                  checked={itemDraft.included_in_quote}
                  onChange={(event) => updateDraft("included_in_quote", event.target.checked)}
                />
                参与自动报价
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Field label="费项代码">
                <input value={itemDraft.fee_code} onChange={(event) => updateDraft("fee_code", event.target.value)} placeholder="DOC" className={inputClass} />
              </Field>
              <Field label="费项名称">
                <input value={itemDraft.fee_name} onChange={(event) => updateDraft("fee_name", event.target.value)} placeholder="文件费" className={inputClass} />
              </Field>
              <Field label="计费方式">
                <select value={itemDraft.calc_method} onChange={(event) => updateDraft("calc_method", event.target.value)} className={inputClass}>
                  {Object.entries(calcMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label="单位">
                <input value={itemDraft.unit} onChange={(event) => updateDraft("unit", event.target.value)} placeholder="SHIPMENT" className={inputClass} />
              </Field>
              <Field label="最低收费">
                <input type="number" min="0" step="0.01" value={itemDraft.min_charge} onChange={(event) => updateDraft("min_charge", event.target.value)} placeholder="0" className={inputClass} />
              </Field>
              <Field label="成本单价">
                <input type="number" min="0" step="0.01" value={itemDraft.unit_price} onChange={(event) => updateDraft("unit_price", event.target.value)} placeholder="88" className={inputClass} />
              </Field>
              <Field label="币种">
                <select value={itemDraft.currency} onChange={(event) => updateDraft("currency", event.target.value)} className={inputClass}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                </select>
              </Field>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={createItemMutation.isPending}
                  className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createItemMutation.isPending ? "保存中..." : "保存费项"}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
