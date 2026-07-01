import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import Navbar from "./components/Navbar";
import PublicAiAssistant from "./components/PublicAiAssistant";
import PublicConversionBar from "./components/PublicConversionBar";
import HomePage from "./page/HomePage";
import { i18n } from "./data/i18n";
import { getRouteLandingPage } from "./data/routeLandingPages";
import { trackAcquisitionPageView } from "./lib/acquisitionAttribution";

const AboutPage = lazy(() => import("./page/AboutPage"));
const QuoteCalculator = lazy(() => import("./components/TMS/QuoteCalculator"));
const RouteIndexPage = lazy(() => import("./page/RouteIndexPage"));
const RouteLandingPage = lazy(() => import("./page/RouteLandingPage"));
const SelfServiceOrderPage = lazy(() => import("./page/SelfServiceOrderPage"));
const SystemPage = lazy(() => import("./page/SystemPage"));

const pagePaths = {
  home: "/",
  about: "/about",
  quote: "/quote",
  system: "/system/overview",
};

const siteUrl = "https://www.eurasiago.com";

const seoProfiles = {
  home: {
    title: "China to Europe Rail Freight | Rail LCL, Customs & Door Delivery",
    description:
      "China to Europe rail freight for LCL and FCL shipments. Rail consolidation, customs clearance, Amazon FBA and door-to-door delivery across Europe.",
    path: "/",
  },
  quote: {
    title: "Request a China-Europe Rail Freight Quote | EurasiaGo",
    description:
      "Request a firm quote for China-Europe rail LCL, FCL, customs clearance, Amazon FBA and EU door delivery. Share route, cargo and shipping window.",
    path: "/quote",
  },
  order: {
    title: "Self-Service China-Europe Logistics Order Draft | EurasiaGo",
    description:
      "Create a self-service China-Europe logistics order draft with pickup, customs, cargo, delivery and contact details for sales and operations follow-up.",
    path: "/order",
  },
  route: {
    title: "China-Europe Rail Routes | DDP, FBA, Germany & Poland Delivery",
    description:
      "Compare China-Europe rail freight routes and services for Germany door delivery, Amazon FBA, Europe DDP, Poland warehouses and Western Europe hubs.",
    path: "/routes",
  },
  about: {
    title: "About EurasiaGo | China-Europe Rail Logistics Partner",
    description:
      "EurasiaGo connects China and Europe with rail freight, LCL consolidation, customs coordination and final-mile delivery services.",
    path: "/about",
  },
  system: {
    title: "EurasiaGo CRM + TMS Workspace",
    description:
      "Internal logistics workspace for leads, customers, quotes, orders, cost control and financial settlement.",
    path: "/system/overview",
    robots: "noindex, nofollow",
  },
};

function currentPageFromPath(pathname) {
  if (pathname.startsWith("/system")) return "system";
  if (pathname.startsWith("/routes")) return "route";
  if (pathname.startsWith("/order")) return "order";
  if (pathname.startsWith("/quote")) return "quote";
  if (pathname.startsWith("/about")) return "about";
  return "home";
}

function seoProfileForLocation(currentPage, pathname) {
  if (currentPage === "route") {
    const slug = pathname.split("/").filter(Boolean)[1];
    const routePage = getRouteLandingPage(slug);
    if (routePage) {
      return {
        title: routePage.seoTitle,
        description: routePage.description,
        path: `/routes/${routePage.slug}`,
      };
    }
  }

  return seoProfiles[currentPage] || seoProfiles.home;
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function upsertCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

export default function App() {
  const [locale, setLocale] = useState(() => localStorage.getItem("txmh_locale") || "en");
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = currentPageFromPath(location.pathname);

  useEffect(() => {
    localStorage.setItem("txmh_locale", locale);
  }, [locale]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (currentPage === "system") {
      delete document.documentElement.dataset.acquisitionPageViewStatus;
      delete document.documentElement.dataset.acquisitionPageViewId;
      return;
    }

    void trackAcquisitionPageView({
      defaultSourceType: currentPage === "quote" ? "website_form" : currentPage === "route" ? "google_seo" : "website",
      touchpoint: `${currentPage}_page_view`,
    });
  }, [location.pathname, location.search, currentPage]);

  useEffect(() => {
    const profile = seoProfileForLocation(currentPage, location.pathname);
    const canonicalUrl = `${siteUrl}${profile.path}`;
    document.title = profile.title;
    upsertMeta('meta[name="description"]', { name: "description", content: profile.description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: profile.robots || "index, follow, max-image-preview:large" });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: profile.title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: profile.description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: profile.title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: profile.description });
    upsertCanonical(canonicalUrl);
  }, [currentPage, location.pathname]);

  const text = i18n[locale];

  const toggleLocale = () => {
    setLocale((prev) => (prev === "zh" ? "en" : "zh"));
  };

  const changePage = (page, options = {}) => {
    const pathname = options.path || pagePaths[page] || pagePaths.home;
    navigate(`${pathname}${options.search || ""}`);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar
        locale={locale}
        text={text}
        currentPage={currentPage}
        toggleLocale={toggleLocale}
      />

      <Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 text-sm text-gray-500" role="status">
            Loading...
          </div>
        }
      >
        <Routes>
          <Route
            path="/"
            element={<HomePage locale={locale} text={text} changePage={changePage} />}
          />
          <Route path="/about" element={<AboutPage locale={locale} text={text} />} />
          <Route path="/routes" element={<RouteIndexPage changePage={changePage} />} />
          <Route path="/routes/:slug" element={<RouteLandingPage changePage={changePage} />} />
          <Route
            path="/quote"
            element={
              <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
                <QuoteCalculator locale={locale} mode="public" />
              </div>
            }
          />
          <Route path="/order" element={<SelfServiceOrderPage />} />
          <Route path="/system" element={<Navigate to="/system/overview" replace />} />
          <Route path="/system/:module/*" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {currentPage !== "system" ? (
        <>
          <PublicAiAssistant locale={locale} />
          <PublicConversionBar locale={locale} />
        </>
      ) : null}

      <footer className={`border-t border-gray-200 mt-10 bg-white ${currentPage !== "system" ? "mb-32 md:mb-28" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 text-sm text-gray-500 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
          <span>© 2026 EurasiaGo · Rail LCL · Europe Delivery · CRM + TMS Workspace</span>
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
