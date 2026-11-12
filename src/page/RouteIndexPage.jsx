import { useEffect, useState } from "react";
import { routeLandingPages, routeQuoteSearch } from "../data/routeLandingPages";
import { useCreateLead } from "../hooks/useLeads";
import { usePersistentFormDraft } from "../hooks/usePersistentFormDraft";
import { captureAcquisitionAttribution } from "../lib/acquisitionAttribution";
import { buildFallbackInquiry } from "../lib/publicInquiryFallback";

const siteUrl = "https://www.eurasiago.com";
const routeDirectoryCopy = {
  zh: {
    eyebrow: "中欧铁路运输线路",
    heading: "中欧班列线路查询",
    intro: "按目的地浏览中欧班列及国际铁路运输线路，支持拼箱、整柜和延伸配送询价。",
    quote: "获取报价",
    home: "查看首页线路",
    formTitle: "不确定选择哪条线路？",
    formDesc: "填写起运地、目的地及货物信息，我们将协助确认合适线路和报价要求。",
    name: "姓名 *",
    company: "公司",
    email: "邮箱",
    phone: "电话 / WhatsApp",
    origin: "起运地 *",
    destination: "目的地 *",
    service: "服务需求",
    window: "预计发货时间",
    cargo: "货物信息 / 备注",
    submit: "提交线路咨询",
    sending: "正在提交…",
    backup: "邮件备用咨询",
    copy: "复制咨询信息",
    view: "查看线路详情",
    routeQuote: "询价",
    lane: "运输线路",
    to: "至",
    choose: "如何选择线路",
    chooseTitle: "按目的地选择合适线路",
    chooseDesc: "先选择目的地，再结合起运站、货量和交付地址确认拼箱或整柜方案。",
    tips: ["德国：杜伊斯堡及后续配送","Germany: Duisburg and onward delivery"],
  },
  en: {
    eyebrow: "China–Europe rail routes",
    heading: "China–Europe rail freight routes",
    intro: "Browse rail freight routes by destination. Choose a corridor for LCL or FCL service details and request a quote.",
    quote: "Request a quote",
    home: "See homepage routes",
    formTitle: "Not sure which route to choose?",
    formDesc: "Tell us your origin, destination and cargo. We can recommend a suitable route and quote requirements.",
    name: "Name *",
    company: "Company",
    email: "Email",
    phone: "Phone / WhatsApp",
    origin: "Origin *",
    destination: "Destination *",
    service: "Service need",
    window: "Shipping window",
    cargo: "Cargo / notes",
    submit: "Request route advice",
    sending: "Submitting...",
    backup: "Email backup",
    copy: "Copy details",
    view: "View route",
    routeQuote: "Get quote",
    lane: "Lane",
    to: "to",
    choose: "How to choose",
    chooseTitle: "Choose by destination",
    chooseDesc: "Start with the destination, then confirm LCL or FCL options based on origin, cargo volume and delivery address.",
    tips: ["波兰：马拉舍维奇、华沙及东欧","Poland: Małaszewicze, Warsaw and Eastern Europe"],
  },
};
// Keep legacy URLs accessible while presenting one clear entry per destination/service.
const visibleRoutes = routeLandingPages.filter(page => ![
  "china-to-amazon-fba-germany-rail-ddp",
  "china-to-europe-ddp-rail-door-delivery",
  "shenzhen-guangzhou-to-germany-door-delivery",
  "china-to-poland-warehouse-rail-freight",
].includes(page.slug));

const emptyRecommendationForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  origin: "",
  destination: "",
  cargo: "",
  serviceNeed: "not_sure",
  readyDate: "this_month",
};

function estimateRecommendationScore(values) {
  let score = 46;
  if (values.email.trim()) score += 8;
  if (values.phone.trim()) score += 12;
  if (values.company.trim()) score += 8;
  if (values.origin.trim() && values.destination.trim()) score += 16;
  if (values.cargo.trim()) score += 8;
  if (values.serviceNeed !== "not_sure") score += 6;
  if (values.readyDate === "this_week" || values.readyDate === "this_month") score += 10;
  return Math.min(score, 98);
}

function recommendationIntentLevel(score) {
  if (score >= 80) return "hot";
  if (score >= 58) return "warm";
  return "cold";
}

function serviceNeedLabel(value) {
  const labels = {
    not_sure: "Need route recommendation",
    germany_door: "Germany door delivery",
    amazon_fba: "Warehouse delivery",
    ddp: "Customs and door delivery",
    poland_warehouse: "Poland warehouse / Eastern Europe",
  };
  return labels[value] || value || "Need route recommendation";
}

function buildRecommendationEmail(values) {
  const route = [values.origin || "-", values.destination || "-"].join(" -> ");
  return buildFallbackInquiry({
    subject: `Route recommendation request - ${route}`,
    lines: [
      "Source: /routes route recommendation form",
      `Route: ${route}`,
      `Service need: ${serviceNeedLabel(values.serviceNeed)}`,
      "",
      `Name: ${values.name || "-"}`,
      `Company: ${values.company || "-"}`,
      `Email: ${values.email || "-"}`,
      `Phone / WhatsApp: ${values.phone || "-"}`,
      `Cargo: ${values.cargo || "-"}`,
      `Shipping window: ${values.readyDate || "-"}`,
      "",
      "Please recommend the best China-Europe rail route or service page and confirm the firm quote requirements.",
    ],
  });
}

function routeIndexStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${siteUrl}/routes#route-list`,
    name: "China-Europe rail freight routes",
    description:
      "China-Europe rail freight routes to Germany, Poland, Russia and Central Asia.",
    itemListElement: visibleRoutes.map((page, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: page.title,
      url: `${siteUrl}/routes/${page.slug}`,
    })),
  };
}

export default function RouteIndexPage({ locale = "en" }) {
  const c = routeDirectoryCopy[locale === "zh" ? "zh" : "en"];
  const createLeadMutation = useCreateLead();
  const [recommendationForm, setRecommendationForm, recommendationDraft] = usePersistentFormDraft(
    "eurasiago:route-index-recommendation",
    emptyRecommendationForm
  );
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [fallbackRecommendationText, setFallbackRecommendationText] = useState("");

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const script = document.createElement("script");
    script.id = "route-index-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(routeIndexStructuredData());

    document.getElementById(script.id)?.remove();
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  const updateRecommendationForm = (field, value) => {
    setRecommendationMessage("");
    setFallbackRecommendationText("");
    setRecommendationForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopyRecommendationInquiry = async () => {
    const { text } = buildRecommendationEmail(recommendationForm);
    setFallbackRecommendationText(text);

    try {
      await navigator.clipboard.writeText(text);
      setRecommendationMessage("Route recommendation details copied. You can paste them into email or WhatsApp.");
    } catch (error) {
      setRecommendationMessage("Browser clipboard is unavailable. Route recommendation details are shown below.");
    }
  };

  const handleRecommendationSubmit = async (event) => {
    event.preventDefault();

    if (
      !recommendationForm.name.trim() ||
      (!recommendationForm.email.trim() && !recommendationForm.phone.trim()) ||
      !recommendationForm.origin.trim() ||
      !recommendationForm.destination.trim()
    ) {
      setRecommendationMessage("Please add name, email or WhatsApp, origin and destination so sales can recommend a route.");
      return;
    }

    const leadScore = estimateRecommendationScore(recommendationForm);
    const attribution = captureAcquisitionAttribution({
      defaultSourceType: "google_seo",
      touchpoint: "route_index_recommendation_form",
    });

    try {
      await createLeadMutation.mutateAsync({
        company_name: recommendationForm.company.trim() || recommendationForm.name.trim(),
        contact_name: recommendationForm.name.trim(),
        email: recommendationForm.email.trim() || null,
        phone: recommendationForm.phone.trim() || null,
        origin: recommendationForm.origin.trim(),
        destination: recommendationForm.destination.trim(),
        cargo_desc: recommendationForm.cargo.trim() || serviceNeedLabel(recommendationForm.serviceNeed),
        ...attribution.leadFields,
        website_visit: attribution.websiteVisit,
        intent_level: recommendationIntentLevel(leadScore),
        lead_score: leadScore,
        transport_mode_interest: "rail",
        shipment_type_interest: "LCL",
        message: [
          "Route recommendation requested from /routes",
          `Service need: ${serviceNeedLabel(recommendationForm.serviceNeed)}`,
          `Shipping window: ${recommendationForm.readyDate}`,
          recommendationForm.phone ? `Phone/WhatsApp: ${recommendationForm.phone}` : "",
          ...attribution.messageLines,
        ]
          .filter(Boolean)
          .join(" | "),
        status: "new",
      });
      recommendationDraft.clearDraft(emptyRecommendationForm);
      setFallbackRecommendationText("");
      setRecommendationMessage("Route recommendation request received. Sales can now recommend the best route with your context.");
    } catch (error) {
      const { text } = buildRecommendationEmail(recommendationForm);
      setFallbackRecommendationText(text);
      setRecommendationMessage("The database form is temporarily unavailable. Your request is preserved below so you can email it directly.");
    }
  };

  return (
    <main className="bg-white text-slate-900">
      <section className="relative overflow-hidden bg-slate-950 px-6 py-16 text-white md:py-24">
        <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-300">
            China-Europe rail route directory
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
            China–Europe rail freight routes
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Browse rail freight routes by destination. Choose a corridor for LCL or FCL service details and request a quote.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/quote"
              className="rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Request a firm quote
            </a>
            <a
              href="/#rail-lanes"
              className="rounded-2xl border border-white/20 px-6 py-4 text-sm font-bold text-white transition hover:bg-white/10"
            >
              See homepage lanes
            </a>
          </div>

          <form onSubmit={handleRecommendationSubmit} className="mt-10 rounded-[2rem] border border-white/10 bg-white p-5 text-slate-950 shadow-2xl md:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black">{c.formTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Tell us your origin, destination and cargo. Sales can recommend the best route page, service scope and quote requirements.
                </p>
                {recommendationDraft.draftRestored ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    <span>Restored your unsent route recommendation draft.</span>
                    <button
                      type="button"
                      onClick={() => {
                        recommendationDraft.clearDraft(emptyRecommendationForm);
                        setFallbackRecommendationText("");
                        setRecommendationMessage("Saved route recommendation draft cleared.");
                      }}
                      className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700"
                    >
                      Clear draft
                    </button>
                  </div>
                ) : null}
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                Score {estimateRecommendationScore(recommendationForm)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">{c.name}</span>
                <input
                  value={recommendationForm.name}
                  onChange={(event) => updateRecommendationForm("name", event.target.value)}
                  className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Your name"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">{c.company}</span>
                <input
                  value={recommendationForm.company}
                  onChange={(event) => updateRecommendationForm("company", event.target.value)}
                  className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Company"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">{c.email}</span>
                <input
                  type="email"
                  value={recommendationForm.email}
                  onChange={(event) => updateRecommendationForm("email", event.target.value)}
                  className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  placeholder="name@company.com"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">{c.phone}</span>
                <input
                  value={recommendationForm.phone}
                  onChange={(event) => updateRecommendationForm("phone", event.target.value)}
                  className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  placeholder="+49 / +86"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">{c.origin}</span>
                <input
                  value={recommendationForm.origin}
                  onChange={(event) => updateRecommendationForm("origin", event.target.value)}
                  className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Shenzhen / Yiwu"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">{c.destination}</span>
                <input
                  value={recommendationForm.destination}
                  onChange={(event) => updateRecommendationForm("destination", event.target.value)}
                  className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Germany / Poland"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">{c.service}</span>
                <select
                  value={recommendationForm.serviceNeed}
                  onChange={(event) => updateRecommendationForm("serviceNeed", event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="not_sure">Need route recommendation</option>
                  <option value="germany_door">Germany door delivery</option>
                  <option value="amazon_fba">Warehouse delivery</option>
                  <option value="ddp">Customs and door delivery</option>
                  <option value="poland_warehouse">Poland warehouse / Eastern Europe</option>
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">{c.window}</span>
                <select
                  value={recommendationForm.readyDate}
                  onChange={(event) => updateRecommendationForm("readyDate", event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="this_week">This week</option>
                  <option value="this_month">This month</option>
                  <option value="next_month">Next month</option>
                  <option value="planning">Planning / comparing</option>
                </select>
              </label>
              <label className="grid gap-1.5 md:col-span-4">
                <span className="text-xs font-bold text-slate-500">{c.cargo}</span>
                <input
                  value={recommendationForm.cargo}
                  onChange={(event) => updateRecommendationForm("cargo", event.target.value)}
                  className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  placeholder="5 CBM, 1200 kg, Germany warehouse..."
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={createLeadMutation.isPending}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createLeadMutation.isPending ? c.sending : c.submit}
              </button>
              <a
                href={buildRecommendationEmail(recommendationForm).mailto}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-300"
              >
                Email backup
              </a>
              <button
                type="button"
                onClick={handleCopyRecommendationInquiry}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-emerald-300"
              >
                Copy details
              </button>
            </div>

            {recommendationMessage ? (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                {recommendationMessage}
              </div>
            ) : null}
            {fallbackRecommendationText ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                  Email fallback content
                </div>
                <textarea
                  readOnly
                  value={fallbackRecommendationText}
                  onFocus={(event) => event.currentTarget.select()}
                  className="mt-2 min-h-44 w-full rounded-2xl border border-amber-200 bg-white p-3 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
          {visibleRoutes.map((page) => (
            <article key={page.slug} className="flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                {page.transit}
              </div>
              <h2 className="mt-3 text-xl font-black leading-7 text-slate-950">{page.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{page.description}</p>

              <div className="mt-5 rounded-3xl bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{c.lane}</div>
                <div className="mt-2 text-sm font-bold text-slate-900">{page.origin}</div>
                <div className="my-1 text-xs font-bold text-emerald-600">{c.to}</div>
                <div className="text-sm font-bold text-slate-900">{page.destination}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {page.cargoFit.slice(0, 3).map((cargo) => (
                  <span key={cargo} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {cargo}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <a
                  href={`/routes/${page.slug}`}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  View route page
                </a>
                <a
                  href={`/quote${routeQuoteSearch(page)}`}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-300"
                >
                  Quote this route
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-sky-600">{c.choose}</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              Start with destination and service scope
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              If you know the final delivery address, choose the closest route or service page. For warehouse or door delivery, provide the final address when requesting a quote.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {c.tips.map((item) => (
              <div key={item} className="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-bold leading-6 text-slate-700 shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
