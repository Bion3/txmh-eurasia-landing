import EurasiaMap from "../components/EurasiaMap";

export default function HomePage({
  locale,
  text,
  changePage,
  formData,
  handleChange,
  handleSubmit
}) {
  return (
    <main>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
              TXMH-Eurasia
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight text-gray-900">
              {text.hero.title}
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-8">
              {text.hero.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={() => changePage("quote")}
                className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
              >
                {text.hero.cta1}
              </button>
              <button
                onClick={() => changePage("TMS")}
                className="px-6 py-3 rounded-2xl border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50 transition"
              >
                {text.hero.cta2}
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-gray-200 shadow-xl p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-gray-50 p-5 border border-gray-100">
                <div className="text-sm text-gray-500">{locale === "zh" ? "铁路拼箱" : "Rail LCL"}</div>
                <div className="mt-2 text-2xl font-bold">LCL</div>
              </div>
              <div className="rounded-2xl bg-gray-50 p-5 border border-gray-100">
                <div className="text-sm text-gray-500">{locale === "zh" ? "欧洲配送" : "EU Delivery"}</div>
                <div className="mt-2 text-2xl font-bold">8+ Nodes</div>
              </div>
              <div className="rounded-2xl bg-gray-50 p-5 border border-gray-100">
                <div className="text-sm text-gray-500">{locale === "zh" ? "中欧班列" : "Rail Transit"}</div>
                <div className="mt-2 text-2xl font-bold">16-24D</div>
              </div>
              <div className="rounded-2xl bg-gray-50 p-5 border border-gray-100">
                <div className="text-sm text-gray-500">{locale === "zh" ? "Mini TMS" : "Mini TMS"}</div>
                <div className="mt-2 text-2xl font-bold">Prototype</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Coverage Map */}
      <section className="bg-gray-50 py-14">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{text.home.coverageTitle}</h2>
          <p className="text-gray-600 max-w-4xl leading-8 mb-8">{text.home.coverageText}</p>
          <EurasiaMap />
        </div>
      </section>

      {/* Services */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-14">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">{text.home.servicesTitle}</h2>
        <div className="grid md:grid-cols-4 gap-5">
          {[text.home.service1, text.home.service2, text.home.service3, text.home.service4].map(
            (service, index) => (
              <div
                key={index}
                className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{service}</h3>
              </div>
            )
          )}
        </div>
      </section>

      {/* Mini TMS Intro */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-14">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 md:p-10">
          <h2 className="text-3xl font-bold">{text.home.tmsTitle}</h2>
          <p className="mt-4 text-blue-100 max-w-3xl leading-8">{text.home.tmsText}</p>
          <button
            onClick={() => changePage("TMS")}
            className="mt-6 px-6 py-3 rounded-2xl bg-white text-blue-700 font-semibold hover:bg-blue-50 transition"
          >
            {locale === "zh" ? "进入系统原型" : "Open Prototype"}
          </button>
        </div>
      </section>

      {/* Quick Quote */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-14">
        <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">{text.quote.title}</h2>

          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-5">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={text.quote.name}
              className="w-full px-4 py-3 rounded-2xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={text.quote.email}
              className="w-full px-4 py-3 rounded-2xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              type="text"
              name="route"
              value={formData.route}
              onChange={handleChange}
              placeholder={text.quote.route}
              className="w-full px-4 py-3 rounded-2xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-200 md:col-span-2"
            />
            <textarea
              name="cargo"
              value={formData.cargo}
              onChange={handleChange}
              placeholder={text.quote.cargo}
              rows={5}
              className="w-full px-4 py-3 rounded-2xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-200 md:col-span-2"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition w-fit"
            >
              {text.quote.submit}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}