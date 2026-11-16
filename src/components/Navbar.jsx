import { useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link, NavLink } from "react-router";

export default function Navbar({ locale, text, currentPage, toggleLocale }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const navItems = [
    { page: "home", to: "/", label: text.nav.home },
    { page: "route", to: "/routes", label: locale === "zh" ? "线路" : "Routes" },
    { page: "quote", to: "/quote", label: text.nav.quote },
    { page: "about", to: "/about", label: text.nav.about },
  ];

  const navItemClass = (page) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition ${
      currentPage === page
        ? "bg-blue-600 text-white"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-3 text-left"
          onClick={() => setIsMenuOpen(false)}
        >
          <span className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center font-bold">
            EG
          </span>
          <span>
            <span className="block font-bold text-gray-900">EurasiaGo</span>
            <span className="block text-xs text-gray-500">Rail LCL & Logistics</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <nav className="hidden lg:flex items-center gap-2" aria-label="Primary navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.page}
                to={item.to}
                className={navItemClass(item.page)}
                onClick={() => setIsMenuOpen(false)}
                aria-current={currentPage === item.page ? "page" : undefined}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAccountOpen((open) => !open)}
              aria-expanded={isAccountOpen}
              aria-haspopup="menu"
              className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition whitespace-nowrap"
            >
              {locale === "zh" ? "客户登录 / 账户" : "Sign in / Account"}
            </button>
            {isAccountOpen && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg z-[70]">
                <a role="menuitem" href="https://crm.eurasiago.com/client.html" className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50" onClick={() => setIsAccountOpen(false)}>{locale === "zh" ? "登录 / 我的账户" : "Sign in / My Account"}</a>
                <a role="menuitem" href="https://crm.eurasiago.com/client.html?section=inquiries" className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50" onClick={() => setIsAccountOpen(false)}>{locale === "zh" ? "我的询价" : "My Inquiries"}</a>
                <a role="menuitem" href="https://crm.eurasiago.com/client.html?section=orders" className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50" onClick={() => setIsAccountOpen(false)}>{locale === "zh" ? "我的订单" : "My Orders"}</a>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-200 hidden lg:block" aria-hidden="true" />

          <button
            type="button"
            onClick={toggleLocale}
            className="px-3 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>

          <button
            type="button"
            className="lg:hidden p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? "Close menu" : "打开菜单"}
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
        <nav className="lg:hidden border-t border-gray-200 bg-white px-4 py-3 shadow-sm" aria-label="Mobile navigation">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.page}
                to={item.to}
                className={`${navItemClass(item.page)} text-left`}
                onClick={() => setIsMenuOpen(false)}
                aria-current={currentPage === item.page ? "page" : undefined}
              >
                {item.label}
              </NavLink>
            ))}
            <a
              href="https://crm.eurasiago.com/client.html"
              className="px-4 py-2 rounded-xl text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition whitespace-nowrap"
              onClick={() => setIsMenuOpen(false)}
            >
              {locale === "zh" ? "客户中心" : "Customer Portal"}
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
