import React from 'react';
import QuoteCalculator from '../components/TMS/QuoteCalculator';

export default function QuotePage({ locale = 'en' }) {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="px-6 md:px-10 pt-16 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-3xl p-8 md:p-12 text-white shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-100">
              TXMH Eurasia Rail
            </p>
            <h1 className="text-3xl md:text-5xl font-bold mt-3 leading-tight">
              Get Your Rail LCL Quote
            </h1>
            <p className="text-emerald-50 text-base md:text-lg mt-4 max-w-3xl">
              Submit your shipment details for China–Europe rail LCL pricing.
              Our team will review and contact you with the best available route,
              transit plan, and delivery option.
            </p>
          </div>
        </div>
      </section>

      {/* Quote Form */}
      <section className="px-6 md:px-10 pb-16">
        <div className="max-w-6xl mx-auto">
          <QuoteCalculator locale={locale} mode="public" />
        </div>
      </section>
    </main>
  );
}