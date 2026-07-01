export const queryKeys = {
  customers: {
    all: ["customers"],
    list: (query = {}) => ["customers", "list", query],
    detail: (id) => ["customers", "detail", id],
  },
  leads: {
    all: ["leads"],
    list: (query = {}) => ["leads", "list", query],
    detail: (id) => ["leads", "detail", id],
    activities: (id) => ["leads", "activities", id],
    emailTasksAll: ["leads", "email-tasks"],
    emailTasks: (query = {}) => ["leads", "email-tasks", query],
  },
  quotes: {
    all: ["quotes"],
    list: (query = {}) => ["quotes", "list", query],
    detail: (id) => ["quotes", "detail", id],
  },
  costCenter: {
    all: ["cost-center"],
    vendors: (query = {}) => ["cost-center", "vendors", query],
    rateSheets: (query = {}) => ["cost-center", "rate-sheets", query],
    rateSheetItems: (id, query = {}) => ["cost-center", "rate-sheet-items", id, query],
  },
  orders: {
    all: ["orders"],
    list: (query = {}) => ["orders", "list", query],
    detail: (id) => ["orders", "detail", id],
  },
  finance: {
    receivables: (query = {}) => ["finance", "receivables", query],
    payables: (query = {}) => ["finance", "payables", query],
    orderCosts: (query = {}) => ["finance", "orderCosts", query],
  },
  dashboard: {
    summary: ["dashboard", "summary"],
    leadSourceOverview: (query = {}) => ["dashboard", "lead-source-overview", query],
  },
};
