const fixedToday = "2026-06-30";

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

  return {
    primaryId: first.id,
    candidateId: second.id,
    primaryName: first.name,
    candidateName: second.name,
    score,
    priority: score >= 75 ? "P1" : score >= 55 ? "P2" : "P3",
    reasons: signals.map(([label]) => label),
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

  return candidates.sort((first, second) => second.score - first.score || first.primaryName.localeCompare(second.primaryName));
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
      { label: "合同账期", value: contractScore },
      { label: "合并审批", value: mergeScore },
      { label: "等级规则", value: tierScore },
      { label: "财务主体", value: financeScore },
    ],
    risks: risks.length ? risks : ["客户商业治理稳定"],
    nextAction,
  };
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
  return Math.max(Math.floor((new Date(fixedToday).getTime() - timestamp) / 86400000), 0);
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

function timelineDate(row) {
  return row?.created_at || row?.updated_at || row?.quote_date || row?.order_date || row?.next_follow_up_at || "";
}

function buildCustomerTimeline(customer) {
  if (!customer) return [];

  const activities = (customer.activities || []).map((item) => ({
    id: `activity-${item.id || item.created_at || item.subject}`,
    type: "跟进",
    date: timelineDate(item),
    title: item.subject || item.activity_type || "客户跟进",
  }));

  const quotes = (customer.quotes || []).map((item) => ({
    id: `quote-${item.id || item.quote_no || item.created_at}`,
    type: "报价",
    date: timelineDate(item),
    title: item.quote_no || item.route || "报价记录",
  }));

  const orders = (customer.orders || []).map((item) => ({
    id: `order-${item.id || item.order_no || item.created_at}`,
    type: "订单",
    date: timelineDate(item),
    title: item.order_no || item.route || "订单记录",
  }));

  return [...activities, ...quotes, ...orders]
    .sort((first, second) => (parseCustomerDate(second.date) || 0) - (parseCustomerDate(first.date) || 0))
    .slice(0, 6);
}

function scoreOverviewCustomer(customer) {
  let score = 100;
  const reasons = [];
  const missing = customerMissingFields(customer);
  const ageDays = customerAgeDays(customer);

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

const scenarios = [
  {
    name: "active customer with master data and order stays grade A",
    customer: {
      status: "active",
      contact_name: "Anna",
      email: "anna@example.com",
      country: "Germany",
      city: "Hamburg",
      industry: "Retail",
      address: "Hamburg Port",
      tax_no: "DE123",
      last_activity_at: "2026-06-29",
      quotes: [{ id: "q1" }],
      orders: [{ id: "o1" }],
      activities: [{ id: "a1", created_at: "2026-06-29" }],
    },
    assert: (result) => result.score === 100 && result.grade === "A",
  },
  {
    name: "prospect with quote but contract gaps becomes grade B",
    customer: {
      status: "prospect",
      contact_name: "Mila",
      email: "mila@example.com",
      country: "Poland",
      city: "Warsaw",
      industry: "E-commerce",
      last_activity_at: "2026-06-28",
      quotes: [{ id: "q1" }],
      orders: [],
      activities: [{ id: "a1", created_at: "2026-06-28" }],
    },
    assert: (result) => result.score === 75 && result.grade === "B" && result.reasons.some((reason) => reason.includes("合同地址")),
  },
  {
    name: "inactive stale customer with missing profile falls to grade D",
    customer: {
      status: "inactive",
      country: "France",
      created_at: "2026-04-01",
      quotes: [],
      orders: [],
      activities: [],
    },
    assert: (result) => result.score === 0 && result.grade === "D" && result.reasons.some((reason) => reason.includes("主数据缺口")),
  },
  {
    name: "timeline sorts orders quotes and activities by newest date",
    customer: {
      activities: [{ id: "a1", subject: "Follow up", created_at: "2026-06-20" }],
      quotes: [{ id: "q1", quote_no: "Q1", created_at: "2026-06-25" }],
      orders: [{ id: "o1", order_no: "O1", created_at: "2026-06-28" }],
    },
    assertTimeline: (timeline) => timeline.map((item) => item.type).join(">") === "订单>报价>跟进",
  },
  {
    name: "overview risk summary promotes lowest health customer",
    assertOverview: () => {
      const summary = buildCustomerRiskSummary([
        {
          company_name: "Healthy GmbH",
          status: "active",
          contact_name: "Anna",
          email: "a@example.com",
          country: "Germany",
          industry: "Retail",
          tax_no: "DE123",
          updated_at: "2026-06-29",
        },
        {
          company_name: "Dormant SAS",
          status: "inactive",
          country: "France",
          created_at: "2026-04-01",
        },
        {
          company_name: "Watch Sp z o.o.",
          status: "prospect",
          contact_name: "Mila",
          email: "m@example.com",
          country: "Poland",
          industry: "E-commerce",
          updated_at: "2026-06-10",
        },
      ]);

      return summary.highRiskCount === 1 &&
        summary.watchCount === 1 &&
        summary.topRiskName === "Dormant SAS" &&
        summary.lowestScore === 24 &&
        summary.topRiskReason.includes("沉睡客户");
    },
  },
  {
    name: "duplicate candidates find shared email and normalized company as P1",
    assertDuplicate: () => {
      const rows = buildCustomerDuplicateCandidates([
        {
          id: "c1",
          company_name: "Acme Logistics GmbH",
          email: "ops@acme.test",
          country: "Germany",
        },
        {
          id: "c2",
          company_name: "ACME Logistics",
          contacts: [{ email: "ops@acme.test" }],
          country: "Germany",
        },
      ]);

      return rows.length === 1 &&
        rows[0].score === 98 &&
        rows[0].priority === "P1" &&
        rows[0].reasons.includes("同邮箱") &&
        rows[0].reasons.includes("公司名一致");
    },
  },
  {
    name: "duplicate candidates rank P1 before P2",
    assertDuplicate: () => {
      const rows = buildCustomerDuplicateCandidates([
        { id: "c1", company_name: "Acme Logistics GmbH", email: "ops@acme.test", country: "Germany" },
        { id: "c2", company_name: "ACME Logistics", email: "ops@acme.test", country: "Germany" },
        { id: "c3", company_name: "Nordic Retail BV", country: "Netherlands", city: "Rotterdam" },
        { id: "c4", company_name: "Nordic Retail", country: "Netherlands", city: "Rotterdam" },
      ]);

      return rows.length === 2 &&
        rows[0].priority === "P1" &&
        rows[0].score === 98 &&
        rows[1].priority === "P2" &&
        rows[1].score === 59;
    },
  },
  {
    name: "duplicate candidates ignore unrelated customers",
    assertDuplicate: () => {
      const rows = buildCustomerDuplicateCandidates([
        { id: "c1", company_name: "Acme Logistics GmbH", email: "ops@acme.test", country: "Germany" },
        { id: "c2", company_name: "Baltic Retail", email: "buyer@baltic.test", country: "Poland" },
      ]);

      return rows.length === 0;
    },
  },
];

const commercialGovernanceScenarios = [
  {
    name: "customer commercial governance clean customer stays P3",
    assertCommercial: () => {
      const customer = {
        id: "c-clean",
        company_name: "Healthy GmbH",
        address: "Hamburg Port",
        tax_no: "DE123",
        payment_term: "30 days",
        contract_no: "CTR-001",
        customer_level: "A",
        markup_percent: 18,
        contact_name: "Anna",
        email: "anna@example.com",
        country: "Germany",
        currency: "EUR",
      };
      const result = scoreCustomerCommercialGovernance(customer, []);

      return result.score === 100 &&
        result.grade === "A" &&
        result.priority === "P3" &&
        result.risks.includes("客户商业治理稳定");
    },
  },
  {
    name: "customer commercial governance catches duplicate without approval",
    assertCommercial: () => {
      const customers = [
        {
          id: "c1",
          company_name: "Acme Logistics GmbH",
          email: "ops@acme.test",
          country: "Germany",
          industry: "Logistics",
          customer_type: "direct",
        },
        {
          id: "c2",
          company_name: "ACME Logistics",
          contacts: [{ email: "ops@acme.test" }],
          country: "Germany",
        },
      ];
      const duplicates = buildCustomerDuplicateCandidates(customers);
      const result = scoreCustomerCommercialGovernance(customers[0], duplicates);

      return result.score === 38 &&
        result.grade === "D" &&
        result.priority === "P1" &&
        result.risks.includes("1 组疑似重复未进入合并审批") &&
        result.risks.includes("客户等级/加价规则未配置");
    },
  },
  {
    name: "customer commercial governance merge approval becomes P2",
    assertCommercial: () => {
      const customer = {
        id: "c1",
        company_name: "Acme Logistics GmbH",
        email: "ops@acme.test",
        country: "Germany",
        industry: "Logistics",
        customer_type: "direct",
        merge_approval_status: "reviewing",
        address: "Berlin",
        tax_no: "DE999",
        payment_term: "15 days",
        contact_name: "Ops",
        currency: "EUR",
      };
      const result = scoreCustomerCommercialGovernance(customer, [{ primaryId: "c1", candidateId: "c2", priority: "P1" }]);

      return result.score === 77 &&
        result.grade === "B" &&
        result.priority === "P2" &&
        !result.risks.some((risk) => risk.includes("疑似重复未进入合并审批")) &&
        result.risks.includes("客户等级/加价规则未配置");
    },
  },
];

let failures = 0;

for (const scenario of scenarios) {
  if (scenario.assert) {
    const result = scoreCustomerHealth(scenario.customer);
    if (scenario.assert(result)) {
      console.log(`PASS  ${scenario.name} -> score ${result.score}, grade ${result.grade}`);
    } else {
      failures += 1;
      console.error(`FAIL  ${scenario.name} -> ${JSON.stringify(result)}`);
    }
  } else {
    if (scenario.assertDuplicate) {
      if (scenario.assertDuplicate()) {
        console.log(`PASS  ${scenario.name}`);
      } else {
        failures += 1;
        console.error(`FAIL  ${scenario.name}`);
      }
      continue;
    }

    if (scenario.assertOverview) {
      if (scenario.assertOverview()) {
        console.log(`PASS  ${scenario.name}`);
      } else {
        failures += 1;
        console.error(`FAIL  ${scenario.name}`);
      }
      continue;
    }

    const timeline = buildCustomerTimeline(scenario.customer);
    if (scenario.assertTimeline(timeline)) {
      console.log(`PASS  ${scenario.name} -> ${timeline.map((item) => item.type).join(">")}`);
    } else {
      failures += 1;
      console.error(`FAIL  ${scenario.name} -> ${JSON.stringify(timeline)}`);
    }
  }
}

for (const scenario of commercialGovernanceScenarios) {
  if (scenario.assertCommercial()) {
    console.log(`PASS  ${scenario.name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${scenario.name}`);
  }
}

if (failures > 0) {
  console.error(`\nCustomer health check: ${failures} failed, ${scenarios.length + commercialGovernanceScenarios.length} total.`);
  process.exit(1);
}

console.log(`\nCustomer health check: 0 failed, ${scenarios.length + commercialGovernanceScenarios.length} total.`);
