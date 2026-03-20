export default function MiniTMSSection({ t, changePage }) {
  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "quote", label: "Quote Center" },
    { key: "crm", label: "CRM" },
    { key: "schedule", label: "Train Schedule" },
    { key: "network", label: "EU Delivery Map" },
    { key: "shipment", label: "Shipment Detail" },
  ];

  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="rounded-3xl bg-slate-900 text-white p-10">
          <h2 className="text-3xl font-bold mb-4">{t.miniTms.title}</h2>
          <p className="text-slate-300 mb-6 max-w-3xl">{t.miniTms.desc}</p>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => changePage('tms')}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition text-sm"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => changePage('tms')}
            className="px-6 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 font-semibold"
          >
            {t.nav.tms}
          </button>
        </div>
      </div>
    </section>
  )
}