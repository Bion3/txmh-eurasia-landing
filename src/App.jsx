import { lazy, Suspense, useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import HomePage from "./page/HomePage";
import { i18n } from "./data/i18n";

const TMSPage = lazy(() => import("./page/TMSPage"));
const AboutPage = lazy(() => import("./page/AboutPage"));
const QuoteCalculator = lazy(() => import("./components/TMS/QuoteCalculator"));

export default function App() {
  const [locale, setLocale] = useState(() => localStorage.getItem("txmh_locale") || "en");
  const [currentPage, setCurrentPage] = useState("home");

  useEffect(() => {
    localStorage.setItem("txmh_locale", locale);
  }, [locale]);

  const text = i18n[locale];

  const toggleLocale = () => {
    setLocale((prev) => (prev === "zh" ? "en" : "zh"));
  };

  const changePage = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return (
          <HomePage
            locale={locale}
            text={text}
            changePage={changePage}
          />
        );

      case "TMS":
        return <TMSPage locale={locale} text={text} />;

      case "about":
        return <AboutPage locale={locale} text={text} />;

      case "quote":
        return (
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
            <QuoteCalculator locale={locale} mode="public" />
          </div>
        );

      default:
        return (
          <HomePage
            locale={locale}
            text={text}
            changePage={changePage}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar
        locale={locale}
        text={text}
        currentPage={currentPage}
        changePage={changePage}
        toggleLocale={toggleLocale}
      />

      <Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 text-sm text-gray-500" role="status">
            Loading...
          </div>
        }
      >
        {renderPage()}
      </Suspense>

      <footer className="border-t border-gray-200 mt-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 text-sm text-gray-500 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
          <span>© 2026 EurasiaGo · Rail LCL · Europe Delivery · Mini TMS Prototype</span>
          <div>
            <span>Contact: </span>
            <a href="mailto:Benjamin@eurasiago.com" className="hover:text-blue-600">
              Benjamin@eurasiago.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
