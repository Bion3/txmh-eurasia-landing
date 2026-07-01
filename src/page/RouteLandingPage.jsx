import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router";
import { getRouteLandingPage, routeLandingPages, routeQuoteSearch } from "../data/routeLandingPages";
import { useCreateLead } from "../hooks/useLeads";
import { usePersistentFormDraft } from "../hooks/usePersistentFormDraft";
import { captureAcquisitionAttribution } from "../lib/acquisitionAttribution";
import { buildFallbackInquiry } from "../lib/publicInquiryFallback";

const emptyRouteInquiry = {
  name: "",
  company: "",
  email: "",
  phone: "",
  cargo: "",
  volume: "",
  weight: "",
  readyDate: "this_month",
};

const siteUrl = "https://www.eurasiago.com";

function estimateRouteLeadScore(values) {
  let score = 52;
  if (values.email.trim()) score += 8;
  if (values.phone.trim()) score += 12;
  if (values.company.trim()) score += 8;
  if (values.cargo.trim()) score += 8;
  if (values.volume || values.weight) score += 8;
  if (values.readyDate === "this_week" || values.readyDate === "this_month") score += 12;
  return Math.min(score, 98);
}

function routeIntentLevel(score) {
  if (score >= 80) return "hot";
  if (score >= 58) return "warm";
  return "cold";
}

function buildRouteInquiryEmail(page, inquiry) {
  return buildFallbackInquiry({
    subject: `Route inquiry - ${page.lane}`,
    lines: [
      `Route: ${page.lane}`,
      `Route page: /routes/${page.slug}`,
      `Transit note: ${page.transit}`,
      `Service scope: ${page.scope}`,
      "",
      `Name: ${inquiry.name || "-"}`,
      `Company: ${inquiry.company || "-"}`,
      `Email: ${inquiry.email || "-"}`,
      `Phone / WhatsApp: ${inquiry.phone || "-"}`,
      `Cargo: ${inquiry.cargo || page.ctaCargo}`,
      `Volume CBM: ${inquiry.volume || "-"}`,
      `Weight KG: ${inquiry.weight || "-"}`,
      `Shipping window: ${inquiry.readyDate || "-"}`,
      "",
      "Please confirm available schedule, customs/delivery scope and firm quote.",
    ],
  });
}

function routeInquiryMailto(page, inquiry) {
  return buildRouteInquiryEmail(page, inquiry).mailto;
}

function routeFaqs(page) {
  return [
    {
      question: `How long does ${page.title} usually take?`,
      answer: `${page.transit}. Final timing depends on departure week, border routing, customs status and final-mile delivery address.`,
    },
    {
      question: "What cargo usually fits this rail lane?",
      answer: `This lane is commonly used for ${page.cargoFit.slice(0, 4).join(", ")}. Sales still needs cargo name, volume, weight and ready date before confirming a firm quote.`,
    },
    {
      question: "Can customs and door delivery be included?",
      answer: `Yes. The typical service scope is: ${page.scope}. The exact customs, DDP/DAP and final-mile scope is confirmed after checking cargo details and delivery address.`,
    },
    {
      question: "What information is needed for a firm quote?",
      answer: "Please share cargo name, volume, weight, pickup city, final delivery address, incoterm, ready date and whether customs or door delivery is required.",
    },
  ];
}

function buildRouteStructuredData(page) {
  const canonical = `${siteUrl}/routes/${page.slug}`;
  const faqs = routeFaqs(page);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${canonical}#service`,
        name: page.title,
        alternateName: page.seoTitle,
        description: page.description,
        serviceType: "China-Europe rail freight, LCL, FCL, customs coordination and door delivery",
        provider: {
          "@type": "Organization",
          "@id": `${siteUrl}/#organization`,
          name: "EurasiaGo",
          url: siteUrl,
        },
        areaServed: ["China", "Germany", "Poland", "France", "Italy", "Europe"],
        url: canonical,
      },
      {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Rail routes",
            item: `${siteUrl}/#rail-lanes`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: page.title,
            item: canonical,
          },
        ],
      },
    ],
  };
}

export default function RouteLandingPage({ changePage }) {
  const { slug } = useParams();
  const page = getRouteLandingPage(slug);
  const createLeadMutation = useCreateLead();
  const [inquiry, setInquiry, routeDraft] = usePersistentFormDraft(
    `eurasiago:route-inquiry:${slug || "unknown"}`,
    emptyRouteInquiry
  );
  const [formMessage, setFormMessage] = useState("");
  const [fallbackInquiryText, setFallbackInquiryText] = useState("");

  useEffect(() => {
    if (!page || typeof document === "undefined") return undefined;

    const script = document.createElement("script");
    script.id = "route-landing-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(buildRouteStructuredData(page));

    document.getElementById(script.id)?.remove();
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [page]);

  if (!page) {
    return <Navigate to="/" replace />;
  }

  const quoteSearch = routeQuoteSearch(page);
  const scorePreview = estimateRouteLeadScore(inquiry);
  const faqs = routeFaqs(page);

  const updateInquiry = (field, value) => {
    setFormMessage("");
    setFallbackInquiryText("");
    setInquiry((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopyFallbackInquiry = async () => {
    const { text } = buildRouteInquiryEmail(page, inquiry);
    setFallbackInquiryText(text);

    try {
      await navigator.clipboard.writeText(text);
      setFormMessage("Inquiry details copied. You can paste them into email or WhatsApp if the form is unavailable.");
    } catch (error) {
      setFormMessage("Browser clipboard is unavailable. The inquiry details are shown below for manual copy.");
    }
  };

  const handleRouteInquirySubmit = async (event) => {
    event.preventDefault();

    if (!inquiry.name.trim() || (!inquiry.email.trim() && !inquiry.phone.trim())) {
      setFormMessage("Please add your name and at least one contact method so sales can reply.");
      return;
    }

    const leadScore = estimateRouteLeadScore(inquiry);
    const attribution = captureAcquisitionAttribution({
      defaultSourceType: "google_seo",
      touchpoint: `route_landing_form:${page.slug}`,
    });

    try {
      await createLeadMutation.mutateAsync({
        company_name: inquiry.company.trim() || inquiry.name.trim(),
        contact_name: inquiry.name.trim(),
        email: inquiry.email.trim() || null,
        phone: inquiry.phone.trim() || null,
        origin: page.origin,
        destination: page.destination,
        cargo_desc: inquiry.cargo.trim() || page.ctaCargo,
        volume_cbm: inquiry.volume ? Number(inquiry.volume) : 0,
        weight_kg: inquiry.weight ? Number(inquiry.weight) : 0,
        ...attribution.leadFields,
        website_visit: attribution.websiteVisit,
        intent_level: routeIntentLevel(leadScore),
        lead_score: leadScore,
        transport_mode_interest: "rail",
        shipment_type_interest: "LCL",
        message: [
          `Selected lane: ${page.lane}`,
          `Route page: /routes/${page.slug}`,
          `Transit: ${page.transit}`,
          `Service scope: ${page.scope}`,
          `Shipping window: ${inquiry.readyDate}`,
          inquiry.phone ? `Phone/WhatsApp: ${inquiry.phone}` : "",
          ...attribution.messageLines,
        ]
          .filter(Boolean)
          .join(" | "),
        status: "new",
      });
      routeDraft.clearDraft(emptyRouteInquiry);
      setFallbackInquiryText("");
      setFormMessage("Inquiry received. Sales can now see this route page and will reply with route context.");
    } catch (error) {
      const { text } = buildRouteInquiryEmail(page, inquiry);
      setFallbackInquiryText(text);
      setFormMessage(
        "The database form is temporarily unavailable. Your inquiry details are preserved below, so you can email them directly and avoid losing this request."
      );
    }
  };

  return (
    <main className="bg-white text-slate-900">
      <section className="relative overflow-hidden bg-slate-950 px-6 py-16 text-white md:py-24">
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">
              China-Europe rail lane
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight md:text-6xl">
              {page.headline}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              {page.intro}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => changePage("quote", { search: quoteSearch })}
                className="rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Request this lane quote
              </button>
              <button
                type="button"
                onClick={() => changePage("quote")}
                className="rounded-2xl border border-white/20 px-6 py-4 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Compare another route
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="grid gap-4">
              <div className="rounded-3xl bg-white p-5 text-slate-950">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Lane</div>
                <div className="mt-2 text-2xl font-black">{page.origin}</div>
                <div className="my-2 text-sm font-bold text-emerald-600">to</div>
                <div className="text-2xl font-black">{page.destination}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Transit</div>
                  <div className="mt-2 text-lg font-bold">{page.transit}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Service</div>
                  <div className="mt-2 text-lg font-bold">LCL / FCL / door delivery</div>
                </div>
              </div>
              <div className="rounded-3xl border border-emerald-300/30 bg-emerald-300/10 p-5">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Scope</div>
                <div className="mt-2 text-sm leading-7 text-emerald-50">{page.scope}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          {page.proofPoints.map((point) => (
            <article key={point} className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="h-2 w-12 rounded-full bg-emerald-400" />
              <p className="mt-5 text-lg font-bold leading-7 text-slate-950">{point}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-600">Best-fit cargo</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              Shipments that usually fit this lane
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              A firm quote still depends on cargo name, volume, weight, ready date, customs scope and the final delivery address. Submit the lane form and sales can confirm the route, schedule and cost.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {page.cargoFit.map((cargo) => (
              <div key={cargo} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-700 shadow-sm">
                {cargo}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-600">Route FAQ</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              Answers before you request a quote
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              These answers help buyers decide whether this route is worth checking before submitting a firm quote request.
            </p>
          </div>
          <div className="grid gap-3">
            {faqs.map((item) => (
              <article key={item.question} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-black text-slate-950">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-slate-950 p-6 text-white md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-300">Fast lead capture</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight">
                Ask sales about this exact lane
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Submit a short inquiry here without leaving the route page. The lead record will keep the route page, lane, transit note and attribution context so sales can reply faster.
              </p>
              <button
                type="button"
                onClick={() => changePage("quote", { search: quoteSearch })}
                className="mt-6 rounded-2xl border border-white/20 px-6 py-4 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Open full quote form
              </button>
            </div>

            <form onSubmit={handleRouteInquirySubmit} className="rounded-[1.5rem] bg-white p-4 text-slate-950 shadow-2xl md:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-black">Quick lane inquiry</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {page.origin} to {page.destination}
                  </p>
                  {routeDraft.draftRestored ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      <span>Restored your unsent lane inquiry draft.</span>
                      <button
                        type="button"
                        onClick={() => {
                          routeDraft.clearDraft(emptyRouteInquiry);
                          setFallbackInquiryText("");
                          setFormMessage("Saved lane inquiry draft cleared.");
                        }}
                        className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700"
                      >
                        Clear draft
                      </button>
                    </div>
                  ) : null}
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  Score {scorePreview}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-slate-500">Name *</span>
                  <input
                    value={inquiry.name}
                    onChange={(event) => updateInquiry("name", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Your name"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-slate-500">Company</span>
                  <input
                    value={inquiry.company}
                    onChange={(event) => updateInquiry("company", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Company name"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-slate-500">Email</span>
                  <input
                    type="email"
                    value={inquiry.email}
                    onChange={(event) => updateInquiry("email", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    placeholder="name@company.com"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-slate-500">Phone / WhatsApp</span>
                  <input
                    value={inquiry.phone}
                    onChange={(event) => updateInquiry("phone", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    placeholder="+49 / +86"
                  />
                </label>
                <label className="grid gap-1.5 md:col-span-2">
                  <span className="text-xs font-bold text-slate-500">Cargo</span>
                  <input
                    value={inquiry.cargo}
                    onChange={(event) => updateInquiry("cargo", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    placeholder={page.ctaCargo}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-slate-500">Volume CBM</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={inquiry.volume}
                    onChange={(event) => updateInquiry("volume", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    placeholder="5"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-slate-500">Weight KG</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={inquiry.weight}
                    onChange={(event) => updateInquiry("weight", event.target.value)}
                    className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    placeholder="800"
                  />
                </label>
                <label className="grid gap-1.5 md:col-span-2">
                  <span className="text-xs font-bold text-slate-500">Shipping window</span>
                  <select
                    value={inquiry.readyDate}
                    onChange={(event) => updateInquiry("readyDate", event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="this_week">This week</option>
                    <option value="this_month">This month</option>
                    <option value="next_month">Next month</option>
                    <option value="planning">Planning / comparing</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createLeadMutation.isPending ? "Submitting..." : "Submit route inquiry"}
                </button>
                <button
                  type="button"
                  onClick={() => changePage("quote", { search: quoteSearch })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-emerald-300"
                >
                  Need detailed quote
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={routeInquiryMailto(page, inquiry)}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                >
                  Email backup
                </a>
                <button
                  type="button"
                  onClick={handleCopyFallbackInquiry}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-emerald-300"
                >
                  Copy inquiry details
                </button>
              </div>
              {formMessage ? (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  {formMessage}
                </div>
              ) : null}
              {fallbackInquiryText ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                    Email fallback content
                  </div>
                  <textarea
                    readOnly
                    value={fallbackInquiryText}
                    onFocus={(event) => event.currentTarget.select()}
                    className="mt-2 min-h-48 w-full rounded-2xl border border-amber-200 bg-white p-3 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                </div>
              ) : null}
            </form>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">More rail lane pages</div>
          <div className="mt-5 flex flex-wrap gap-3">
            {routeLandingPages
              .filter((item) => item.slug !== page.slug)
              .map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => changePage("route", { path: `/routes/${item.slug}` })}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                >
                  {item.title}
                </button>
              ))}
          </div>
        </div>
      </section>
    </main>
  );
}
