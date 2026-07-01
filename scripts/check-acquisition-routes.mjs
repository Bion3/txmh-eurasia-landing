import { readFile } from "node:fs/promises";
import { routeLandingPages } from "../src/data/routeLandingPages.js";

const rootUrl = "https://www.eurasiago.com";
const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const navbar = await readFile(new URL("../src/components/Navbar.jsx", import.meta.url), "utf8");
const publicConversionBar = await readFile(new URL("../src/components/PublicConversionBar.jsx", import.meta.url), "utf8");
const homePage = await readFile(new URL("../src/page/HomePage.jsx", import.meta.url), "utf8");
const routeIndexPage = await readFile(new URL("../src/page/RouteIndexPage.jsx", import.meta.url), "utf8");
const routePage = await readFile(new URL("../src/page/RouteLandingPage.jsx", import.meta.url), "utf8");

const failures = [];
const seen = new Set();

if (!homePage.includes('id="rail-lanes"')) {
  failures.push("Missing homepage rail-lanes anchor for route breadcrumbs");
}

if (!sitemap.includes(`${rootUrl}/routes`)) {
  failures.push("Missing sitemap URL: /routes");
}

if (!app.includes('path="/routes"') || !app.includes("RouteIndexPage")) {
  failures.push("Missing /routes route index registration");
}

if (!app.includes("PublicConversionBar") || !publicConversionBar.includes("30-second inquiry")) {
  failures.push("Missing public sticky direct lead capture");
}

if (
  !publicConversionBar.includes("routeQuoteSearch")
  || !publicConversionBar.includes("useCreateLead")
  || !publicConversionBar.includes("captureAcquisitionAttribution")
  || !publicConversionBar.includes("buildStickyInquiry")
) {
  failures.push("Public sticky lead capture is missing route prefill, direct submission, attribution, or fallback support");
}

if (!navbar.includes('to: "/routes"')) {
  failures.push("Missing /routes navigation entry");
}

if (!routeIndexPage.includes("route-index-jsonld") || !routeIndexPage.includes("ItemList")) {
  failures.push("Route index page is missing ItemList structured data");
}

if (!routeIndexPage.includes('href={`/routes/${page.slug}`}') || !routeIndexPage.includes('href={`/quote${routeQuoteSearch(page)}`}')) {
  failures.push("Route index page is missing crawlable route/quote links");
}

if (!routeIndexPage.includes("handleRecommendationSubmit") || !routeIndexPage.includes("route_index_recommendation_form")) {
  failures.push("Route index page is missing recommendation lead form");
}

if (!routeIndexPage.includes("usePersistentFormDraft") || !routeIndexPage.includes("Email backup")) {
  failures.push("Route index recommendation form is missing draft or email fallback support");
}

if (!routePage.includes("application/ld+json") || !routePage.includes("FAQPage") || !routePage.includes("BreadcrumbList")) {
  failures.push("Route landing page is missing structured data generation");
}

if (!routePage.includes("Route FAQ") || !routePage.includes("routeFaqs")) {
  failures.push("Route landing page is missing visible FAQ content");
}

for (const page of routeLandingPages) {
  if (seen.has(page.slug)) {
    failures.push(`Duplicate route slug: ${page.slug}`);
  }
  seen.add(page.slug);

  const routePath = `/routes/${page.slug}`;
  if (!sitemap.includes(`${rootUrl}${routePath}`)) {
    failures.push(`Missing sitemap URL: ${routePath}`);
  }
  if (!homePage.includes(page.slug)) {
    failures.push(`Missing homepage lane entry: ${page.slug}`);
  }
  if (!page.seoTitle || !page.description || !page.headline || !page.ctaCargo) {
    failures.push(`Incomplete SEO/CTA fields: ${page.slug}`);
  }
}

if (failures.length) {
  console.error("Acquisition route check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Acquisition route check passed: ${routeLandingPages.length} route landing pages.`);
