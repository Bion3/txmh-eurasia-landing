import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import QuoteCalculator from './TMS/QuoteCalculator';
import InquiryCRM from './TMS/InquiryCRM';
import ShipmentDetailDrawer from './TMS/ShipmentDetailDrawer';
import { addLead } from '../store/crmStore';

export default function TMSDashboard({ locale = 'en', refreshKey = 0 }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [selectedShipment, setSelectedShipment] = useState(null);

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [localRefreshKey, setLocalRefreshKey] = useState(0);

  const [dashboardData, setDashboardData] = useState({
    leads: 0,
  });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setErrorMsg('');

      try {
        // 1) Fetch shipments
        const { data: shipmentsData, error: shipmentsError } = await supabase
          .from('shipments')
          .select('*')
          .order('atd', { ascending: false });

        if (shipmentsError) {
          throw new Error(`Shipments load failed: ${shipmentsError.message}`);
        }

        setShipments(shipmentsData || []);

        // 2) Fetch leads count
        const { count, error: leadsError } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true });

        if (leadsError) {
          throw new Error(`Leads count failed: ${leadsError.message}`);
        }

        setDashboardData({
          leads: count || 0,
        });
      } catch (err) {
        console.error('TMSDashboard fetchData error:', err);
        setErrorMsg(err.message || 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [refreshKey, localRefreshKey]);

  // KPI stats
  const kpi = useMemo(() => {
    const totalOrders = shipments.length;
    const inTransit = shipments.filter((s) => s.status === 'In Transit').length;
    const booked = shipments.filter((s) => s.status === 'Booked').length;
    const pending = shipments.filter((s) => s.status === 'Pending').length;

    return {
      totalOrders,
      inTransit,
      booked,
      pending,
    };
  }, [shipments]);

  const handleSaveQuoteToCRM = async (quoteData) => {
    try {
      const newLead = {
        customer_name: quoteData.name || '',
        email: quoteData.email || '',
        route: `${quoteData.pol || ''} to ${quoteData.pod || ''}`,
        cargo_details: `${quoteData.containerType || ''}, ${quoteData.cargo || ''}`,
        status: 'Quoted',
      };

      await addLead(newLead);

      setLocalRefreshKey((k) => k + 1);
      setActiveMenu('crm');
    } catch (err) {
      console.error('Save quote to CRM failed:', err);
      alert('Failed to save quote to CRM. Please check Supabase table / RLS.');
    }
  };

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'orders', label: 'LCL Orders' },
    { key: 'schedule', label: 'Train Schedule' },
    { key: 'delivery', label: 'EU Delivery' },
    { key: 'quote', label: 'Quote Center' },
    { key: 'crm', label: 'CRM' },
  ];

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'In Transit':
        return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'Booked':
        return 'bg-amber-100 text-amber-700 border border-amber-200';
      case 'Pending':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'Delivered':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'Exception':
        return 'bg-red-100 text-red-700 border border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const renderShipmentTable = (rows) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-3 pr-4">Order No.</th>
            <th className="py-3 pr-4">Customer</th>
            <th className="py-3 pr-4">POL</th>
            <th className="py-3 pr-4">POD</th>
            <th className="py-3 pr-4">ATD</th>
            <th className="py-3 pr-4">Service</th>
            <th className="py-3 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-slate-400">
                No shipment data found.
              </td>
            </tr>
          ) : (
            rows.map((item) => (
              <tr
                key={item.id}
                onClick={() => setSelectedShipment(item)}
                className="border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-slate-50 transition"
              >
                <td className="py-4 pr-4 font-semibold text-emerald-600">{item.id}</td>
                <td className="py-4 pr-4 text-slate-700">{item.customer || '-'}</td>
                <td className="py-4 pr-4 text-slate-700">{item.pol || '-'}</td>
                <td className="py-4 pr-4 text-slate-700">{item.pod || '-'}</td>
                <td className="py-4 pr-4 text-slate-700">{item.atd || '-'}</td>
                <td className="py-4 pr-4 text-slate-700">{item.service || '-'}</td>
                <td className="py-4 pr-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
                      item.status
                    )}`}
                  >
                    {item.status || 'Unknown'}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="px-6 md:px-10 py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          {/* Left Sidebar */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 h-fit shadow-sm">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900">TXMH Rail TMS</h3>
              <p className="text-sm text-slate-500 mt-1">Eurasia Rail LCL Control Tower</p>
            </div>

            <div className="space-y-3">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveMenu(item.key)}
                  className={`w-full text-left px-5 py-4 rounded-2xl text-base font-medium transition ${
                    activeMenu === item.key
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Content */}
          <div className="space-y-6">
            {loading ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-slate-500 shadow-sm">
                Loading from Supabase...
              </div>
            ) : errorMsg ? (
              <div className="bg-white rounded-3xl border border-red-200 p-8 shadow-sm">
                <h3 className="text-xl font-bold text-red-600 mb-2">Data Load Error</h3>
                <p className="text-slate-600">{errorMsg}</p>
                <p className="text-sm text-slate-400 mt-3">
                  Check Supabase table names, columns, and RLS policies.
                </p>
              </div>
            ) : (
              <>
                {/* DASHBOARD */}
                {activeMenu === 'dashboard' && (
                  <>
                    {/* KPI Cards */}
                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                        <div className="text-slate-500 text-sm">Total LCL Orders</div>
                        <div className="text-4xl font-bold mt-2 text-slate-900">{kpi.totalOrders}</div>
                      </div>

                      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                        <div className="text-slate-500 text-sm">In Transit</div>
                        <div className="text-4xl font-bold mt-2 text-blue-600">{kpi.inTransit}</div>
                      </div>

                      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                        <div className="text-slate-500 text-sm">Booked</div>
                        <div className="text-4xl font-bold mt-2 text-amber-600">{kpi.booked}</div>
                      </div>

                      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                        <div className="text-slate-500 text-sm">New Leads</div>
                        <div className="text-4xl font-bold mt-2 text-emerald-600">{dashboardData.leads}</div>
                      </div>
                    </div>

                    {/* Recent Orders */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-slate-900">Recent Rail LCL Orders</h3>
                          <p className="text-sm text-slate-500 mt-1">
                            Latest shipment records from Supabase
                          </p>
                        </div>

                        <button
                          onClick={() => setLocalRefreshKey((k) => k + 1)}
                          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition"
                        >
                          Refresh
                        </button>
                      </div>

                      {renderShipmentTable(shipments.slice(0, 8))}
                    </div>
                  </>
                )}

                {/* ORDERS */}
                {activeMenu === 'orders' && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">All Rail LCL Orders</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Click any order to open shipment details
                        </p>
                      </div>

                      <button
                        onClick={() => setLocalRefreshKey((k) => k + 1)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition"
                      >
                        Refresh
                      </button>
                    </div>

                    {renderShipmentTable(shipments)}
                  </div>
                )}

                {/* QUOTE */}
                {activeMenu === 'quote' && (
                  <QuoteCalculator locale={locale} onSaveToCRM={handleSaveQuoteToCRM} />
                )}

                {/* CRM */}
                {activeMenu === 'crm' && (
                  <InquiryCRM locale={locale} refreshKey={refreshKey + localRefreshKey} />
                )}

                {/* SCHEDULE */}
                {activeMenu === 'schedule' && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-2xl font-bold mb-4 text-slate-900">Train Schedule</h3>
                    <p className="text-slate-500">
                      Next step: add weekly departures, cutoff windows, terminal plans, and ETA logic.
                    </p>
                  </div>
                )}

                {/* DELIVERY */}
                {activeMenu === 'delivery' && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-2xl font-bold mb-4 text-slate-900">EU Delivery Network</h3>
                    <p className="text-slate-500">
                      Next step: add EU hub map, last-mile coverage, partner network, and SLA matrix.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Shipment Detail Drawer */}
      {selectedShipment && (
        <ShipmentDetailDrawer
          shipment={selectedShipment}
          onClose={() => setSelectedShipment(null)}
          locale={locale}
        />
      )}
    </section>
  );
}