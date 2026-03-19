import React, { useMemo, useState } from 'react';

export default function QuoteCalculator({ locale = 'en' }) {
  const [form, setForm] = useState({
    pol: 'XIAN',
    pod: 'HAMBURG',
    cbm: 3.2,
    kg: 680,
    ldm: 0,
    delivery: true,
    customs: false,
    urgency: 'standard',
  });

  const t = {
    zh: {
      title: 'Quote Calculator 报价测算',
      subtitle: '用于官网展示 + 内部快速报价原型，可后续接真实费率表',
      pol: '起运站',
      pod: '目的站',
      cbm: '体积 (CBM)',
      kg: '重量 (KG)',
      ldm: '占板 (LDM)',
      delivery: '欧洲派送',
      customs: '递延清关',
      urgency: '时效等级',
      standard: '标准',
      express: '优先',
      calc: '测算结果',
      baseRail: '铁路干线',
      fuel: '附加费',
      deliveryFee: '派送费',
      customsFee: '递延清关',
      urgencyFee: '时效附加',
      total: '预估总价',
      note: '说明：当前为展示版逻辑，后续可接你的 Excel / Supabase 费率表。',
    },
    en: {
      title: 'Quote Calculator',
      subtitle: 'Display-ready prototype for fast internal quoting. Can later connect to real tariff tables.',
      pol: 'POL',
      pod: 'POD',
      cbm: 'Volume (CBM)',
      kg: 'Weight (KG)',
      ldm: 'LDM',
      delivery: 'EU Delivery',
      customs: 'Deferred Customs',
      urgency: 'Transit Priority',
      standard: 'Standard',
      express: 'Priority',
      calc: 'Estimate',
      baseRail: 'Rail Linehaul',
      fuel: 'Surcharges',
      deliveryFee: 'Delivery',
      customsFee: 'Deferred Customs',
      urgencyFee: 'Priority Fee',
      total: 'Estimated Total',
      note: 'Note: Prototype logic only. Can later connect to your Excel / Supabase tariff tables.',
    },
  }[locale];

  const pricing = useMemo(() => {
    const cbm = Number(form.cbm) || 0;
    const kg = Number(form.kg) || 0;
    const ldm = Number(form.ldm) || 0;

    const cbmPrice = 180;
    const kgFactor = 0.12;
    const ldmPrice = 420;

    const baseRail = cbm * cbmPrice + kg * kgFactor + ldm * ldmPrice;
    const fuel = Math.max(baseRail * 0.08, 35);
    const deliveryFee = form.delivery ? 280 : 0;
    const customsFee = form.customs ? 150 : 0;
    const urgencyFee = form.urgency === 'express' ? 120 : 0;

    const total = baseRail + fuel + deliveryFee + customsFee + urgencyFee;

    return {
      baseRail,
      fuel,
      deliveryFee,
      customsFee,
      urgencyFee,
      total,
    };
  }, [form]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const money = (num) => `€${Number(num).toFixed(2)}`;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-slate-900">{t.title}</h3>
        <p className="text-slate-500 mt-2">{t.subtitle}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-600">{t.pol}</label>
            <input
              value={form.pol}
              onChange={(e) => update('pol', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">{t.pod}</label>
            <input
              value={form.pod}
              onChange={(e) => update('pod', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">{t.cbm}</label>
            <input
              type="number"
              step="0.1"
              value={form.cbm}
              onChange={(e) => update('cbm', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">{t.kg}</label>
            <input
              type="number"
              value={form.kg}
              onChange={(e) => update('kg', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">{t.ldm}</label>
            <input
              type="number"
              step="0.1"
              value={form.ldm}
              onChange={(e) => update('ldm', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">{t.urgency}</label>
            <select
              value={form.urgency}
              onChange={(e) => update('urgency', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none bg-white"
            >
              <option value="standard">{t.standard}</option>
              <option value="express">{t.express}</option>
            </select>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4">
            <input
              type="checkbox"
              checked={form.delivery}
              onChange={(e) => update('delivery', e.target.checked)}
            />
            <span className="text-slate-700">{t.delivery}</span>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4">
            <input
              type="checkbox"
              checked={form.customs}
              onChange={(e) => update('customs', e.target.checked)}
            />
            <span className="text-slate-700">{t.customs}</span>
          </div>
        </div>

        {/* Result */}
        <div className="rounded-3xl bg-slate-50 border border-slate-200 p-5">
          <h4 className="text-lg font-bold text-slate-900 mb-4">{t.calc}</h4>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">{t.baseRail}</span>
              <span className="font-semibold">{money(pricing.baseRail)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t.fuel}</span>
              <span className="font-semibold">{money(pricing.fuel)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t.deliveryFee}</span>
              <span className="font-semibold">{money(pricing.deliveryFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t.customsFee}</span>
              <span className="font-semibold">{money(pricing.customsFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t.urgencyFee}</span>
              <span className="font-semibold">{money(pricing.urgencyFee)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>{t.total}</span>
              <span>{money(pricing.total)}</span>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">{t.note}</p>
        </div>
      </div>
    </div>
  );
}
