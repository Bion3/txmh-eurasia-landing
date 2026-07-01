import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { getRouteLandingPage, routeQuoteSearch } from "../data/routeLandingPages";
import { useCreateLead } from "../hooks/useLeads";
import { usePersistentFormDraft } from "../hooks/usePersistentFormDraft";
import { captureAcquisitionAttribution } from "../lib/acquisitionAttribution";
import { buildFallbackInquiry } from "../lib/publicInquiryFallback";

const copyByLocale = {
  en: {
    badge: "30-second inquiry",
    helper: "Stay on this page. Sales receives the route and source.",
    open: "Quick inquiry",
    close: "Close",
    fullQuote: "Detailed quote",
    email: "Email sales",
    copy: "Copy brief",
    title: "Ask sales without leaving this page",
    name: "Name / company",
    contact: "Email or WhatsApp",
    origin: "Origin",
    destination: "Destination",
    cargo: "Cargo / CBM / KG (optional)",
    submit: "Send inquiry",
    submitting: "Sending...",
    required: "Add a name/company, one contact method, origin, and destination.",
    success: "Inquiry received. Sales has the route and page context needed to reply.",
    failed: "The database form is temporarily unavailable. Use the email or copy option below so this request is not lost.",
    copied: "Inquiry brief copied. Paste it into email or WhatsApp.",
    clipboardFailed: "Clipboard is unavailable. The inquiry brief is shown below.",
    restored: "Your unsent inquiry was restored.",
    clear: "Clear",
  },
  zh: {
    badge: "30 秒询盘",
    helper: "无需离开页面，线路和来源会一起进入线索池。",
    open: "快速询盘",
    close: "收起",
    fullQuote: "详细报价",
    email: "邮件询价",
    copy: "复制询盘",
    title: "不离开当前页面，直接让销售联系你",
    name: "姓名 / 公司",
    contact: "邮箱或 WhatsApp",
    origin: "起运地",
    destination: "目的地",
    cargo: "货物 / CBM / KG（选填）",
    submit: "提交询盘",
    submitting: "提交中...",
    required: "请填写姓名或公司、一个联系方式、起运地和目的地。",
    success: "询盘已收到，销售会带着当前线路和页面来源联系你。",
    failed: "数据库表单暂时不可用，请使用下方邮件或复制入口，避免丢失询盘。",
    copied: "询盘内容已复制，可粘贴到邮件或 WhatsApp。",
    clipboardFailed: "浏览器未授权剪贴板，询盘内容已在下方展开。",
    restored: "已恢复上次未提交的询盘。",
    clear: "清除",
  },
};

function currentRouteContext(pathname, search) {
  if (pathname.startsWith("/routes/")) {
    const slug = pathname.split("/").filter(Boolean)[1];
    const routePage = getRouteLandingPage(slug);
    if (routePage) {
      return {
        label: routePage.lane,
        quoteHref: `/quote${routeQuoteSearch(routePage)}`,
        source: `/routes/${routePage.slug}`,
        detail: `${routePage.transit} · ${routePage.scope}`,
        origin: routePage.origin,
        destination: routePage.destination,
        cargo: routePage.ctaCargo,
      };
    }
  }

  if (pathname === "/quote") {
    const params = new URLSearchParams(search);
    const origin = params.get("pol") || params.get("origin") || "";
    const destination = params.get("pod") || params.get("destination") || "";
    const label = params.get("lane") || [origin, destination].filter(Boolean).join(" -> ");
    return {
      label: label || "Current quote request",
      quoteHref: `/quote${search || ""}`,
      source: `/quote${search || ""}`,
      detail: "Keep the current quote details and ask sales to confirm.",
      origin,
      destination,
      cargo: params.get("cargo") || "",
    };
  }

  if (pathname === "/order") {
    const params = new URLSearchParams(search);
    const origin = params.get("pol") || params.get("origin") || "";
    const destination = params.get("pod") || params.get("destination") || "";
    const label = [origin, destination].filter(Boolean).join(" -> ") || "Self-service order draft";
    return {
      label,
      quoteHref: `/order${search || ""}`,
      source: `/order${search || ""}`,
      detail: "Create a structured order draft with pickup, cargo, customs and delivery context.",
      origin,
      destination,
      cargo: params.get("cargo") || "",
    };
  }

  if (pathname === "/routes") {
    return {
      label: "China-Europe route recommendation",
      quoteHref: "/quote",
      source: "/routes",
      detail: "Compare route pages or ask sales to recommend the best lane.",
      origin: "",
      destination: "",
      cargo: "",
    };
  }

  return {
    label: "China-Europe rail LCL / FBA / DDP inquiry",
    quoteHref: "/quote",
    source: pathname || "/",
    detail: "Share route, cargo and one contact method for a firm quote.",
    origin: "",
    destination: "",
    cargo: "",
  };
}

function initialStickyForm(context) {
  return {
    name: "",
    contact: "",
    origin: context.origin || "",
    destination: context.destination || "",
    cargo: context.cargo || "",
  };
}

function splitContact(value) {
  const contact = String(value || "").trim();
  return contact.includes("@")
    ? { email: contact, phone: null }
    : { email: null, phone: contact || null };
}

function estimateStickyLeadScore(form, context) {
  let score = 50;
  if (form.contact.includes("@")) score += 8;
  else if (form.contact.trim()) score += 12;
  if (form.name.trim()) score += 8;
  if (form.origin.trim() && form.destination.trim()) score += 18;
  if (form.cargo.trim()) score += 8;
  if (context.origin && context.destination) score += 4;
  return Math.min(score, 96);
}

function buildStickyInquiry(context, form = {}) {
  return buildFallbackInquiry({
    subject: `Quick rail quote request - ${context.label}`,
    lines: [
      "Source: sticky public quick inquiry",
      `Page: ${context.source}`,
      `Context: ${context.label}`,
      `Note: ${context.detail}`,
      "",
      `Name / company: ${form.name || "-"}`,
      `Email / WhatsApp: ${form.contact || "-"}`,
      `Origin: ${form.origin || context.origin || "-"}`,
      `Destination: ${form.destination || context.destination || "-"}`,
      `Cargo / CBM / KG: ${form.cargo || context.cargo || "-"}`,
      "",
      "Please confirm available route, schedule, customs/delivery scope and firm quote.",
    ],
  });
}

export default function PublicConversionBar({ locale = "en" }) {
  const location = useLocation();
  const createLeadMutation = useCreateLead();
  const [isExpanded, setIsExpanded] = useState(false);
  const [fallbackText, setFallbackText] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const text = copyByLocale[locale] || copyByLocale.en;
  const context = useMemo(
    () => currentRouteContext(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const initialForm = useMemo(() => initialStickyForm(context), [context]);
  const [form, setForm, formDraft] = usePersistentFormDraft(
    `eurasiago:sticky-inquiry:${context.source}`,
    initialForm,
  );
  const inquiry = useMemo(() => buildStickyInquiry(context, form), [context, form]);

  const updateForm = (field, value) => {
    setMessage("");
    setFallbackText("");
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopyBrief = async () => {
    setFallbackText(inquiry.text);
    try {
      await navigator.clipboard.writeText(inquiry.text);
      setMessage(text.copied);
      setMessageType("success");
    } catch (error) {
      setMessage(text.clipboardFailed);
      setMessageType("info");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setFallbackText("");

    if (!form.name.trim() || !form.contact.trim() || !form.origin.trim() || !form.destination.trim()) {
      setMessage(text.required);
      setMessageType("error");
      return;
    }

    const contact = splitContact(form.contact);
    const leadScore = estimateStickyLeadScore(form, context);
    const attribution = captureAcquisitionAttribution({
      defaultSourceType: location.pathname.startsWith("/routes/") ? "google_seo" : "website_sticky_form",
      touchpoint: `sticky_quick_form:${location.pathname}`,
    });

    try {
      await createLeadMutation.mutateAsync({
        company_name: form.name.trim(),
        contact_name: form.name.trim(),
        ...contact,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        cargo_desc: form.cargo.trim() || null,
        ...attribution.leadFields,
        website_visit: attribution.websiteVisit,
        intent_level: leadScore >= 80 ? "hot" : "warm",
        lead_score: leadScore,
        transport_mode_interest: "rail",
        shipment_type_interest: "LCL",
        message: [
          `Sticky inquiry context: ${context.label}`,
          `Page: ${context.source}`,
          `Context note: ${context.detail}`,
          form.cargo ? `Cargo: ${form.cargo}` : "",
          ...attribution.messageLines,
        ].filter(Boolean).join(" | "),
        status: "new",
      });
      formDraft.clearDraft(initialForm);
      setMessage(text.success);
      setMessageType("success");
    } catch (error) {
      setFallbackText(inquiry.text);
      setMessage(text.failed);
      setMessageType("error");
    }
  };

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
    setMessage("");
    setFallbackText("");
  };

  return (
    <div className="fixed inset-x-0 bottom-3 z-40 px-3 md:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur">
        {isExpanded ? (
          <form onSubmit={handleSubmit} className="border-b border-slate-200 bg-slate-950 p-4 text-white md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">{text.badge}</div>
                <h2 className="mt-1 text-lg font-black">{text.title}</h2>
                <div className="mt-1 text-xs text-slate-400">{context.label}</div>
              </div>
              <button type="button" onClick={toggleExpanded} className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white">
                {text.close}
              </button>
            </div>

            {formDraft.draftRestored ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200">
                <span>{text.restored}</span>
                <button
                  type="button"
                  onClick={() => formDraft.clearDraft(initialForm)}
                  className="rounded-full border border-amber-200/30 px-2.5 py-1 text-[11px] font-bold"
                >
                  {text.clear}
                </button>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 md:grid-cols-5">
              <input
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                aria-label={text.name}
                placeholder={text.name}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300"
              />
              <input
                value={form.contact}
                onChange={(event) => updateForm("contact", event.target.value)}
                aria-label={text.contact}
                placeholder={text.contact}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300"
              />
              <input
                value={form.origin}
                onChange={(event) => updateForm("origin", event.target.value)}
                aria-label={text.origin}
                placeholder={text.origin}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300"
              />
              <input
                value={form.destination}
                onChange={(event) => updateForm("destination", event.target.value)}
                aria-label={text.destination}
                placeholder={text.destination}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300"
              />
              <input
                value={form.cargo}
                onChange={(event) => updateForm("cargo", event.target.value)}
                aria-label={text.cargo}
                placeholder={text.cargo}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300"
              />
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={createLeadMutation.isPending}
                className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createLeadMutation.isPending ? text.submitting : text.submit}
              </button>
              <Link to={context.quoteHref} className="rounded-xl border border-white/15 px-4 py-2.5 text-center text-xs font-bold text-white">
                {text.fullQuote}
              </Link>
              <a href={inquiry.mailto} className="rounded-xl border border-white/15 px-4 py-2.5 text-center text-xs font-bold text-white">
                {text.email}
              </a>
              <button type="button" onClick={handleCopyBrief} className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white">
                {text.copy}
              </button>
            </div>

            {message ? (
              <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                messageType === "success"
                  ? "bg-emerald-300/15 text-emerald-100"
                  : messageType === "error"
                    ? "bg-rose-300/15 text-rose-100"
                    : "bg-white/10 text-slate-200"
              }`}>
                {message}
              </div>
            ) : null}
            {fallbackText ? (
              <textarea
                readOnly
                value={fallbackText}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-3 max-h-36 min-h-24 w-full rounded-xl border border-amber-200/30 bg-white p-3 font-mono text-xs leading-5 text-slate-800 outline-none"
              />
            ) : null}
          </form>
        ) : null}

        <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between md:p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                {text.badge}
              </span>
              <span className="text-xs font-semibold text-slate-500">{text.helper}</span>
            </div>
            <div className="mt-1 truncate text-sm font-black text-slate-950 md:text-base">{context.label}</div>
          </div>

          <div className="flex gap-2 md:justify-end">
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={isExpanded}
              className="flex-1 rounded-2xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white transition hover:bg-slate-800 md:flex-none"
            >
              {isExpanded ? text.close : text.open}
            </button>
            <Link
              to={context.quoteHref}
              className="flex-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-xs font-black text-emerald-700 transition hover:bg-emerald-100 md:flex-none"
            >
              {text.fullQuote}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
