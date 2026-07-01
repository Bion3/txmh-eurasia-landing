import React, { useState } from "react";
import EurasiaMap from "../components/EurasiaMap";
import { useCreateLead } from "../hooks/useLeads";
import { usePersistentFormDraft } from "../hooks/usePersistentFormDraft";
import { captureAcquisitionAttribution } from "../lib/acquisitionAttribution";
import { buildFallbackInquiry } from "../lib/publicInquiryFallback";

const pageCopy = {
  zh: {
    heroTitle: "中欧铁路拼箱物流",
    heroSubtitle: "15-20 天稳定时效 | 拼箱集运 | 清关派送一站式服务",
    primaryCta: "获取报价",
    secondaryCta: "联系我们",
    whyTitle: "为什么选择我们",
    strengths: [
      { title: "15-20 天", desc: "稳定的中欧铁路运输时效" },
      { title: "欧盟覆盖", desc: "德国、波兰、法国、意大利等主要市场" },
      { title: "拼箱专家", desc: "适合小批量、多频次货物，成本更可控" },
      { title: "门到门", desc: "集运、清关、末端派送整合交付" },
    ],
    servicesTitle: "核心服务",
    networkTitle: "服务网络",
    lanesTitle: "热门中欧铁路线路",
    lanesSubtitle: "覆盖中国主要集货城市到欧洲核心枢纽，适合拼箱、FBA、清关派送和门到门项目。",
    lanes: [
      { slug: "xian-chengdu-chongqing-to-duisburg", route: "西安 / 成都 / 重庆 → 杜伊斯堡", origin: "Xi'an / Chengdu / Chongqing", destination: "Duisburg", desc: "适合德国及周边派送，承接电商、汽配、样品和普货拼箱。" },
      { slug: "yiwu-shenzhen-guangzhou-to-warsaw", route: "义乌 / 深圳 / 广州 → 华沙 / 马拉舍维奇", origin: "Yiwu / Shenzhen / Guangzhou", destination: "Warsaw / Malaszewicze", desc: "适合波兰仓、东欧分拨和中转到德国、捷克、匈牙利。" },
      { slug: "zhengzhou-wuhan-to-hamburg-paris-milan", route: "郑州 / 武汉 → 汉堡 / 巴黎 / 米兰", origin: "Zhengzhou / Wuhan", destination: "Hamburg / Paris / Milan", desc: "适合西欧门到门、清关派送和多目的地拆分配送。" },
      { slug: "china-to-amazon-fba-germany-rail-ddp", route: "中国 → 德国 Amazon FBA / 欧洲仓", origin: "Shenzhen / Yiwu / Shanghai / Ningbo", destination: "Amazon FBA Germany / EU warehouses", cargo: "Amazon FBA rail DDP shipment to Germany", desc: "适合亚马逊补货、电商纸箱、季节性库存和需要铁路 + 清关 + 派送的一体化项目。" },
      { slug: "china-to-europe-ddp-rail-door-delivery", route: "中国 → 欧洲 DDP 门到门", origin: "China main consolidation hubs", destination: "Germany / Poland / France / Italy / EU doors", cargo: "China Europe rail DDP door delivery shipment", desc: "覆盖 DDP、DAP、门到门和清关派送询盘，适合希望一票到底交付的欧洲买家。" },
      { slug: "shenzhen-guangzhou-to-germany-door-delivery", route: "深圳 / 广州 → 德国门到门", origin: "Shenzhen / Guangzhou / South China", destination: "Germany door delivery", cargo: "South China rail shipment to Germany door", desc: "适合华南工厂货、电商货、电子产品和德国仓/FBA/商业地址派送。" },
      { slug: "china-to-poland-warehouse-rail-freight", route: "中国 → 波兰仓 / 华沙 / 马拉舍维奇", origin: "Yiwu / Shenzhen / Ningbo / Zhengzhou", destination: "Poland warehouses / Warsaw / Malaszewicze", cargo: "Rail shipment to Poland warehouse", desc: "承接波兰仓补货、东欧分拨、跨境平台货和德国周边市场中转配送。" },
      { slug: "china-to-kazakhstan-central-asia-rail-truck", route: "中国 → 哈萨克斯坦 / 中亚", origin: "Xi'an / Zhengzhou / Urumqi / Yiwu", destination: "Almaty / Astana / Tashkent / Bishkek", cargo: "Central Asia rail or truck shipment", desc: "覆盖中亚班列拼箱、整柜和卡车派送，适合工业件、电商箱货和项目补货。" },
      { slug: "china-to-russia-rail-truck-door-delivery", route: "中国 → 俄罗斯铁路 / 卡车", origin: "China main rail and truck hubs", destination: "Moscow / St. Petersburg / Russia regions", cargo: "China Russia rail or truck shipment", desc: "面向中俄陆路、班列和卡车门到门，重点确认口岸、清关资料和派送责任。" },
      { slug: "eurasia-continental-truck-freight", route: "欧亚大陆卡车门到门", origin: "China factories and consolidation warehouses", destination: "Central Asia / Russia / Europe door delivery", cargo: "Eurasia truck door-to-door shipment", desc: "适合需要灵活提货、直送门点或铁路备选方案的欧亚大陆卡车运输。" },
    ],
    processTitle: "服务流程",
    process: ["提交询价", "确认报价", "安排发运", "追踪签收"],
    faqTitle: "常见问题",
    faqSubtitle: "把客户最关心的时效、价格和服务边界提前说清楚，减少来回沟通。",
    faqs: [
      { question: "中欧铁路拼箱一般需要多久？", answer: "常规铁路干线时效约 15-25 天，具体取决于起运站、目的地、发车班期、清关和末端派送范围。" },
      { question: "可以做欧洲清关和门到门派送吗？", answer: "可以。我们可按 EXW、DAP、DDP 等场景组合集货、铁路、清关、仓库和末端派送服务。" },
      { question: "小货量也可以走铁路吗？", answer: "可以。拼箱 LCL 适合小批量、多频次货物；提交体积、重量、品名和路线后，我们会确认最低收费和可走方案。" },
      { question: "报价为什么需要人工确认？", answer: "铁路价格会受班期、口岸、清关、派送地址、货物属性和旺季舱位影响，公开页只做快速预估，正式报价由销售确认。" },
    ],
    finalTitle: "准备从中国发货到欧洲？",
    finalCta: "立即获取报价",
    routeCta: "查看线路页",
    quickTitle: "快速询价",
    quickSubtitle: "留下路线和联系方式，销售会优先回复。",
    name: "姓名",
    email: "邮箱",
    origin: "起运地",
    destination: "目的地",
    cargo: "货物/体积",
    company: "公司",
    phone: "电话 / WhatsApp",
    readiness: "发货时间",
    submit: "提交询盘",
    submitting: "提交中...",
    success: "询盘已提交，我们会尽快联系你。",
  },
  en: {
    heroTitle: "China-Europe Rail LCL Logistics",
    heroSubtitle: "15-20 day transit | LCL consolidation | Customs and final-mile delivery",
    primaryCta: "Get a Quote",
    secondaryCta: "Contact Us",
    whyTitle: "Why Choose Us",
    strengths: [
      { title: "15-20 Days", desc: "Stable China-Europe rail transit" },
      { title: "EU Coverage", desc: "Germany, Poland, France, Italy and more" },
      { title: "LCL Experts", desc: "Cost-efficient consolidation for smaller shipments" },
      { title: "Door-to-Door", desc: "Consolidation, customs and delivery in one flow" },
    ],
    servicesTitle: "Core Services",
    networkTitle: "Our Network",
    lanesTitle: "Popular China-Europe Rail Lanes",
    lanesSubtitle: "Rail consolidation from major China origins to core European hubs for LCL, FBA, customs clearance and door delivery.",
    lanes: [
      { slug: "xian-chengdu-chongqing-to-duisburg", route: "Xi'an / Chengdu / Chongqing → Duisburg", origin: "Xi'an / Chengdu / Chongqing", destination: "Duisburg", desc: "Good fit for Germany delivery, automotive parts, samples, e-commerce cargo and general LCL shipments." },
      { slug: "yiwu-shenzhen-guangzhou-to-warsaw", route: "Yiwu / Shenzhen / Guangzhou → Warsaw / Malaszewicze", origin: "Yiwu / Shenzhen / Guangzhou", destination: "Warsaw / Malaszewicze", desc: "Useful for Poland warehouses, Eastern Europe distribution and onward delivery to Germany, Czechia and Hungary." },
      { slug: "zhengzhou-wuhan-to-hamburg-paris-milan", route: "Zhengzhou / Wuhan → Hamburg / Paris / Milan", origin: "Zhengzhou / Wuhan", destination: "Hamburg / Paris / Milan", desc: "Supports Western Europe door delivery, customs coordination and multi-destination distribution." },
      { slug: "china-to-amazon-fba-germany-rail-ddp", route: "China → Amazon FBA Germany / EU Warehouses", origin: "Shenzhen / Yiwu / Shanghai / Ningbo", destination: "Amazon FBA Germany / EU warehouses", cargo: "Amazon FBA rail DDP shipment to Germany", desc: "Built for Amazon FBA replenishment, e-commerce cartons, seasonal stock and rail + customs + delivery workflows." },
      { slug: "china-to-europe-ddp-rail-door-delivery", route: "China → Europe DDP Door Delivery", origin: "China main consolidation hubs", destination: "Germany / Poland / France / Italy / EU doors", cargo: "China Europe rail DDP door delivery shipment", desc: "Captures DDP, DAP, door-to-door and customs delivery inquiries from EU buyers who want one coordinated delivery flow." },
      { slug: "shenzhen-guangzhou-to-germany-door-delivery", route: "Shenzhen / Guangzhou → Germany Door Delivery", origin: "Shenzhen / Guangzhou / South China", destination: "Germany door delivery", cargo: "South China rail shipment to Germany door", desc: "Useful for South China factory cargo, electronics, e-commerce goods and Germany warehouse/FBA/commercial delivery." },
      { slug: "china-to-poland-warehouse-rail-freight", route: "China → Poland Warehouse / Warsaw / Malaszewicze", origin: "Yiwu / Shenzhen / Ningbo / Zhengzhou", destination: "Poland warehouses / Warsaw / Malaszewicze", cargo: "Rail shipment to Poland warehouse", desc: "For Poland warehouse replenishment, Eastern Europe distribution, marketplace cargo and onward delivery around Germany-adjacent markets." },
      { slug: "china-to-kazakhstan-central-asia-rail-truck", route: "China → Kazakhstan / Central Asia", origin: "Xi'an / Zhengzhou / Urumqi / Yiwu", destination: "Almaty / Astana / Tashkent / Bishkek", cargo: "Central Asia rail or truck shipment", desc: "For Central Asia rail LCL, FCL and truck delivery covering industrial parts, e-commerce cartons and project replenishment." },
      { slug: "china-to-russia-rail-truck-door-delivery", route: "China → Russia Rail / Truck", origin: "China main rail and truck hubs", destination: "Moscow / St. Petersburg / Russia regions", cargo: "China Russia rail or truck shipment", desc: "Built for China-Russia land freight inquiries that need border, customs and door-delivery responsibility confirmed before booking." },
      { slug: "eurasia-continental-truck-freight", route: "Eurasia Continental Truck Door Delivery", origin: "China factories and consolidation warehouses", destination: "Central Asia / Russia / Europe door delivery", cargo: "Eurasia truck door-to-door shipment", desc: "A flexible truck option for direct door delivery, rail backup shipments and Eurasia continental corridor projects." },
    ],
    processTitle: "How It Works",
    process: ["Submit Inquiry", "Confirm Quote", "Ship Cargo", "Track & Receive"],
    faqTitle: "Frequently Asked Questions",
    faqSubtitle: "Clear answers on timing, pricing and service scope help customers decide faster.",
    faqs: [
      { question: "How long does China-Europe rail LCL usually take?", answer: "Typical rail transit is about 15-25 days, depending on origin, destination, departure week, customs and final-mile delivery scope." },
      { question: "Can you handle customs and door delivery in Europe?", answer: "Yes. We can combine consolidation, rail freight, customs coordination, warehouse handling and final-mile delivery for EXW, DAP or DDP scenarios." },
      { question: "Is rail suitable for small shipments?", answer: "Yes. Rail LCL is designed for smaller and frequent shipments. Share volume, weight, cargo name and route so we can confirm minimum charge and available options." },
      { question: "Why is the public quote only indicative?", answer: "Rail pricing depends on schedule, border routing, customs scope, delivery address, cargo type and peak-season capacity. Sales confirms the firm customer quote." },
    ],
    finalTitle: "Ready to ship from China to Europe?",
    finalCta: "Get Quote Now",
    routeCta: "View route guide",
    quickTitle: "Quick Inquiry",
    quickSubtitle: "Leave your route and contact details. Sales will reply first.",
    name: "Name",
    email: "Email",
    origin: "Origin",
    destination: "Destination",
    cargo: "Cargo / volume",
    company: "Company",
    phone: "Phone / WhatsApp",
    readiness: "Shipping window",
    submit: "Submit Inquiry",
    submitting: "Submitting...",
    success: "Inquiry submitted. Our team will contact you shortly.",
  },
};

const emptyQuickLead = {
  name: "",
  company: "",
  email: "",
  phone: "",
  origin: "",
  destination: "",
  cargo: "",
  readiness: "this_month",
};

function estimateQuickLeadScore(lead) {
  let score = 35;
  if (lead.email?.trim()) score += 10;
  if (lead.phone?.trim()) score += 12;
  if (lead.company?.trim()) score += 8;
  if (lead.origin?.trim() && lead.destination?.trim()) score += 18;
  if (lead.cargo?.trim()) score += 8;
  if (lead.readiness === "this_week" || lead.readiness === "this_month") score += 12;
  return Math.min(score, 95);
}

function quickIntentLevel(score) {
  if (score >= 78) return "hot";
  if (score >= 55) return "warm";
  return "cold";
}

function buildHomeQuickInquiryEmail(lead, locale) {
  const route = [lead.origin || "-", lead.destination || "-"].join(" -> ");
  return buildFallbackInquiry({
    subject: `Homepage inquiry - ${route}`,
    lines: [
      "Source: homepage quick inquiry",
      `Route: ${route}`,
      "",
      `Name: ${lead.name || "-"}`,
      `Company: ${lead.company || "-"}`,
      `Email: ${lead.email || "-"}`,
      `Phone / WhatsApp: ${lead.phone || "-"}`,
      `Cargo: ${lead.cargo || "-"}`,
      `Shipping window: ${lead.readiness || "-"}`,
      `Language: ${locale || "en"}`,
      "",
      "Please confirm available rail option, customs/delivery scope and firm quote.",
    ],
  });
}

function laneQuoteSearch(lane) {
  const params = new URLSearchParams({
    pol: lane.origin,
    pod: lane.destination,
    lane: lane.route,
    containerType: "LCL",
    serviceScope: "door_to_door",
    cargo: lane.cargo || "Rail LCL shipment",
  });
  return `?${params.toString()}`;
}

export default function HomePage({ locale = "en", text, changePage }) {
  const copy = pageCopy[locale] || pageCopy.en;
  const services = text.home.services || [];
  const createLeadMutation = useCreateLead();
  const [quickLead, setQuickLead, quickDraft] = usePersistentFormDraft("eurasiago:homepage-quick-inquiry", emptyQuickLead);
  const [quickMessage, setQuickMessage] = useState("");
  const [quickFallbackText, setQuickFallbackText] = useState("");

  const updateQuickLead = (field, value) => {
    setQuickMessage("");
    setQuickFallbackText("");
    setQuickLead((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopyQuickInquiry = async () => {
    const { text } = buildHomeQuickInquiryEmail(quickLead, locale);
    setQuickFallbackText(text);

    try {
      await navigator.clipboard.writeText(text);
      setQuickMessage(locale === "zh" ? "询盘内容已复制，可粘贴到邮件或 WhatsApp。" : "Inquiry details copied. You can paste them into email or WhatsApp.");
    } catch (error) {
      setQuickMessage(locale === "zh" ? "浏览器未授权剪贴板，已在下方显示询盘内容。" : "Browser clipboard is unavailable. Inquiry details are shown below.");
    }
  };

  const handleQuickLeadSubmit = async (event) => {
    event.preventDefault();

    if (!quickLead.name.trim() || (!quickLead.email.trim() && !quickLead.phone.trim()) || !quickLead.origin.trim() || !quickLead.destination.trim()) {
      setQuickMessage(locale === "zh" ? "请填写联系人、邮箱或电话、起运地和目的地。" : "Please fill in contact, email or phone, origin, and destination.");
      return;
    }

    const leadScore = estimateQuickLeadScore(quickLead);
    const attribution = captureAcquisitionAttribution({
      defaultSourceType: "homepage_quick_form",
      touchpoint: "home_hero_quick_form",
    });

    try {
      await createLeadMutation.mutateAsync({
        company_name: quickLead.company.trim() || quickLead.name.trim(),
        contact_name: quickLead.name.trim(),
        email: quickLead.email.trim() || null,
        phone: quickLead.phone.trim() || null,
        ...attribution.leadFields,
        website_visit: attribution.websiteVisit,
        intent_level: quickIntentLevel(leadScore),
        lead_score: leadScore,
        transport_mode_interest: "rail",
        shipment_type_interest: "LCL",
        origin: quickLead.origin.trim(),
        destination: quickLead.destination.trim(),
        cargo_desc: quickLead.cargo.trim() || null,
        message: [
          `Route: ${quickLead.origin.trim()} -> ${quickLead.destination.trim()}`,
          quickLead.cargo ? `Cargo: ${quickLead.cargo}` : "",
          quickLead.readiness ? `Shipping window: ${quickLead.readiness}` : "",
          quickLead.phone ? `Phone/WhatsApp: ${quickLead.phone}` : "",
          ...attribution.messageLines,
        ]
          .filter(Boolean)
          .join(" | "),
        status: "new",
      });
      quickDraft.clearDraft(emptyQuickLead);
      setQuickFallbackText("");
      setQuickMessage(copy.success);
    } catch (error) {
      const { text } = buildHomeQuickInquiryEmail(quickLead, locale);
      setQuickFallbackText(text);
      setQuickMessage(
        locale === "zh"
          ? "数据库表单暂时不可用，询盘内容已保留在下方，可直接邮件发送，避免丢单。"
          : "The database form is temporarily unavailable. Your inquiry details are preserved below so you can email them directly."
      );
    }
  };

  return (
    <div className="bg-white text-gray-900">
      <section
        className="relative min-h-[calc(100vh-65px)] flex flex-col justify-center items-center text-center px-5 py-16 bg-cover bg-center bg-gray-800 text-white"
        style={{ backgroundImage: "url('/hero-background.jpg')" }}
      >
        <div className="absolute inset-0 bg-slate-950/55" aria-hidden="true" />
        <div className="relative z-10 w-full max-w-4xl">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            {copy.heroTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/90 md:text-xl">
            {copy.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => changePage("quote")}
              className="w-full rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
            >
              {copy.primaryCta}
            </button>
            <button
              type="button"
              onClick={() => changePage("about")}
              className="w-full rounded-xl border border-white/80 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-white hover:text-gray-900 sm:w-auto"
            >
              {copy.secondaryCta}
            </button>
          </div>
        </div>
      </section>

      <section className="-mt-10 px-4 pb-10">
        <form
          onSubmit={handleQuickLeadSubmit}
          className="relative z-20 mx-auto grid max-w-6xl gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl md:grid-cols-4 md:items-end"
        >
          <div className="md:col-span-4">
            <div className="text-sm font-bold text-slate-950">{copy.quickTitle}</div>
            <div className="mt-1 text-xs text-slate-500">{copy.quickSubtitle}</div>
            {quickDraft.draftRestored ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                <span>{locale === "zh" ? "已恢复上次未提交的询盘草稿。" : "Restored your unsent inquiry draft."}</span>
                <button
                  type="button"
                  onClick={() => {
                    quickDraft.clearDraft(emptyQuickLead);
                    setQuickFallbackText("");
                    setQuickMessage(locale === "zh" ? "已清除本地草稿。" : "Saved draft cleared.");
                  }}
                  className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700"
                >
                  {locale === "zh" ? "清除草稿" : "Clear draft"}
                </button>
              </div>
            ) : null}
          </div>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-500">{copy.name}</span>
            <input
              value={quickLead.name}
              onChange={(event) => updateQuickLead("name", event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder={locale === "zh" ? "联系人" : "Contact"}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-500">{copy.company}</span>
            <input
              value={quickLead.company}
              onChange={(event) => updateQuickLead("company", event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder={locale === "zh" ? "公司名" : "Company name"}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-500">{copy.email}</span>
            <input
              type="email"
              value={quickLead.email}
              onChange={(event) => updateQuickLead("email", event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="name@company.com"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-500">{copy.phone}</span>
            <input
              value={quickLead.phone}
              onChange={(event) => updateQuickLead("phone", event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="+49 / +86"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-500">{copy.origin}</span>
            <input
              value={quickLead.origin}
              onChange={(event) => updateQuickLead("origin", event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder={locale === "zh" ? "上海 / 西安" : "Shanghai / Xi'an"}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-500">{copy.destination}</span>
            <input
              value={quickLead.destination}
              onChange={(event) => updateQuickLead("destination", event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder={locale === "zh" ? "汉堡 / 杜伊斯堡" : "Hamburg / Duisburg"}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-500">{copy.cargo}</span>
            <input
              value={quickLead.cargo}
              onChange={(event) => updateQuickLead("cargo", event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder={locale === "zh" ? "5 CBM 家具" : "5 CBM furniture"}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-500">{copy.readiness}</span>
            <select
              value={quickLead.readiness}
              onChange={(event) => updateQuickLead("readiness", event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              <option value="this_week">{locale === "zh" ? "本周" : "This week"}</option>
              <option value="this_month">{locale === "zh" ? "本月" : "This month"}</option>
              <option value="planning">{locale === "zh" ? "计划中" : "Planning"}</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={createLeadMutation.isPending}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createLeadMutation.isPending ? copy.submitting : copy.submit}
          </button>
          <div className="flex flex-wrap gap-2 md:col-span-4">
            <a
              href={buildHomeQuickInquiryEmail(quickLead, locale).mailto}
              className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
            >
              Email backup
            </a>
            <button
              type="button"
              onClick={handleCopyQuickInquiry}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-blue-300"
            >
              Copy inquiry details
            </button>
          </div>
          {quickMessage && (
            <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800 md:col-span-4">
              {quickMessage}
            </div>
          )}
          {quickFallbackText && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 md:col-span-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                Email fallback content
              </div>
              <textarea
                readOnly
                value={quickFallbackText}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-2 min-h-44 w-full rounded-2xl border border-amber-200 bg-white p-3 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          )}
        </form>
      </section>

      <section className="py-16 text-center md:py-20">
        <h2 className="mb-12 text-3xl font-semibold">{copy.whyTitle}</h2>
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-4">
          {copy.strengths.map((item) => (
            <div key={item.title} className="flex flex-col items-center">
              <h3 className="text-2xl font-bold text-blue-600">{item.title}</h3>
              <p className="mt-2 text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-3xl font-semibold">{copy.servicesTitle}</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {services.slice(0, 3).map((service) => (
              <div key={service.title} className="rounded-xl bg-white p-8 shadow-md transition-shadow hover:shadow-lg">
                <h3 className="mb-2 text-xl font-bold">{service.title}</h3>
                <p className="text-gray-600">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <h2 className="mb-12 text-center text-3xl font-semibold">{copy.networkTitle}</h2>
        <EurasiaMap text={text} />
      </section>

      <section id="rail-lanes" className="bg-slate-950 py-16 text-white md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Rail lanes</p>
              <h2 className="mt-3 text-3xl font-bold">{copy.lanesTitle}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{copy.lanesSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => changePage("quote")}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-blue-50"
            >
              {copy.primaryCta}
            </button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {copy.lanes.map((lane) => (
              <article key={lane.route} className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl shadow-black/10">
                <h3 className="text-xl font-bold leading-8">{lane.route}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{lane.desc}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => changePage("route", { path: `/routes/${lane.slug}` })}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-blue-50"
                  >
                    {copy.routeCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage("quote", { search: laneQuoteSearch(lane) })}
                    className="rounded-2xl border border-white/20 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    {copy.primaryCta}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16 text-center md:py-20">
        <h2 className="mb-12 text-3xl font-semibold">{copy.processTitle}</h2>
        <div className="mx-auto grid max-w-4xl gap-4 px-6 text-lg font-medium text-gray-700 md:grid-cols-4">
          {copy.process.map((step, index) => (
            <div key={step} className="p-4">
              {index + 1}. {step}
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-semibold">{copy.faqTitle}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-600">{copy.faqSubtitle}</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {copy.faqs.map((item) => (
              <article key={item.question} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-950">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-700 py-20 text-center text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-6 text-3xl font-bold">{copy.finalTitle}</h2>
          <button
            type="button"
            onClick={() => changePage("quote")}
            className="rounded-xl bg-white px-10 py-4 text-lg font-bold text-blue-700 transition-colors hover:bg-gray-200"
          >
            {copy.finalCta}
          </button>
        </div>
      </section>
    </div>
  );
}
