import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import HomePage from "./page/HomePage";
import TMSPage from "./page/TMSPage";
import { i18n } from "./data/i18n";
import { addLead } from "./store/crmStore";

export default function App() {
  const [locale, setLocale] = useState(() => localStorage.getItem("txmh_locale") || "en");
  const [currentPage, setCurrentPage] = useState("home");
  const [crmRefreshKey, setCrmRefreshKey] = useState(0);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newLead = {
      customer_name: formData.name,
      email: formData.email,
      route: formData.route,
      cargo_details: formData.cargo,
      status: 'New'
    };

    await addLead(newLead);

    alert(
      locale === "zh"
        ? "询价已提交，可在 TMS 系统查看！"
        : "Inquiry submitted. Check it in TMS!"
    );

    setFormData({
      name: "",
      email: "",
      route: "",
      cargo: ""
    });

    setCrmRefreshKey((prev) => prev + 1);
    setCurrentPage("TMS");
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

      case "TMS":
        return <TMSPage locale={locale} text={text} refreshKey={crmRefreshKey} />;

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
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 text-sm text-gray-500 flex justify-between items-center">
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