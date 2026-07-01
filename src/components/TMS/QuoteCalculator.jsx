import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { leadsApi } from '../../api';
import { usePersistentFormDraft } from '../../hooks/usePersistentFormDraft';
import { captureAcquisitionAttribution } from '../../lib/acquisitionAttribution';
import { buildFallbackInquiry } from '../../lib/publicInquiryFallback';

function resolveShipmentType(serviceType) {
  if (serviceType === 'FCL') return 'FCL';
  if (serviceType === 'air_cargo') return 'air_cargo';
  return 'LCL';
}

function estimateQuoteLeadScore(formData) {
  let score = 42;
  if (formData.email?.trim()) score += 10;
  if (formData.phone?.trim()) score += 12;
  if (formData.company?.trim()) score += 8;
  if (formData.pol?.trim() && formData.pod?.trim()) score += 18;
  if (formData.volume || formData.weight) score += 10;
  if (formData.readyDate === 'this_week' || formData.readyDate === 'this_month') score += 12;
  if (formData.serviceScope === 'door_to_door' || formData.incoterm === 'DDP') score += 8;
  return Math.min(score, 98);
}

function quoteIntentLevel(score) {
  if (score >= 80) return 'hot';
  if (score >= 58) return 'warm';
  return 'cold';
}

const defaultQuoteForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  pol: '',
  pod: '',
  cargo: '',
  containerType: 'LCL',
  volume: '',
  weight: '',
  incoterm: 'EXW',
  serviceScope: 'port_to_port',
  readyDate: 'this_month',
  preferredContact: 'email',
  notes: '',
};

function prefillFromSearchParams(searchParams) {
  return {
    pol: searchParams.get('pol') || searchParams.get('origin') || '',
    pod: searchParams.get('pod') || searchParams.get('destination') || '',
    cargo: searchParams.get('cargo') || '',
    containerType: searchParams.get('containerType') || searchParams.get('shipment_type') || '',
    serviceScope: searchParams.get('serviceScope') || '',
    readyDate: searchParams.get('readyDate') || '',
  };
}

function prefillLabelFromSearchParams(searchParams) {
  return searchParams.get('lane') || [
    searchParams.get('pol') || searchParams.get('origin'),
    searchParams.get('pod') || searchParams.get('destination'),
  ].filter(Boolean).join(' -> ');
}

function mergeQuotePrefill(base, prefill) {
  return Object.entries(prefill).reduce(
    (next, [key, value]) => (value ? { ...next, [key]: value } : next),
    base
  );
}

function buildQuoteInquiryEmail(formData, selectedLane) {
  const route = [formData.pol || '-', formData.pod || '-'].join(' -> ');
  return buildFallbackInquiry({
    subject: `Quote request - ${selectedLane || route}`,
    lines: [
      'Source: public quote form',
      selectedLane ? `Selected lane: ${selectedLane}` : '',
      `Route: ${route}`,
      '',
      `Name: ${formData.name || '-'}`,
      `Company: ${formData.company || '-'}`,
      `Email: ${formData.email || '-'}`,
      `Phone / WhatsApp: ${formData.phone || '-'}`,
      `Preferred contact: ${formData.preferredContact || '-'}`,
      '',
      `Cargo: ${formData.cargo || '-'}`,
      `Service type: ${formData.containerType || '-'}`,
      `Volume CBM: ${formData.volume || '-'}`,
      `Weight KG: ${formData.weight || '-'}`,
      `Incoterm: ${formData.incoterm || '-'}`,
      `Service scope: ${formData.serviceScope || '-'}`,
      `Shipping window: ${formData.readyDate || '-'}`,
      `Notes: ${formData.notes || '-'}`,
      '',
      'Please confirm rail schedule, customs/delivery scope and firm customer quote.',
    ],
  });
}

function buildOrderDraftHref(formData, selectedLane) {
  const params = new URLSearchParams();
  if (formData.pol) params.set('pol', formData.pol);
  if (formData.pod) params.set('pod', formData.pod);
  if (formData.cargo) params.set('cargo', formData.cargo);
  if (selectedLane) params.set('lane', selectedLane);
  if (formData.containerType) params.set('shipment_type', formData.containerType === 'FBA' || formData.containerType === 'DDP' ? 'LCL' : formData.containerType);
  if (formData.serviceScope) params.set('serviceScope', formData.serviceScope);
  if (formData.incoterm) params.set('incoterm', formData.incoterm);
  const query = params.toString();
  return query ? `/order?${query}` : '/order';
}

export default function QuoteCalculator({
  locale = 'en',
  mode = 'public', // 'public' | 'admin'
  onSaveToCRM,
}) {
  const [searchParams] = useSearchParams();
  const searchParamKey = searchParams.toString();
  const routePrefill = useMemo(() => prefillFromSearchParams(searchParams), [searchParamKey, searchParams]);
  const selectedLane = useMemo(() => prefillLabelFromSearchParams(searchParams), [searchParamKey, searchParams]);
  const hasRoutePrefill = Boolean(routePrefill.pol || routePrefill.pod);
  const initialQuoteForm = useMemo(() => mergeQuotePrefill(defaultQuoteForm, routePrefill), [routePrefill]);
  const [formData, setFormData, quoteDraft] = usePersistentFormDraft(
    `eurasiago:${mode}-quote-form`,
    initialQuoteForm
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fallbackQuoteText, setFallbackQuoteText] = useState('');

  const estimate = useMemo(() => {
    const volume = parseFloat(formData.volume || '0');
    const weight = parseFloat(formData.weight || '0');

    // Public-facing quick estimate; the firm quote is confirmed by sales.
    const baseRate = 180; // USD / CBM
    const minCharge = 320; // minimum
    const fuelSecurity = 65;
    const docFee = 35;

    const freight = Math.max(volume * baseRate, minCharge);
    const weightFactor = weight > 0 ? Math.min(weight * 0.02, 120) : 0;
    const total = Math.round(freight + fuelSecurity + docFee + weightFactor);

    return {
      freight: Math.round(freight),
      surcharge: Math.round(fuelSecurity + docFee + weightFactor),
      total,
      currency: 'USD',
      transitDays: '18-25 days',
    };
  }, [formData.volume, formData.weight]);

  const leadScorePreview = useMemo(() => estimateQuoteLeadScore(formData), [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSubmitError('');
    setSuccessMsg('');
    setFallbackQuoteText('');
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    quoteDraft.clearDraft(initialQuoteForm);
  };

  const clearRoutePrefill = () => {
    setFallbackQuoteText('');
    setFormData((prev) => ({
      ...prev,
      pol: '',
      pod: '',
      cargo: '',
      containerType: 'LCL',
      serviceScope: 'port_to_port',
      readyDate: 'this_month',
    }));
  };

  useEffect(() => {
    if (!Object.values(routePrefill).some(Boolean)) return;
    setFormData((prev) => mergeQuotePrefill(prev, routePrefill));
  }, [routePrefill]);

  const buildLeadPayload = () => {
    const attribution = captureAcquisitionAttribution({
      defaultSourceType: mode === 'public' ? 'website_form' : 'internal_quote_tool',
      touchpoint: mode === 'public' ? `public_quote_widget:${formData.containerType}` : `internal_quote_tool:${formData.containerType}`,
    });
    const leadScore = estimateQuoteLeadScore(formData);

    return {
      company_name: formData.company || formData.name || 'Individual Customer',
      contact_name: formData.name || '',
      email: formData.email || null,
      phone: formData.phone || null,
      origin: formData.pol || '',
      destination: formData.pod || '',
      cargo_desc: formData.cargo || null,
      volume_cbm: formData.volume ? Number(formData.volume) : 0,
      weight_kg: formData.weight ? Number(formData.weight) : 0,
      ...attribution.leadFields,
      website_visit: attribution.websiteVisit,
      intent_level: quoteIntentLevel(leadScore),
      lead_score: leadScore,
      transport_mode_interest: 'rail',
      shipment_type_interest: resolveShipmentType(formData.containerType),
      message: [
        formData.notes,
        `Incoterm: ${formData.incoterm}`,
        `Service: ${formData.containerType}`,
        `Scope: ${formData.serviceScope}`,
        `Shipping window: ${formData.readyDate}`,
        `Preferred contact: ${formData.preferredContact}`,
        selectedLane ? `Selected lane: ${selectedLane}` : '',
        ...attribution.messageLines,
      ]
        .filter(Boolean)
        .join(' | '),
      status: 'new',
    };
  };

  const insertLeadDirectly = async () => {
    await leadsApi.create(buildLeadPayload());
  };

  const handleCopyQuoteInquiry = async () => {
    const { text } = buildQuoteInquiryEmail(formData, selectedLane);
    setFallbackQuoteText(text);

    try {
      await navigator.clipboard.writeText(text);
      setSuccessMsg('Quote request details copied. You can paste them into email or WhatsApp.');
      setSubmitError('');
    } catch (error) {
      setSubmitError('Browser clipboard is unavailable. Quote request details are shown below for manual copy.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setSuccessMsg('');

    try {
      // 基础校验
      if (!formData.name || (!formData.email && !formData.phone) || !formData.pol || !formData.pod) {
        throw new Error('Please fill in Name, Email or WhatsApp, POL, and POD.');
      }

      // Admin 模式：如果外部传入了 onSaveToCRM，则交给父组件处理
      if (mode === 'admin' && typeof onSaveToCRM === 'function') {
        await onSaveToCRM(formData);
        setSuccessMsg('Quote saved to CRM successfully.');
        return;
      }

      // Public 模式（或 admin 没传 onSaveToCRM）：直接写 leads
      await insertLeadDirectly();

      setFallbackQuoteText('');
      setSuccessMsg(
        mode === 'public'
          ? 'Thank you! Your inquiry has been submitted. Our team will contact you shortly.'
          : 'Quote saved successfully.'
      );

      resetForm();
    } catch (err) {
      console.error('Quote submit failed:', err);
      const isCompletePublicInquiry = mode === 'public' && formData.name && (formData.email || formData.phone) && formData.pol && formData.pod;
      if (isCompletePublicInquiry) {
        const { text } = buildQuoteInquiryEmail(formData, selectedLane);
        setFallbackQuoteText(text);
        setSubmitError('The database form is temporarily unavailable. Your quote request details are preserved below so you can email them directly.');
      } else {
        setFallbackQuoteText('');
        setSubmitError(err.message || 'Failed to submit inquiry.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6">
      {/* Left: Form */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="mb-6">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
            {mode === 'public' ? 'PUBLIC QUOTE REQUEST' : 'INTERNAL QUOTE TOOL'}
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-4">
            {mode === 'public' ? 'Request a Rail LCL Quote' : 'Rail Quote Simulator'}
          </h2>

          <p className="text-slate-500 mt-2">
            {mode === 'public'
              ? 'Share the shipment details and one contact method. Our team will confirm a firm quote after checking route, schedule, and delivery scope.'
              : 'Internal quotation tool for testing, lead capture, and CRM sync.'}
          </p>
        </div>

        {submitError && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {submitError}
          </div>
        )}

        {successMsg && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm">
            {successMsg}
          </div>
        )}

        {quoteDraft.draftRestored && (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 text-sm">
            <span>Restored your unsent quote request draft.</span>
            <button
              type="button"
              onClick={() => {
                quoteDraft.clearDraft(initialQuoteForm);
                setFallbackQuoteText('');
                setSubmitError('');
                setSuccessMsg('Saved quote draft cleared.');
              }}
              className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-700"
            >
              Clear draft
            </button>
          </div>
        )}

        {mode === 'public' && hasRoutePrefill ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold">Route prefilled from popular lane</div>
                <div className="mt-1">
                  {selectedLane || `${formData.pol || 'Origin'} -> ${formData.pod || 'Destination'}`}
                </div>
              </div>
              <button
                type="button"
                onClick={clearRoutePrefill}
                className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700"
              >
                Clear route
              </button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Contact Information
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Name *</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Company</label>
                <input
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Company name"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Phone / WhatsApp</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="+86 / +49 / +44"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Preferred Contact</label>
                <select
                  name="preferredContact"
                  value={formData.preferredContact}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone call</option>
                </select>
              </div>
            </div>
          </div>

          {/* Shipment */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Shipment Details
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-2">POL (Origin) *</label>
                <input
                  name="pol"
                  value={formData.pol}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="e.g. Xi'an / Chengdu / Chongqing"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">POD (Destination) *</label>
                <input
                  name="pod"
                  value={formData.pod}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="e.g. Hamburg / Warsaw / Duisburg"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Cargo Type</label>
                <input
                  name="cargo"
                  value={formData.cargo}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="e.g. general cargo / FBA / electronics"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Service Type</label>
                <select
                  name="containerType"
                  value={formData.containerType}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  <option value="LCL">LCL</option>
                  <option value="FCL">FCL</option>
                  <option value="FBA">FBA</option>
                  <option value="DDP">DDP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Volume (CBM)</label>
                <input
                  type="number"
                  step="0.1"
                  name="volume"
                  value={formData.volume}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="e.g. 2.5"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Weight (KG)</label>
                <input
                  type="number"
                  step="1"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="e.g. 680"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Incoterm</label>
                <select
                  name="incoterm"
                  value={formData.incoterm}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  <option value="EXW">EXW</option>
                  <option value="FOB">FOB</option>
                  <option value="DAP">DAP</option>
                  <option value="DDP">DDP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Service Scope</label>
                <select
                  name="serviceScope"
                  value={formData.serviceScope}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  <option value="port_to_port">Port / terminal to terminal</option>
                  <option value="door_to_door">Door to door</option>
                  <option value="customs_delivery">Customs + final-mile delivery</option>
                  <option value="fba_delivery">Amazon FBA delivery</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Shipping Window</label>
                <select
                  name="readyDate"
                  value={formData.readyDate}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  <option value="this_week">This week</option>
                  <option value="this_month">This month</option>
                  <option value="next_month">Next month</option>
                  <option value="planning">Planning / comparing rates</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-slate-600 mb-2">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Any special requirements, delivery needs, customs notes, or Amazon FBA details"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full md:w-auto px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold transition"
            >
              {submitting
                ? 'Submitting...'
                : mode === 'public'
                ? 'Request Firm Quote'
                : 'Save to CRM'}
            </button>
          </div>
          {mode === 'public' ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={buildQuoteInquiryEmail(formData, selectedLane).mailto}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
              >
                Email backup
              </a>
              <button
                type="button"
                onClick={handleCopyQuoteInquiry}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-emerald-300"
              >
                Copy quote details
              </button>
              <a
                href={buildOrderDraftHref(formData, selectedLane)}
                className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-bold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
              >
                Create order draft
              </a>
            </div>
          ) : null}
          {fallbackQuoteText ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                Email fallback content
              </div>
              <textarea
                readOnly
                value={fallbackQuoteText}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-2 min-h-48 w-full rounded-2xl border border-amber-200 bg-white p-3 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          ) : null}
        </form>
      </div>

      {/* Right: Estimate / Info */}
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">Quick Estimate</h3>
              <p className="text-sm text-slate-500 mt-1">Indicative only, not a final quotation</p>
            </div>

            <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
              Lead score {leadScorePreview}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="text-sm text-slate-500">Estimated Freight</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">
                {estimate.currency} {estimate.freight}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="text-sm text-slate-500">Estimated Surcharges</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {estimate.currency} {estimate.surcharge}
              </div>
            </div>

            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <div className="text-sm text-emerald-700">Indicative Total</div>
              <div className="text-4xl font-bold text-emerald-700 mt-1">
                {estimate.currency} {estimate.total}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="text-sm text-slate-500">Estimated Transit</div>
              <div className="text-xl font-semibold text-slate-900 mt-1">
                {estimate.transitDays}
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
              <div className="text-sm font-semibold text-amber-800">What happens next</div>
              <div className="mt-2 text-sm leading-6 text-amber-800">
                We will verify sailing/rail schedule, customs scope, and final-mile requirements before sending a firm customer quote.
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Service Notes</h3>
          <ul className="space-y-3 text-sm text-slate-600">
            <li>• Final pricing depends on route, departure week, customs, and last-mile delivery scope.</li>
            <li>• LCL cargo may be subject to minimum charge and terminal handling fees.</li>
            <li>• Amazon FBA / DDP / EU delivery requests may require additional compliance checks.</li>
            <li>• This quote widget is for rapid lead capture and preliminary estimation only.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
