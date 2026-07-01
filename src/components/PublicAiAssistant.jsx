import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { getRouteLandingPage, routeQuoteSearch } from "../data/routeLandingPages";
import { buildFallbackInquiry } from "../lib/publicInquiryFallback";

const assistantCopy = {
  en: {
    launcher: "AI support",
    title: "EurasiaGo AI support",
    subtitle: "Route, quote and order guidance",
    close: "Close",
    input: "Ask about route, cost, DDP, FBA, pickup or order tracking",
    send: "Send",
    quote: "Get quote",
    email: "Email sales",
    copy: "Copy brief",
    copied: "Brief copied. Paste it into email or WhatsApp.",
    copyFailed: "Clipboard is unavailable. Use the email option or select the brief below.",
    briefTitle: "Inquiry brief",
    clear: "Clear",
    chips: [
      "China to Germany DDP",
      "Amazon FBA delivery",
      "Door to door pickup",
      "What info for a quote?",
      "Track my order",
    ],
  },
  zh: {
    launcher: "AI 客服",
    title: "EurasiaGo AI 客服",
    subtitle: "线路、询价、下单和订单跟踪引导",
    close: "关闭",
    input: "询问线路、费用、DDP、FBA、上门提货或订单跟踪",
    send: "发送",
    quote: "去询价",
    email: "邮件销售",
    copy: "复制简报",
    copied: "简报已复制，可粘贴到邮件或 WhatsApp。",
    copyFailed: "浏览器未授权剪贴板，请使用邮件入口或手动复制下方简报。",
    briefTitle: "询盘简报",
    clear: "清空",
    chips: [
      "中国到德国 DDP",
      "Amazon FBA 派送",
      "门到门上门提货",
      "报价需要什么资料？",
      "查询订单进度",
    ],
  },
};

function routeContext(pathname, search) {
  if (pathname.startsWith("/routes/")) {
    const slug = pathname.split("/").filter(Boolean)[1];
    const routePage = getRouteLandingPage(slug);
    if (routePage) {
      return {
        source: `/routes/${routePage.slug}`,
        lane: routePage.lane,
        origin: routePage.origin,
        destination: routePage.destination,
        cargo: routePage.ctaCargo,
        quoteHref: `/quote${routeQuoteSearch(routePage)}`,
        service: routePage.scope,
      };
    }
  }

  if (pathname === "/quote") {
    const params = new URLSearchParams(search);
    const origin = params.get("pol") || params.get("origin") || "";
    const destination = params.get("pod") || params.get("destination") || "";
    return {
      source: `/quote${search || ""}`,
      lane: params.get("lane") || [origin, destination].filter(Boolean).join(" -> ") || "Quote request",
      origin,
      destination,
      cargo: params.get("cargo") || "",
      quoteHref: `/quote${search || ""}`,
      service: params.get("serviceScope") || "rail freight quote",
    };
  }

  if (pathname === "/order") {
    const params = new URLSearchParams(search);
    const origin = params.get("pol") || params.get("origin") || "";
    const destination = params.get("pod") || params.get("destination") || "";
    return {
      source: `/order${search || ""}`,
      lane: [origin, destination].filter(Boolean).join(" -> ") || "Self-service order draft",
      origin,
      destination,
      cargo: params.get("cargo") || "",
      quoteHref: `/order${search || ""}`,
      service: "self-service order draft, pickup, customs, delivery and order milestone setup",
    };
  }

  return {
    source: pathname || "/",
    lane: "China-Europe rail freight",
    origin: "",
    destination: "",
    cargo: "",
    quoteHref: "/quote",
    service: "rail LCL, FCL, DDP, FBA and door delivery",
  };
}

function detectIntent(message) {
  const text = String(message || "").toLowerCase();

  if (/(track|tracking|order|订单|进度|物流|到哪)/.test(text)) return "tracking";
  if (/(fba|amazon|亚马逊|仓库)/.test(text)) return "fba";
  if (/(ddp|tax|duty|customs|清关|关税|包税)/.test(text)) return "ddp";
  if (/(door|pickup|delivery|派送|上门|门到门|提货)/.test(text)) return "door";
  if (/(document|docs|资料|文件|需要什么)/.test(text)) return "requirements";
  if (/(cost|price|quote|rate|freight|费用|价格|报价|运费)/.test(text)) return "quote";
  if (/(time|days|transit|多久|时效|几天)/.test(text)) return "transit";
  return "general";
}

function buildAssistantReply({ message, context, locale }) {
  const intent = detectIntent(message);
  const isZh = locale === "zh";
  const route = context.origin && context.destination
    ? `${context.origin} -> ${context.destination}`
    : context.lane;

  const replies = {
    tracking: isZh
      ? `可以查询订单全周期节点。请提供订单号、订舱号或客户公司名；系统内订单会按提货、入仓、装箱、报关、发车/开船、到站、清关、派送和签收跟踪。`
      : `I can guide order tracking. Please provide order number, booking number or company name. The internal workflow tracks pickup, warehouse, loading, customs, departure, arrival, clearance, delivery and POD.`,
    fba: isZh
      ? `FBA 线路通常需要确认 Amazon 仓库代码、箱数、每箱重量尺寸、是否 DDP、是否需要预约派送。${route} 可以先提交正式询价，销售会确认铁路/卡派/清关派送方案。`
      : `For Amazon FBA, we need warehouse code, carton count, carton weight/dimensions, DDP scope and appointment delivery needs. For ${route}, submit a firm quote request so sales can confirm rail, customs and final delivery.`,
    ddp: isZh
      ? `DDP/包税方案需要货物 HS code、品名材质用途、申报价值、是否带电/品牌、收件地址和 VAT/EORI 情况。我们会把清关和欧洲派送一起核价。`
      : `For DDP, we need HS code, cargo description/material/use, declared value, battery/brand status, consignee address and VAT/EORI context. Customs and Europe delivery are priced together.`,
    door: isZh
      ? `门到门需要起运地提货地址、目的地派送地址、可提货时间、包装尺寸重量和是否需要尾板/预约。提交询价后可进入销售跟进和后续订单节点。`
      : `Door-to-door needs pickup address, delivery address, pickup window, package dimensions/weight, tail-lift or appointment needs. After quote submission, sales can convert it into the managed order workflow.`,
    quote: isZh
      ? `正式报价至少需要起运地、目的地、货物品名、体积/重量、件数、服务范围和预计发货时间。当前页面上下文是 ${route}，可以直接带参进入询价页。`
      : `A firm quote needs origin, destination, cargo description, CBM/KG, pieces, service scope and shipping window. Current context is ${route}; you can open the quote page with this context.`,
    transit: isZh
      ? `中欧铁路常见主线时效约 18-25 天，门到门会叠加提货、报关、清关和派送时间。具体以起运地、目的地、仓库预约和清关资料为准。`
      : `Typical China-Europe rail mainline transit is around 18-25 days. Door-to-door timing also depends on pickup, export customs, import clearance and final delivery appointments.`,
    requirements: isZh
      ? `报价/下单资料：公司和联系人、邮箱或 WhatsApp、起运地、目的地、货物品名、体积重量件数、发货窗口、贸易条款、是否清关派送、特殊货物说明。`
      : `For quote/order setup: company/contact, email or WhatsApp, origin, destination, cargo, CBM/KG/pieces, shipping window, incoterm, customs/delivery scope and special cargo notes.`,
    general: isZh
      ? `我可以帮你判断线路、报价资料、DDP/FBA、门到门和订单节点。当前上下文是 ${route}。如果你给我货物、体积重量和目的地，我会整理成询价简报。`
      : `I can help with routes, quote requirements, DDP/FBA, door delivery and order milestones. Current context is ${route}. Share cargo, CBM/KG and destination, and I will turn it into an inquiry brief.`,
  };

  return {
    intent,
    text: replies[intent],
  };
}

function quoteHrefForMessage(context, message) {
  const params = new URLSearchParams();
  if (context.origin) params.set("pol", context.origin);
  if (context.destination) params.set("pod", context.destination);
  if (context.lane) params.set("lane", context.lane);
  if (context.cargo) params.set("cargo", context.cargo);
  if (/fba|amazon|亚马逊/i.test(message)) params.set("serviceScope", "amazon_fba");
  if (/ddp|包税|清关/i.test(message)) params.set("incoterm", "DDP");
  const query = params.toString();
  return query ? `/quote?${query}` : context.quoteHref || "/quote";
}

function buildAssistantBrief({ context, messages }) {
  const latestUserMessages = messages.filter((item) => item.role === "user").slice(-4).map((item) => item.text);

  return buildFallbackInquiry({
    subject: `AI support inquiry - ${context.lane}`,
    lines: [
      "Source: public AI support assistant",
      `Page: ${context.source}`,
      `Context: ${context.lane}`,
      `Service: ${context.service}`,
      context.origin ? `Origin: ${context.origin}` : "",
      context.destination ? `Destination: ${context.destination}` : "",
      context.cargo ? `Cargo context: ${context.cargo}` : "",
      "",
      "Visitor questions:",
      ...latestUserMessages.map((item, index) => `${index + 1}. ${item}`),
      "",
      "Please reply with route option, estimated transit, required documents, customs/delivery scope and firm quote next steps.",
    ],
  });
}

export default function PublicAiAssistant({ locale = "en" }) {
  const location = useLocation();
  const text = assistantCopy[locale] || assistantCopy.en;
  const context = useMemo(() => routeContext(location.pathname, location.search), [location.pathname, location.search]);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const [briefText, setBriefText] = useState("");
  const [messages, setMessages] = useState(() => [
    {
      role: "assistant",
      text: locale === "zh"
        ? "你好，我可以帮你判断中欧线路、询价资料、DDP/FBA、门到门和订单跟踪。"
        : "Hi, I can help with China-Europe routes, quote requirements, DDP/FBA, door delivery and order tracking.",
    },
  ]);

  const latestUserMessage = messages.filter((item) => item.role === "user").slice(-1)[0]?.text || "";
  const quoteHref = quoteHrefForMessage(context, latestUserMessage);
  const inquiry = useMemo(() => buildAssistantBrief({ context, messages }), [context, messages]);

  const sendMessage = (value = input) => {
    const content = String(value || "").trim();
    if (!content) return;

    const reply = buildAssistantReply({ message: content, context, locale });
    setMessages((prev) => [
      ...prev,
      { role: "user", text: content },
      { role: "assistant", text: reply.text },
    ]);
    setInput("");
    setNotice("");
    setBriefText("");
  };

  const handleCopyBrief = async () => {
    setBriefText(inquiry.text);
    try {
      await navigator.clipboard.writeText(inquiry.text);
      setNotice(text.copied);
    } catch {
      setNotice(text.copyFailed);
    }
  };

  const clearConversation = () => {
    setMessages([
      {
        role: "assistant",
        text: locale === "zh"
          ? "已清空。你可以直接告诉我起运地、目的地、货物、体积重量和服务需求。"
          : "Cleared. Tell me origin, destination, cargo, CBM/KG and service scope.",
      },
    ]);
    setInput("");
    setNotice("");
    setBriefText("");
  };

  return (
    <div className="fixed bottom-28 right-3 z-50 md:bottom-28 md:right-6">
      {isOpen ? (
        <section className="flex max-h-[72vh] w-[calc(100vw-1.5rem)] max-w-[420px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
          <header className="bg-slate-950 px-4 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">{text.subtitle}</div>
                <h3 className="mt-1 text-lg font-bold">{text.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                {text.close}
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "ml-8 bg-sky-600 text-white"
                    : "mr-8 border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {message.text}
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              {text.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => sendMessage(chip)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-200 hover:bg-sky-50"
                >
                  {chip}
                </button>
              ))}
            </div>

            {notice ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
                {notice}
              </div>
            ) : null}

            {briefText ? (
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-500">{text.briefTitle}</div>
                <textarea
                  readOnly
                  value={briefText}
                  onFocus={(event) => event.currentTarget.select()}
                  rows="7"
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 font-mono text-xs leading-5 text-slate-700 outline-none"
                />
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={text.input}
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
              />
              <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                {text.send}
              </button>
            </form>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Link to={quoteHref} className="rounded-xl bg-sky-600 px-3 py-2 text-center text-xs font-semibold text-white">
                {text.quote}
              </Link>
              <a href={inquiry.mailto} className="rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700">
                {text.email}
              </a>
              <button
                type="button"
                onClick={handleCopyBrief}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                {text.copy}
              </button>
            </div>
            <button type="button" onClick={clearConversation} className="mt-2 text-xs font-semibold text-slate-400 hover:text-slate-700">
              {text.clear}
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-slate-950/25 transition hover:bg-slate-800"
        >
          {text.launcher}
        </button>
      )}
    </div>
  );
}
