import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import HomePage from "./page/HomePage";
import TMSPage from "./page/TMSPage";
import { i18n } from "./data/i18n";

export default function App() {
  const [locale, setLocale] = useState(() => localStorage.getItem("txmh_locale") || "en");
  const [currentPage, setCurrentPage] = useState("home");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    route: "",
    cargo: ""
  });

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 先做前端演示版
    console.log("Inquiry submitted:", formData);

    alert(
      locale === "zh"
        ? "询价已提交（演示版）。下一步可接入邮箱 / Supabase / API。"
        : "Inquiry submitted (demo mode). Next step: connect Email / Supabase / API."
    );

    setFormData({
      name: "",
      email: "",
      route: "",
      cargo: ""
    });
  };

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return (
          <HomePage
            locale={locale}
            text={text}
            changePage={changePage}
            formData={formData}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
          />
        );

      case "tms":
        return <TMSPage locale={locale} text={text} />;

      case "quote":
        return (
          <HomePage
            locale={locale}
            text={text}
            changePage={changePage}
            formData={formData}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
          />
        );

      default:
        return (
          <HomePage
            locale={locale}
            text={text}
            changePage={changePage}
            formData={formData}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
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

      {renderPage()}

      <footer className="border-t border-gray-200 mt-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 text-sm text-gray-500">
          © 2026 TXMH-Eurasia · Rail LCL · Europe Delivery · Mini TMS Prototype
        </div>
      </footer>
    </div>
  );
}