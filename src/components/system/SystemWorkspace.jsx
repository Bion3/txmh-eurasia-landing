import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import AuthPanel from "./AuthPanel";
import CostCenterWorkspace from "./CostCenterWorkspace";
import CustomerWorkspace from "./CustomerWorkspace";
import FinanceWorkspace from "./FinanceWorkspace";
import LeadPoolWorkspace from "./LeadPoolWorkspace";
import OrderWorkspace from "./OrderWorkspace";
import QuoteWorkspace from "./QuoteWorkspace";
import SystemOverview from "./SystemOverview";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useDashboardSummary } from "../../hooks/useDashboard";

const fallbackSystemMetrics = [
  { label: "今日新增线索", value: "18", hint: "SEO、广告、转介绍线索统一进入获客池" },
  { label: "进行中报价", value: "26", hint: "铁路、海运、空运报价统一核价" },
  { label: "执行中订单", value: "41", hint: "整柜、拼箱、空运订单统一管理" },
  { label: "预计毛利", value: "$86.4K", hint: "按报价收入、成本中心和订单成本估算" },
];

const moduleNav = [
  ["overview", "系统总览", "经营驾驶舱", "01"],
  ["leads", "营销获客", "线索/来源/邮件跟进", "02"],
  ["customers", "客户管理", "客户/联系人/分层", "03"],
  ["quotes", "报价中心", "成本核价/毛利", "04"],
  ["cost-center", "成本中心", "供应商/费率/自动核价", "05"],
  ["orders", "订单管理", "录单/执行/节点", "06"],
  ["finance", "财务结算", "应收/应付/利润", "07"],
];

const quickActions = [
  { label: "新建线索", module: "leads", tone: "bg-sky-600 text-white" },
  { label: "创建报价", module: "quotes", tone: "bg-emerald-600 text-white" },
  { label: "维护费率", module: "cost-center", tone: "bg-amber-500 text-slate-950" },
  { label: "手工录单", module: "orders", tone: "bg-violet-600 text-white" },
];

const detailModuleLabels = {
  customers: "客户详情",
  quotes: "报价详情",
  orders: "订单详情",
};

const moduleIds = new Set(moduleNav.map(([id]) => id));
const systemPath = (module) => `/system/${module}`;

function normalizeMetrics(summary) {
  if (!Array.isArray(summary?.metrics)) return fallbackSystemMetrics;

  return summary.metrics.map((item) => ({
    label: item.label,
    value: item.display_value ?? item.value ?? "-",
    hint: item.hint,
  }));
}

function buildFocusItems(summary) {
  const workbench = summary?.workbench || {};
  return [
    `${workbench.low_margin_quotes ?? 8} 个低毛利报价待复核`,
    `${workbench.pending_email_tasks ?? 6} 个线索待二次邮件跟进`,
    `${workbench.orders_need_costs ?? 12} 个订单待成本确认`,
  ];
}

function MetricCard({ label, value, hint, compact = false, dataSource = "demo" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${compact ? "p-3" : "p-5"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          dataSource === "database" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}>
          {dataSource === "database" ? "真实" : "演示"}
        </span>
      </div>
      <div className={`mt-1 font-bold text-slate-900 ${compact ? "text-xl" : "text-3xl"}`}>{value}</div>
      <p className="mt-2 hidden text-xs leading-5 text-slate-500 sm:block">{hint}</p>
    </div>
  );
}

export default function SystemWorkspace() {
  const auth = useAuthSession();
  const { data: dashboardSummary } = useDashboardSummary();
  const navigate = useNavigate();
  const { module, "*": detailPath } = useParams();
  const activeModule = moduleIds.has(module) ? module : "overview";
  const detailId = detailPath?.split("/").filter(Boolean)[0] || null;
  const activeModuleMeta = moduleNav.find(([id]) => id === activeModule) || moduleNav[0];
  const isOverview = activeModule === "overview";
  const dashboardDataSource = dashboardSummary?.source === "database" ? "database" : "demo";
  const systemMetrics = normalizeMetrics(dashboardSummary);
  const focusItems = buildFocusItems(dashboardSummary);
  const [selectedLead, setSelectedLead] = useState(null);
  const [customerDraft, setCustomerDraft] = useState(null);
  const [orderDraft, setOrderDraft] = useState(null);
  const [financeDraft, setFinanceDraft] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!moduleIds.has(module)) {
      navigate(systemPath("overview"), { replace: true });
    }
  }, [module, navigate]);

  const setActiveModule = (nextModule) => {
    navigate(systemPath(moduleIds.has(nextModule) ? nextModule : "overview"));
  };

  const setActiveModuleDetail = (nextModule, nextDetailId) => {
    const normalizedModule = moduleIds.has(nextModule) ? nextModule : "overview";
    navigate(nextDetailId ? `${systemPath(normalizedModule)}/${nextDetailId}` : systemPath(normalizedModule));
  };

  const handleCopyDetailLink = async () => {
    if (!detailId || !detailModuleLabels[activeModule]) return;

    const url = `${window.location.origin}${systemPath(activeModule)}/${detailId}`;

    try {
      await navigator.clipboard.writeText(url);
      handleNotify({
        type: "success",
        title: "详情链接已复制",
        message: `${detailModuleLabels[activeModule]} ${detailId} 可通过该 URL 直接打开。`,
      });
    } catch {
      handleNotify({
        type: "info",
        title: "复制失败",
        message: `请手动复制当前地址：${url}`,
      });
    }
  };

  const handleCreateQuote = (lead) => {
    setSelectedLead(lead);
    setActiveModule("quotes");
  };

  const handleCreateQuoteFromCustomer = (customer) => {
    setSelectedLead(customer);
    setActiveModule("quotes");
  };

  const handleNotify = (payload) => {
    setNotice(payload);

    if (payload?.orderDraft) {
      setOrderDraft(payload.orderDraft);
      setActiveModule("orders");
    }

    if (payload?.customerDraft) {
      setCustomerDraft(payload.customerDraft);
      setActiveModule("customers");
    }

    if (payload?.financeDraft) {
      setFinanceDraft(payload.financeDraft);
      setActiveModule("finance");
    }
  };

  return (
    <main className="min-h-[calc(100vh-65px)] bg-slate-100">
      <section className="mx-auto grid max-w-[1500px] gap-4 px-3 py-4 md:px-5 xl:grid-cols-[220px_1fr]">
        <aside className="hidden xl:sticky xl:top-20 xl:block xl:h-[calc(100vh-96px)]">
          <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-slate-950 p-3 text-white shadow-sm">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-200">LOGISTICS OS</div>
              <h1 className="mt-2 text-lg font-bold leading-tight">运营系统</h1>
            </div>

            <nav className="mt-4 grid gap-1.5">
              {moduleNav.map(([id, label, hint, index]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveModule(id)}
                  className={`rounded-2xl px-3 py-2.5 text-left transition ${
                    activeModule === id
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold">{label}</span>
                    <span className={`text-[10px] font-semibold ${activeModule === id ? "text-slate-400" : "text-slate-500"}`}>
                      {index}
                    </span>
                  </div>
                  <div className={`mt-1 text-xs ${activeModule === id ? "text-slate-500" : "text-slate-500"}`}>{hint}</div>
                </button>
              ))}
            </nav>

            <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-bold">今日重点</div>
              <div className="mt-2 space-y-1.5 text-xs leading-5 text-slate-300">
                {focusItems.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:hidden">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">业务模块</span>
              <select
                value={activeModule}
                onChange={(event) => setActiveModule(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
              >
                {moduleNav.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 text-sm text-slate-500">{activeModuleMeta[2]}</div>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_420px] xl:items-start">
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">业务页面</div>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{activeModuleMeta[1]}</h2>
                    <p className="mt-1 text-sm text-slate-500">{activeModuleMeta[2]}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => setActiveModule(action.module)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold ${action.tone}`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="sr-only">全局搜索</span>
                  <input
                    placeholder="搜索客户、线索、报价号、订单号..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              </div>

              <AuthPanel auth={auth} />
            </div>

            {isOverview ? (
              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {systemMetrics.map((item) => (
                  <MetricCard key={item.label} {...item} compact dataSource={dashboardDataSource} />
                ))}
              </div>
            ) : null}

            {detailId && detailModuleLabels[activeModule] ? (
              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-bold">{detailModuleLabels[activeModule]}深链</div>
                  <div className="mt-1 break-all text-xs text-sky-700">
                    {systemPath(activeModule)}/{detailId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyDetailLink}
                  className="self-start rounded-2xl bg-sky-600 px-4 py-2 text-xs font-bold text-white lg:self-auto"
                >
                  复制详情链接
                </button>
              </div>
            ) : null}
          </section>

          <section className="mt-6">
        {notice && (
          <div
            className={`mb-6 rounded-3xl border px-5 py-4 text-sm shadow-sm ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-sky-200 bg-sky-50 text-sky-900"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">{notice.title}</div>
                <div className="mt-1 text-sm opacity-90">{notice.message}</div>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded-full px-2 py-1 text-xs font-semibold opacity-70 hover:opacity-100"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {activeModule === "overview" ? (
          <SystemOverview dashboardSummary={dashboardSummary} onNavigate={setActiveModule} />
        ) : activeModule === "leads" ? (
          <LeadPoolWorkspace onCreateQuote={handleCreateQuote} onNotify={handleNotify} />
        ) : activeModule === "customers" ? (
          <CustomerWorkspace
            customerDraft={customerDraft}
            selectedCustomerId={detailId}
            onBackToLeads={() => setActiveModule("leads")}
            onCreateQuote={handleCreateQuoteFromCustomer}
            onOpenCustomer={(customerId) => setActiveModuleDetail("customers", customerId)}
            onNotify={handleNotify}
          />
        ) : activeModule === "quotes" ? (
          <QuoteWorkspace
            lead={selectedLead}
            selectedQuoteId={detailId}
            onBackToLeads={() => setActiveModule("leads")}
            onOpenQuote={(quoteId) => setActiveModuleDetail("quotes", quoteId)}
            onNotify={handleNotify}
          />
        ) : activeModule === "cost-center" ? (
          <CostCenterWorkspace
            onNavigateQuotes={() => setActiveModule("quotes")}
            onNotify={handleNotify}
          />
        ) : activeModule === "orders" ? (
          <OrderWorkspace
            orderDraft={orderDraft}
            selectedOrderId={detailId}
            onBackToQuotes={() => setActiveModule("quotes")}
            onOpenOrder={(orderId) => setActiveModuleDetail("orders", orderId)}
            onNotify={(payload) => {
              if (
                !payload?.financeDraft &&
                ["应收流程已生成", "应收流程已准备", "成本录入已排队", "成本录入已准备"].includes(payload?.title)
              ) {
                setFinanceDraft({
                  order_id: orderDraft?.order_id,
                  order_no: orderDraft?.order_no || "OD202605270001",
                  customer_id: orderDraft?.customer_id,
                  customer: orderDraft?.company_name || orderDraft?.customer || "客户",
                  contact_id: orderDraft?.contact_id,
                  quote_id: orderDraft?.quote_id,
                  receivable_id: payload?.receivable_id,
                  payable_ids: payload?.payable_ids,
                  origin: orderDraft?.origin,
                  destination: orderDraft?.destination,
                  transport_mode: orderDraft?.transport_mode,
                  shipment_type: orderDraft?.shipment_type,
                  receivableOpen: orderDraft?.estimated_revenue_total || 0,
                  payableOpen: orderDraft?.estimated_cost_total || 0,
                  focus: payload?.title === "成本录入已排队" || payload?.title === "成本录入已准备" ? "costs" : "receivables",
                });
                setActiveModule("finance");
              }
              handleNotify(payload);
            }}
          />
        ) : (
          <FinanceWorkspace
            financeDraft={financeDraft}
            onBackToOrders={() => setActiveModule("orders")}
            onNotify={handleNotify}
          />
        )}
          </section>
        </div>
      </section>
    </main>
  );
}
