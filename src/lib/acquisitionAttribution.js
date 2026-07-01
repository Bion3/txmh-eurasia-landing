import { isSupabaseConfigured, supabase } from "./supabaseClient";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const CLICK_ID_KEYS = ["gclid", "fbclid", "msclkid"];
const ATTRIBUTION_STORAGE_KEY = "eurasiago_acquisition_touchpoints";
const PAGE_VIEW_STORAGE_KEY = "eurasiago_recorded_page_views";

function safeStorage(storageName) {
  try {
    return typeof window !== "undefined" ? window[storageName] : null;
  } catch (error) {
    return null;
  }
}

function randomId(prefix) {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

function getStoredId(storageName, key, prefix) {
  const storage = safeStorage(storageName);
  if (!storage) return randomId(prefix);

  try {
    const existing = storage.getItem(key);
    if (existing) return existing;

    const next = randomId(prefix);
    storage.setItem(key, next);
    return next;
  } catch (error) {
    return randomId(prefix);
  }
}

function readStoredAttribution() {
  const storage = safeStorage("localStorage");
  if (!storage) return {};

  try {
    return JSON.parse(storage.getItem(ATTRIBUTION_STORAGE_KEY) || "{}") || {};
  } catch (error) {
    return {};
  }
}

function writeStoredAttribution(value) {
  const storage = safeStorage("localStorage");
  if (!storage) return;

  try {
    storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    // Attribution is useful, but lead submission should never depend on storage.
  }
}

function readPageViewRecords() {
  const storage = safeStorage("sessionStorage");
  if (!storage) return {};

  try {
    return JSON.parse(storage.getItem(PAGE_VIEW_STORAGE_KEY) || "{}") || {};
  } catch (error) {
    return {};
  }
}

function writePageViewRecords(value) {
  const storage = safeStorage("sessionStorage");
  if (!storage) return;

  try {
    storage.setItem(PAGE_VIEW_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    // Page-view analytics must never block navigation or lead submission.
  }
}

function publishPageViewDiagnostic(record) {
  if (typeof document === "undefined" || !record) return;
  document.documentElement.dataset.acquisitionPageViewStatus = record.status || "unknown";
  document.documentElement.dataset.acquisitionPageViewId = record.id || "";
}

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== ""));
}

function hasMarketingSignal({ utm, clickId, referrerHost }) {
  return UTM_KEYS.some((key) => Boolean(utm[key])) || Boolean(clickId) || Boolean(referrerHost);
}

function currentDeviceType() {
  if (typeof window === "undefined") return "unknown";
  const width = window.innerWidth || 0;
  if (width < 768) return "mobile";
  if (width < 1180) return "tablet";
  return "desktop";
}

function pageViewDeviceType() {
  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  const isDevelopmentHost = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  return `${currentDeviceType()}:page_view${isDevelopmentHost ? ":development" : ""}`;
}

function websiteVisitPayload({ firstTouch, attributionTouch, lastPage, id }) {
  return {
    id,
    session_id: getStoredId("sessionStorage", "eurasiago_session_id", "session"),
    visitor_id: getStoredId("localStorage", "eurasiago_visitor_id", "visitor"),
    landing_page: lastPage?.landingPage || attributionTouch?.landingPage || "/",
    referrer_url: attributionTouch?.referrer || null,
    utm_source: attributionTouch?.utm_source || null,
    utm_medium: attributionTouch?.utm_medium || null,
    utm_campaign: attributionTouch?.utm_campaign || null,
    utm_term: attributionTouch?.utm_term || null,
    utm_content: attributionTouch?.utm_content || null,
    device_type: pageViewDeviceType(),
    first_visit_at: firstTouch?.capturedAt || new Date().toISOString(),
    last_visit_at: new Date().toISOString(),
  };
}

function inferSourceType({ defaultSourceType, referrerHost, utm }) {
  const source = normalizeToken(utm.utm_source);
  const medium = normalizeToken(utm.utm_medium);

  if (source.includes("google") && ["cpc", "ppc", "paid", "paid_search"].includes(medium)) return "google_ads";
  if (source.includes("google") && ["organic", "seo"].includes(medium)) return "google_seo";
  if (source.includes("linkedin")) return medium.includes("paid") ? "linkedin_ads" : "linkedin";
  if (source.includes("facebook") || source.includes("meta")) return "meta_ads";
  if (source) return source;
  if (referrerHost) return "referral";
  return defaultSourceType;
}

function currentTouch({ defaultSourceType, touchpoint }) {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const utm = Object.fromEntries(UTM_KEYS.map((key) => [key, clean(params.get(key))]));
  const referrer = clean(document.referrer);
  const referrerHost = (() => {
    if (!referrer) return null;
    try {
      const parsed = new URL(referrer);
      return parsed.host === url.host ? null : parsed.host;
    } catch (error) {
      return null;
    }
  })();
  const clickId = clean(CLICK_ID_KEYS.map((key) => params.get(key)).find(Boolean));
  const landingPage = `${url.pathname}${url.search}`;
  const sourceType = inferSourceType({ defaultSourceType, referrerHost, utm });

  return compactObject({
    touchpoint,
    sourceType,
    landingPage,
    referrer,
    referrerHost,
    clickId,
    capturedAt: new Date().toISOString(),
    ...utm,
  });
}

function resolveStoredTouch({ defaultSourceType, touchpoint }) {
  const current = currentTouch({ defaultSourceType, touchpoint });
  const stored = readStoredAttribution();
  const currentHasSignal = hasMarketingSignal({
    utm: Object.fromEntries(UTM_KEYS.map((key) => [key, current[key]])),
    clickId: current.clickId,
    referrerHost: current.referrerHost,
  });
  const storedFirstHasSignal = stored.firstTouch
    ? hasMarketingSignal({
        utm: Object.fromEntries(UTM_KEYS.map((key) => [key, stored.firstTouch[key]])),
        clickId: stored.firstTouch.clickId,
        referrerHost: stored.firstTouch.referrerHost,
      })
    : false;
  const firstTouch = !stored.firstTouch || (!storedFirstHasSignal && currentHasSignal) ? current : stored.firstTouch;
  const lastTouch = currentHasSignal ? current : stored.lastTouch || firstTouch;
  const next = {
    firstTouch,
    lastTouch,
    lastPage: current,
  };

  writeStoredAttribution(next);
  return next;
}

export async function trackAcquisitionPageView({ defaultSourceType = "website", touchpoint = "page_view" } = {}) {
  if (typeof window === "undefined") return null;

  const { firstTouch, lastTouch, lastPage } = resolveStoredTouch({ defaultSourceType, touchpoint });
  const attributionTouch = lastTouch || firstTouch || lastPage;
  const landingPage = lastPage?.landingPage || attributionTouch?.landingPage || "/";
  const records = readPageViewRecords();
  const existing = records[landingPage];

  if (existing?.id && ["pending", "recorded"].includes(existing.status)) {
    publishPageViewDiagnostic(existing);
    return existing;
  }

  if (!isSupabaseConfigured || !supabase || !globalThis.crypto?.randomUUID) {
    return null;
  }

  const record = {
    id: existing?.id || globalThis.crypto.randomUUID(),
    status: "pending",
    landingPage,
    capturedAt: new Date().toISOString(),
  };
  writePageViewRecords({ ...records, [landingPage]: record });
  publishPageViewDiagnostic(record);

  const payload = websiteVisitPayload({
    firstTouch,
    attributionTouch,
    lastPage,
    id: record.id,
  });
  let recorded = false;
  try {
    const { error } = await supabase.from("website_visits").insert([payload]);
    recorded = !error || error.code === "23505";
  } catch (error) {
    recorded = false;
  }
  const nextRecord = {
    ...record,
    status: recorded ? "recorded" : "failed",
  };

  writePageViewRecords({
    ...readPageViewRecords(),
    [landingPage]: nextRecord,
  });
  publishPageViewDiagnostic(nextRecord);
  return nextRecord;
}

export function captureAcquisitionAttribution({ defaultSourceType = "website_form", touchpoint = "website" } = {}) {
  if (typeof window === "undefined") {
    return {
      leadFields: {
        source_type: defaultSourceType,
        channel_detail: touchpoint,
      },
      messageLines: [],
      websiteVisit: null,
    };
  }

  const { firstTouch, lastTouch, lastPage } = resolveStoredTouch({ defaultSourceType, touchpoint });
  const attributionTouch = lastTouch || firstTouch || lastPage;
  const visitorId = getStoredId("localStorage", "eurasiago_visitor_id", "visitor");
  const sessionId = getStoredId("sessionStorage", "eurasiago_session_id", "session");
  const submitPage = lastPage?.landingPage || attributionTouch?.landingPage || "/";
  const firstLanding = firstTouch?.landingPage || attributionTouch?.landingPage || submitPage;
  const sourceType = attributionTouch?.sourceType || defaultSourceType;
  const recordedPageView = readPageViewRecords()[submitPage];
  const visitId = recordedPageView?.id || globalThis.crypto?.randomUUID?.();
  const detailParts = [
    touchpoint,
    attributionTouch?.utm_source ? `utm_source=${attributionTouch.utm_source}` : null,
    attributionTouch?.utm_medium ? `utm_medium=${attributionTouch.utm_medium}` : null,
    attributionTouch?.utm_campaign ? `utm_campaign=${attributionTouch.utm_campaign}` : null,
    attributionTouch?.utm_term ? `utm_term=${attributionTouch.utm_term}` : null,
    attributionTouch?.utm_content ? `utm_content=${attributionTouch.utm_content}` : null,
    attributionTouch?.clickId ? `click_id=${attributionTouch.clickId}` : null,
    attributionTouch?.referrerHost ? `referrer=${attributionTouch.referrerHost}` : null,
    `first_landing=${firstLanding}`,
    `submit_page=${submitPage}`,
  ].filter(Boolean);

  return {
    leadFields: {
      source_type: sourceType,
      channel_detail: detailParts.join(" | "),
    },
    messageLines: [
      `Source: ${sourceType}`,
      `Touchpoint: ${touchpoint}`,
      attributionTouch?.utm_campaign ? `Campaign: ${attributionTouch.utm_campaign}` : null,
      attributionTouch?.referrerHost ? `Referrer: ${attributionTouch.referrerHost}` : null,
      `First landing: ${firstLanding}`,
      `Submit page: ${submitPage}`,
    ].filter(Boolean),
    websiteVisit: {
      id: visitId,
      already_recorded: recordedPageView?.status === "recorded",
      session_id: sessionId,
      visitor_id: visitorId,
      landing_page: firstLanding,
      referrer_url: attributionTouch?.referrer || null,
      utm_source: attributionTouch?.utm_source || null,
      utm_medium: attributionTouch?.utm_medium || null,
      utm_campaign: attributionTouch?.utm_campaign || null,
      utm_term: attributionTouch?.utm_term || null,
      utm_content: attributionTouch?.utm_content || null,
      device_type: recordedPageView?.id ? pageViewDeviceType() : currentDeviceType(),
      first_visit_at: firstTouch?.capturedAt || new Date().toISOString(),
      last_visit_at: new Date().toISOString(),
    },
  };
}
