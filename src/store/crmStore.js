const CRM_STORAGE_KEY = "txmh_crm_leads";

const seedLeads = [
  {
    id: "INQ-260328-001",
    customer: "Auto Parts Import GmbH",
    route: "XI'AN → HAMBURG",
    cargo: "Auto Parts",
    volume: "3.2 CBM / 680 KG",
    status: "New",
    owner: "Ben",
    updatedAt: "2026-03-28",
    source: "manual",
  },
  {
    id: "INQ-260328-002",
    customer: "Benelux Trade BV",
    route: "WUHAN → DUISBURG",
    cargo: "Consumer Goods",
    volume: "5.8 CBM / 1220 KG",
    status: "Quoted",
    owner: "Ben",
    updatedAt: "2026-03-28",
    source: "quote",
  },
];

function ensureSeed() {
  const existing = localStorage.getItem(CRM_STORAGE_KEY);
  if (!existing) {
    localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(seedLeads));
  }
}

export function getLeads() {
  ensureSeed();
  return JSON.parse(localStorage.getItem(CRM_STORAGE_KEY) || "[]");
}

export function saveLeads(leads) {
  localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(leads));
}

export function addLead(lead) {
  const leads = getLeads();
  const next = [lead, ...leads];
  saveLeads(next);
  return next;
}

export function createLeadFromQuote(data) {
  const now = new Date();
  const id = `INQ-${String(now.getFullYear()).slice(2)}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  return {
    id,
    customer: data.customer || "New Customer",
    route: `${data.pol || ""} → ${data.pod || ""}`,
    cargo: data.cargo || "General Cargo",
    volume: `${data.cbm || 0} CBM / ${data.kg || 0} KG`,
    status: "Quoted",
    owner: "Ben",
    updatedAt: now.toISOString().slice(0, 10),
    source: "quote",
    quoteAmount: data.total || 0,
  };
}

export function createLeadFromInquiry(data) {
  const now = new Date();
  const id = `INQ-${String(now.getFullYear()).slice(2)}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  return {
    id,
    customer: data.name || "Website Inquiry",
    route: data.route || "TBD",
    cargo: data.cargo || "TBD",
    volume: "-",
    status: "New",
    owner: "Web Lead",
    updatedAt: now.toISOString().slice(0, 10),
    source: "website",
    email: data.email || "",
  };
}
