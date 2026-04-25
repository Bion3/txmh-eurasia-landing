import React from 'react';

export default function QuotePage({ locale, text, formData, handleChange, handleSubmit }) {
  return (
    <main>
      <section className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            {text.quote.title}
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            {text.quote.subtitle}
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-6 py-14">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-8">
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
        </div>
      </section>
    </main>
  );
}
