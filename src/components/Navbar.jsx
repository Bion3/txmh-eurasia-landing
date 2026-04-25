﻿export default function Navbar({ locale, text, currentPage, changePage, toggleLocale }) {
  const navItemClass = (page) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition ${
      currentPage === page
        ? "bg-blue-600 text-white"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => changePage("home")}
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center font-bold">
            EG
          </div>
          <div>
            <div className="font-bold text-gray-900">EurasiaGo</div>
            <div className="text-xs text-gray-500">Rail LCL & Logistics</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-2">
            <button className={navItemClass("home")} onClick={() => changePage("home")}>
              {text.nav.home}
            </button>
            <button className={navItemClass("TMS")} onClick={() => changePage("TMS")}>
              {text.nav.tms}
            </button>
            <button className={navItemClass("about")} onClick={() => changePage("about")}>
              {text.nav.about}
            </button>
            <button className={navItemClass("quote")} onClick={() => changePage("quote")}>
              {text.nav.quote}
            </button>
          </nav>

          <button
            onClick={toggleLocale}
            className="px-3 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50"
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </div>
    </header>
  );
}