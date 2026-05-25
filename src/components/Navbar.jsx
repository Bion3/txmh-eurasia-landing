import { useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

export default function Navbar({ locale, text, currentPage, changePage, toggleLocale }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { page: "home", label: text.nav.home },
    { page: "quote", label: text.nav.quote },
    { page: "about", label: text.nav.about },
  ];

  const navItemClass = (page) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition ${
      currentPage === page
        ? "bg-blue-600 text-white"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  const handlePageChange = (page) => {
    changePage(page);
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-3 text-left"
          onClick={() => handlePageChange("home")}
        >
          <span className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center font-bold">
            EG
          </span>
          <span>
            <span className="block font-bold text-gray-900">EurasiaGo</span>
            <span className="block text-xs text-gray-500">Rail LCL & Logistics</span>
          </span>
        </button>

        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center gap-2" aria-label="Primary navigation">
            {navItems.map((item) => (
              <button
                key={item.page}
                type="button"
                className={navItemClass(item.page)}
                onClick={() => handlePageChange(item.page)}
                aria-current={currentPage === item.page ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="w-px h-6 bg-gray-200 hidden md:block" aria-hidden="true" />

          <button
            type="button"
            onClick={toggleLocale}
            className="px-3 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
          >
            {locale === "zh" ? "EN" : "����"}
          </button>

          <button
            type="button"
            className="md:hidden p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? "Close menu" : "����"}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <nav className="md:hidden border-t border-gray-200 bg-white px-4 py-3 shadow-sm" aria-label="Mobile navigation">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <button
                key={item.page}
                type="button"
                className={`${navItemClass(item.page)} text-left`}
                onClick={() => handlePageChange(item.page)}
                aria-current={currentPage === item.page ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}