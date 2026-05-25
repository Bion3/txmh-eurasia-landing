import React from "react";
import EurasiaMap from "../components/EurasiaMap";

const pageCopy = {
  zh: {
    heroTitle: "中欧铁路拼箱物流",
    heroSubtitle: "15-20 天稳定时效 | 拼箱集运 | 清关派送一站式服务",
    primaryCta: "获取报价",
    secondaryCta: "联系我们",
    whyTitle: "为什么选择我们",
    strengths: [
      { title: "15-20 天", desc: "稳定的中欧铁路运输时效" },
      { title: "欧盟覆盖", desc: "德国、波兰、法国、意大利等主要市场" },
      { title: "拼箱专家", desc: "适合小批量、多频次货物，成本更可控" },
      { title: "门到门", desc: "集运、清关、末端派送整合交付" },
    ],
    servicesTitle: "核心服务",
    networkTitle: "服务网络",
    processTitle: "服务流程",
    process: ["提交询价", "确认报价", "安排发运", "追踪签收"],
    finalTitle: "准备从中国发货到欧洲？",
    finalCta: "立即获取报价",
  },
  en: {
    heroTitle: "China-Europe Rail LCL Logistics",
    heroSubtitle: "15-20 day transit | LCL consolidation | Customs and final-mile delivery",
    primaryCta: "Get a Quote",
    secondaryCta: "Contact Us",
    whyTitle: "Why Choose Us",
    strengths: [
      { title: "15-20 Days", desc: "Stable China-Europe rail transit" },
      { title: "EU Coverage", desc: "Germany, Poland, France, Italy and more" },
      { title: "LCL Experts", desc: "Cost-efficient consolidation for smaller shipments" },
      { title: "Door-to-Door", desc: "Consolidation, customs and delivery in one flow" },
    ],
    servicesTitle: "Core Services",
    networkTitle: "Our Network",
    processTitle: "How It Works",
    process: ["Submit Inquiry", "Confirm Quote", "Ship Cargo", "Track & Receive"],
    finalTitle: "Ready to ship from China to Europe?",
    finalCta: "Get Quote Now",
  },
};

export default function HomePage({ locale = "en", text, changePage }) {
  const copy = pageCopy[locale] || pageCopy.en;
  const services = text.home.services || [];

  return (
    <div className="bg-white text-gray-900">
      <section
        className="relative min-h-[calc(100vh-65px)] flex flex-col justify-center items-center text-center px-5 py-16 bg-cover bg-center bg-gray-800 text-white"
        style={{ backgroundImage: "url('/hero-background.jpg')" }}
      >
        <div className="absolute inset-0 bg-slate-950/55" aria-hidden="true" />
        <div className="relative z-10 w-full max-w-4xl">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            {copy.heroTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/90 md:text-xl">
            {copy.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => changePage("quote")}
              className="w-full rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
            >
              {copy.primaryCta}
            </button>
            <button
              type="button"
              onClick={() => changePage("about")}
              className="w-full rounded-xl border border-white/80 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-white hover:text-gray-900 sm:w-auto"
            >
              {copy.secondaryCta}
            </button>
          </div>
        </div>
      </section>

      <section className="py-16 text-center md:py-20">
        <h2 className="mb-12 text-3xl font-semibold">{copy.whyTitle}</h2>
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-4">
          {copy.strengths.map((item) => (
            <div key={item.title} className="flex flex-col items-center">
              <h3 className="text-2xl font-bold text-blue-600">{item.title}</h3>
              <p className="mt-2 text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-3xl font-semibold">{copy.servicesTitle}</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {services.slice(0, 3).map((service) => (
              <div key={service.title} className="rounded-xl bg-white p-8 shadow-md transition-shadow hover:shadow-lg">
                <h3 className="mb-2 text-xl font-bold">{service.title}</h3>
                <p className="text-gray-600">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <h2 className="mb-12 text-center text-3xl font-semibold">{copy.networkTitle}</h2>
        <EurasiaMap text={text} />
      </section>

      <section className="bg-gray-50 py-16 text-center md:py-20">
        <h2 className="mb-12 text-3xl font-semibold">{copy.processTitle}</h2>
        <div className="mx-auto grid max-w-4xl gap-4 px-6 text-lg font-medium text-gray-700 md:grid-cols-4">
          {copy.process.map((step, index) => (
            <div key={step} className="p-4">
              {index + 1}. {step}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-blue-700 py-20 text-center text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-6 text-3xl font-bold">{copy.finalTitle}</h2>
          <button
            type="button"
            onClick={() => changePage("quote")}
            className="rounded-xl bg-white px-10 py-4 text-lg font-bold text-blue-700 transition-colors hover:bg-gray-200"
          >
            {copy.finalCta}
          </button>
        </div>
      </section>
    </div>
  );
}
