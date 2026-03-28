import React from "react";
import EurasiaMapSvg from "./EurasiaMapSvg";

export default function EurasiaMap({ text }) {
  return (
    <section className="pt-8 pb-16 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="mb-8 md:mb-10">
          <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            TXMH Eurasia Coverage
          </div>

          <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            {text.home.service5.title}
          </h2>

          <p className="mt-3 text-slate-600 max-w-3xl leading-relaxed">
            {text.home.service5.desc}
          </p>
        </div>

        <EurasiaMapSvg mapText={text.map} />
      </div>
    </section>
  );
}