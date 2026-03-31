import React, { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function QuoteCalculator({
  locale = 'en',
  mode = 'public', // 'public' | 'admin'
  onSaveToCRM,
}) {
  const [formData, setFormData] = useState({
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
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const estimate = useMemo(() => {
    const volume = parseFloat(formData.volume || '0');
    const weight = parseFloat(formData.weight || '0');

    // 简单原型估算逻辑（后面可以替换成真实报价规则）
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSubmitError('');
    setSuccessMsg('');
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
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
      notes: '',
    });
  };

  const buildLeadPayload = () => {
    const route = `${formData.pol || ''} to ${formData.pod || ''}`.trim();

    const cargoDetails = [
      formData.containerType ? `Type: ${formData.containerType}` : '',
      formData.cargo ? `Cargo: ${formData.cargo}` : '',
      formData.volume ? `Volume: ${formData.volume} CBM` : '',
      formData.weight ? `Weight: ${formData.weight} KG` : '',
      formData.incoterm ? `Incoterm: ${formData.incoterm}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      customer_name: formData.name || '',
      email: formData.email || '',
      route,
      cargo_details: cargoDetails,
      status: 'New',
    };
  };

  const insertLeadDirectly = async () => {
    const leadPayload = buildLeadPayload();

    const { error } = await supabase.from('leads').insert([leadPayload]);

    if (error) {
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setSuccessMsg('');

    try {
      // 基础校验
      if (!formData.name || !formData.email || !formData.pol || !formData.pod) {
        throw new Error('Please fill in Name, Email, POL, and POD.');
      }

      // Admin 模式：如果外部传入了 onSaveToCRM，则交给父组件处理
      if (mode === 'admin' && typeof onSaveToCRM === 'function') {
        await onSaveToCRM(formData);
        setSuccessMsg('Quote saved to CRM successfully.');
        return;
      }

      // Public 模式（或 admin 没传 onSaveToCRM）：直接写 leads
      await insertLeadDirectly();

      setSuccessMsg(
        mode === 'public'
          ? 'Thank you! Your inquiry has been submitted. Our team will contact you shortly.'
          : 'Quote saved successfully.'
      );

      resetForm();
    } catch (err) {
      console.error('Quote submit failed:', err);
      setSubmitError(err.message || 'Failed to submit inquiry.');
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
              ? 'Fill in the shipment details and our team will get back to you.'
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
                <label className="block text-sm text-slate-600 mb-2">Email *</label>
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
                <label className="block text-sm text-slate-600 mb-2">Phone</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="+86 / +49 / +44"
                />
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
                ? 'Submit Inquiry'
                : 'Save to CRM'}
            </button>
          </div>
        </form>
      </div>

      {/* Right: Estimate / Info */}
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">Quick Estimate</h3>
              <p className="text-sm text-slate-500 mt-1">Indicative only</p>
            </div>

            <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              Prototype
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