import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { leadsApi } from "../api";
import { usePersistentFormDraft } from "../hooks/usePersistentFormDraft";
import { captureAcquisitionAttribution } from "../lib/acquisitionAttribution";
import { buildFallbackInquiry } from "../lib/publicInquiryFallback";

const defaultOrderForm = {
  company: "",
  contactName: "",
  email: "",
  phone: "",
  pickupAddress: "",
  origin: "",
  destination: "",
  deliveryAddress: "",
  cargo: "",
  pieces: "",
  volume: "",
  weight: "",
  packageType: "cartons",
  transportMode: "rail",
  shipmentType: "LCL",
  incoterm: "EXW",
  serviceScope: "door_to_door",
  readyDate: "this_month",
  customsRequired: true,
  deliveryRequired: true,
  notes: "",
};

const milestoneTemplates = [
  ["Pickup", "Confirm pickup address, cargo readiness and warehouse receiving window."],
  ["Origin warehouse", "Inbound scan, cargo check, packing or consolidation."],
  ["Export customs", "Commercial documents, HS code and export declaration."],
  ["Main transport", "Rail / sea / air departure, in-transit milestones and delay alerts."],
  ["Import customs", "Destination clearance, taxes or DDP settlement if required."],
  ["Final delivery", "Appointment, last-mile delivery and proof of delivery."],
  ["Finance", "Receivable, payable, invoice and payment reconciliation."],
];

function prefillFromSearch(searchParams) {
  return {
    origin: searchParams.get("pol") || searchParams.get("origin") || "",
    destination: searchParams.get("pod") || searchParams.get("destination") || "",
    cargo: searchParams.get("cargo") || "",
    shipmentType: searchParams.get("shipment_type") || searchParams.get("containerType") || "",
    serviceScope: searchParams.get("serviceScope") || "",
    incoterm: searchParams.get("incoterm") || "",
  };
}

function mergePrefill(base, prefill) {
  return Object.entries(prefill).reduce(
    (next, [key, value]) => (value ? { ...next, [key]: value } : next),
    base,
  );
}

export function scoreSelfServiceOrder(form) {
  let score = 35;
  if (form.company.trim()) score += 8;
  if (form.contactName.trim()) score += 6;
  if (form.email.trim()) score += 8;
  if (form.phone.trim()) score += 10;
  if (form.origin.trim() && form.destination.trim()) score += 14;
  if (form.pickupAddress.trim()) score += 8;
  if (form.deliveryAddress.trim()) score += 8;
  if (form.cargo.trim()) score += 8;
  if (form.volume || form.weight || form.pieces) score += 8;
  if (form.readyDate === "this_week") score += 8;
  if (form.serviceScope === "door_to_door") score += 5;
  if (form.incoterm === "DDP") score += 4;
  return Math.min(score, 99);
}

function intentLevel(score) {
  if (score >= 82) return "hot";
  if (score >= 60) return "warm";
  return "cold";
}

function shipmentTypeInterest(value) {
  if (value === "FCL") return "FCL";
  if (value === "air_cargo") return "air_cargo";
  return "LCL";
}

function buildSelfServiceInquiry(form, score) {
  return buildFallbackInquiry({
    subject: `Self-service order draft - ${form.origin || "Origin"} to ${form.destination || "Destination"}`,
    lines: [
      "Source: public self-service order page",
      `Intent score: ${score}`,
      "",
      `Company: ${form.company || "-"}`,
      `Contact: ${form.contactName || "-"}`,
      `Email: ${form.email || "-"}`,
      `Phone / WhatsApp: ${form.phone || "-"}`,
      "",
      `Pickup address: ${form.pickupAddress || "-"}`,
      `Origin: ${form.origin || "-"}`,
      `Destination: ${form.destination || "-"}`,
      `Delivery address: ${form.deliveryAddress || "-"}`,
      "",
      `Cargo: ${form.cargo || "-"}`,
      `Pieces: ${form.pieces || "-"}`,
      `Volume CBM: ${form.volume || "-"}`,
      `Weight KG: ${form.weight || "-"}`,
      `Package type: ${form.packageType || "-"}`,
      "",
      `Transport mode: ${form.transportMode || "-"}`,
      `Shipment type: ${form.shipmentType || "-"}`,
      `Incoterm: ${form.incoterm || "-"}`,
      `Service scope: ${form.serviceScope || "-"}`,
      `Ready date: ${form.readyDate || "-"}`,
      `Customs required: ${form.customsRequired ? "Yes" : "No"}`,
      `Delivery required: ${form.deliveryRequired ? "Yes" : "No"}`,
      `Notes: ${form.notes || "-"}`,
      "",
      "Please convert this draft into a confirmed quote/order after checking route, cost, documents, pickup and delivery conditions.",
    ],
  });
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">
        {label}{required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

const inputClass = "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

export default function SelfServiceOrderPage() {
  const [searchParams] = useSearchParams();
  const prefill = useMemo(() => prefillFromSearch(searchParams), [searchParams]);
  const initialForm = useMemo(() => mergePrefill(defaultOrderForm, prefill), [prefill]);
  const [form, setForm, draft] = usePersistentFormDraft("eurasiago:self-service-order", initialForm);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [fallbackText, setFallbackText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const score = useMemo(() => scoreSelfServiceOrder(form), [form]);
  const inquiry = useMemo(() => buildSelfServiceInquiry(form, score), [form, score]);

  const updateForm = (field, value) => {
    setStatus({ type: "", message: "" });
    setFallbackText("");
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const requiredMissing = () => {
    const missing = [];
    if (!form.contactName.trim() && !form.company.trim()) missing.push("company or contact");
    if (!form.email.trim() && !form.phone.trim()) missing.push("email or WhatsApp");
    if (!form.origin.trim()) missing.push("origin");
    if (!form.destination.trim()) missing.push("destination");
    if (!form.cargo.trim()) missing.push("cargo");
    return missing;
  };

  const buildLeadPayload = () => {
    const attribution = captureAcquisitionAttribution({
      defaultSourceType: "self_service_order",
      touchpoint: `self_service_order:${form.serviceScope}:${form.shipmentType}`,
    });

    return {
      company_name: form.company || form.contactName || "Self-service order customer",
      contact_name: form.contactName || "",
      email: form.email || null,
      phone: form.phone || null,
      origin: form.origin,
      destination: form.destination,
      cargo_desc: form.cargo,
      volume_cbm: form.volume ? Number(form.volume) : 0,
      weight_kg: form.weight ? Number(form.weight) : 0,
      ...attribution.leadFields,
      website_visit: attribution.websiteVisit,
      intent_level: intentLevel(score),
      lead_score: score,
      transport_mode_interest: form.transportMode,
      shipment_type_interest: shipmentTypeInterest(form.shipmentType),
      status: "new",
      message: [
        "Self-service order draft",
        `Pickup address: ${form.pickupAddress || "-"}`,
        `Delivery address: ${form.deliveryAddress || "-"}`,
        `Pieces: ${form.pieces || "-"}`,
        `Package: ${form.packageType}`,
        `Incoterm: ${form.incoterm}`,
        `Service scope: ${form.serviceScope}`,
        `Ready date: ${form.readyDate}`,
        `Customs required: ${form.customsRequired ? "yes" : "no"}`,
        `Delivery required: ${form.deliveryRequired ? "yes" : "no"}`,
        form.notes ? `Notes: ${form.notes}` : "",
        ...attribution.messageLines,
      ].filter(Boolean).join(" | "),
    };
  };

  const handleCopy = async () => {
    setFallbackText(inquiry.text);
    try {
      await navigator.clipboard.writeText(inquiry.text);
      setStatus({ type: "success", message: "Order draft copied. Paste it into email or WhatsApp if needed." });
    } catch {
      setStatus({ type: "info", message: "Clipboard is unavailable. The order draft is shown below for manual copy." });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const missing = requiredMissing();
    if (missing.length) {
      setStatus({ type: "error", message: `Please complete: ${missing.join(", ")}.` });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "", message: "" });
    setFallbackText("");

    try {
      await leadsApi.create(buildLeadPayload());
      draft.clearDraft(initialForm);
      setStatus({
        type: "success",
        message: "Your order draft has been received. Sales and operations can convert it into a confirmed quote/order after checking route, documents and pickup/delivery conditions.",
      });
    } catch (error) {
      setFallbackText(inquiry.text);
      setStatus({
        type: "error",
        message: "The database form is temporarily unavailable. Your order draft is preserved below so you can email it directly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="bg-slate-50">
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:px-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
          <div>
            <div className="inline-flex rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
              Self-service order
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
              Create a door-to-door order draft
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              Share pickup, cargo, customs and delivery details. The draft enters the lead pool first, then sales and operations confirm quote, documents, costs and order milestones.
            </p>
          </div>

          {draft.draftRestored ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>Your unsent order draft was restored.</span>
              <button
                type="button"
                onClick={() => draft.clearDraft(initialForm)}
                className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold"
              >
                Clear draft
              </button>
            </div>
          ) : null}

          {status.message ? (
            <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
              status.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : status.type === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-sky-200 bg-sky-50 text-sky-800"
            }`}>
              {status.message}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-7 space-y-7">
            <section>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Customer</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Company">
                  <input value={form.company} onChange={(event) => updateForm("company", event.target.value)} className={inputClass} placeholder="Company name" />
                </Field>
                <Field label="Contact name" required>
                  <input value={form.contactName} onChange={(event) => updateForm("contactName", event.target.value)} className={inputClass} placeholder="Your name" />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} className={inputClass} placeholder="name@company.com" />
                </Field>
                <Field label="Phone / WhatsApp">
                  <input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} className={inputClass} placeholder="+86 / +49 / +44" />
                </Field>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Door-to-door route</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Pickup address">
                  <input value={form.pickupAddress} onChange={(event) => updateForm("pickupAddress", event.target.value)} className={inputClass} placeholder="Factory / warehouse address" />
                </Field>
                <Field label="Delivery address">
                  <input value={form.deliveryAddress} onChange={(event) => updateForm("deliveryAddress", event.target.value)} className={inputClass} placeholder="Consignee / FBA / warehouse address" />
                </Field>
                <Field label="Origin city / station" required>
                  <input value={form.origin} onChange={(event) => updateForm("origin", event.target.value)} className={inputClass} placeholder="Xi'an / Chengdu / Shenzhen" />
                </Field>
                <Field label="Destination city / hub" required>
                  <input value={form.destination} onChange={(event) => updateForm("destination", event.target.value)} className={inputClass} placeholder="Duisburg / Hamburg / Warsaw" />
                </Field>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Cargo and service</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Cargo" required>
                  <input value={form.cargo} onChange={(event) => updateForm("cargo", event.target.value)} className={inputClass} placeholder="General cargo / FBA / electronics" />
                </Field>
                <Field label="Pieces">
                  <input type="number" min="0" value={form.pieces} onChange={(event) => updateForm("pieces", event.target.value)} className={inputClass} placeholder="48" />
                </Field>
                <Field label="Package">
                  <select value={form.packageType} onChange={(event) => updateForm("packageType", event.target.value)} className={inputClass}>
                    <option value="cartons">Cartons</option>
                    <option value="pallets">Pallets</option>
                    <option value="crates">Crates</option>
                    <option value="containers">Containers</option>
                  </select>
                </Field>
                <Field label="Volume CBM">
                  <input type="number" min="0" step="0.01" value={form.volume} onChange={(event) => updateForm("volume", event.target.value)} className={inputClass} placeholder="3.5" />
                </Field>
                <Field label="Weight KG">
                  <input type="number" min="0" step="0.1" value={form.weight} onChange={(event) => updateForm("weight", event.target.value)} className={inputClass} placeholder="860" />
                </Field>
                <Field label="Ready date">
                  <select value={form.readyDate} onChange={(event) => updateForm("readyDate", event.target.value)} className={inputClass}>
                    <option value="this_week">This week</option>
                    <option value="this_month">This month</option>
                    <option value="next_month">Next month</option>
                    <option value="not_sure">Not sure</option>
                  </select>
                </Field>
                <Field label="Transport">
                  <select value={form.transportMode} onChange={(event) => updateForm("transportMode", event.target.value)} className={inputClass}>
                    <option value="rail">Rail</option>
                    <option value="sea">Sea</option>
                    <option value="air">Air</option>
                  </select>
                </Field>
                <Field label="Shipment">
                  <select value={form.shipmentType} onChange={(event) => updateForm("shipmentType", event.target.value)} className={inputClass}>
                    <option value="LCL">LCL</option>
                    <option value="FCL">FCL</option>
                    <option value="air_cargo">Air cargo</option>
                  </select>
                </Field>
                <Field label="Incoterm">
                  <select value={form.incoterm} onChange={(event) => updateForm("incoterm", event.target.value)} className={inputClass}>
                    <option value="EXW">EXW</option>
                    <option value="FOB">FOB</option>
                    <option value="DAP">DAP</option>
                    <option value="DDP">DDP</option>
                  </select>
                </Field>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form.customsRequired} onChange={(event) => updateForm("customsRequired", event.target.checked)} />
                  Customs service required
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form.deliveryRequired} onChange={(event) => updateForm("deliveryRequired", event.target.checked)} />
                  Final delivery required
                </label>
                <Field label="Service scope">
                  <select value={form.serviceScope} onChange={(event) => updateForm("serviceScope", event.target.value)} className={inputClass}>
                    <option value="door_to_door">Door to door</option>
                    <option value="port_to_port">Port / station to port</option>
                    <option value="origin_only">Origin service only</option>
                    <option value="destination_only">Destination service only</option>
                  </select>
                </Field>
              </div>
              <Field label="Notes">
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows="4" className={inputClass} placeholder="HS code, battery, brand, FBA warehouse code, appointment requirement..." />
              </Field>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? "Submitting..." : "Submit order draft"}
              </button>
              <button type="button" onClick={handleCopy} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">
                Copy order brief
              </button>
              <a href={inquiry.mailto} className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-center text-sm font-bold text-sky-700">
                Email sales
              </a>
            </div>
          </form>

          {fallbackText ? (
            <div className="mt-6">
              <div className="mb-2 text-sm font-bold text-slate-700">Order draft backup</div>
              <textarea readOnly value={fallbackText} onFocus={(event) => event.currentTarget.select()} rows="11" className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-5 text-slate-700 outline-none" />
            </div>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Readiness score</div>
            <div className="mt-3 flex items-end gap-3">
              <div className="text-5xl font-bold text-slate-950">{score}</div>
              <div className="pb-2 text-sm font-semibold text-slate-500">/ 99</div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-sky-600" style={{ width: `${score}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Higher score means sales and operations have enough detail to quote, confirm documents, assign suppliers and create order milestones quickly.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Door-to-door lifecycle</h2>
            <div className="mt-4 space-y-3">
              {milestoneTemplates.map(([title, description], index) => (
                <div key={title} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-sky-200 bg-sky-50 p-5">
            <h2 className="text-lg font-bold text-sky-950">What happens next</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-sky-800">
              <li>1. The draft enters the lead pool with attribution and score.</li>
              <li>2. Sales confirms quote, incoterm and customer documents.</li>
              <li>3. Operations converts it into an internal managed order.</li>
              <li>4. Cost center and suppliers support route/cost matching.</li>
              <li>5. Finance generates receivable/payable after order confirmation.</li>
            </ul>
          </section>
        </aside>
      </section>
    </main>
  );
}
