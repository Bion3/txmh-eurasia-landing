import React, { useState, useEffect } from 'react';
import QuoteCalculator from './TMS/QuoteCalculator';
import InquiryCRM from './TMS/InquiryCRM';
import ShipmentDetailDrawer from './TMS/ShipmentDetailDrawer';
import { getLeads, addLead, createLeadFromQuote } from '../store/crmStore';

export default function TMSDashboard({ locale = 'en', refreshKey = 0 }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [dashboardData, setDashboardData] = useState({
    orders: 3,
    leads: 0,
  });

  useEffect(() => {
    setDashboardData((prev) => ({ ...prev, leads: getLeads().length }));
  }, [refreshKey, localRefreshKey]);

  const handleSaveQuoteToCRM = (quoteData) => {
    const newLead = createLeadFromQuote(quoteData);
    addLead(newLead);
    setLocalRefreshKey((k) => k + 1);
    setActiveMenu('crm');
  };

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'orders', label: 'LCL Orders' },
    { key: 'schedule', label: 'Train Schedule' },
    { key: 'delivery', label: 'EU Delivery' },
    { key: 'quote', label: 'Quote Center' },
    { key: 'crm', label: 'CRM' },
  ];

  const shipments = [
    {
      id: 'TXMH260328-HAM-001',
      customer: 'Auto Parts Import GmbH',
      pol: "XI'AN",
      pod: 'HAMBURG',
      atd: '2026-03-28',
      eta: '2026-04-18',
      service: 'Rail LCL + Delivery',
      status: 'Booked',
      cargo: 'Auto Parts',
      volume: '3.2 CBM / 680 KG',
      customs: 'Deferred Customs',
      delivery: 'Hamburg + Regional Delivery',
      notes: 'Customer requires stable ETA and local handover.',
    },
    {
      id: 'TXMH260329-DUI-002',
      customer: 'Benelux Trade BV',
      pol: 'WUHAN',
      pod: 'DUISBURG',
      atd: '2026-03-29',
      eta: '2026-04-20',
      service: 'Rail LCL',
      status: 'Booked',
      cargo: 'Consumer Goods',
      volume: '5.8 CBM / 1220 KG',
      customs: 'Standard Import Clearance',
      delivery: 'Pickup at hub',
      notes: 'Potential recurring weekly shipments.',
    },
    {
      id: 'TXMH260330-WAW-003',
      customer: 'Poland Distribution Sp. z o.o.',
      pol: 'CHENGDU',
      pod: 'WARSAW',
      atd: '2026-03-30',
      eta: '2026-04-22',
      service: 'Rail LCL + Delivery',
      status: 'Confirmed',
      cargo: 'Furniture',
      volume: '8.5 CBM / 1600 KG',
      customs: 'Deferred Customs',
      delivery: 'Warsaw + Local Distribution',
      notes: 'Requires delivery appointment booking.',
    },
  ];

  return (
    <section className="px-6 md:px-10 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          {/* Left */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 h-fit">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">TXMH Rail TMS</h3>
            <div className="space-y-4">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveMenu(item.key)}
                  className={`w-full text-left px-5 py-4 rounded-2xl text-lg transition ${
                    activeMenu === item.key
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="space-y-6">
            {activeMenu === 'dashboard' && (
              <>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-3xl border border-slate-200 p-5">
                    <div className="text-slate-500">Active LCL Orders</div>
                    <div className="text-4xl font-bold mt-2">3</div>
                  </div>
                  <div className="bg-white rounded-3xl border border-slate-200 p-5">
                    <div className="text-slate-500">New Leads</div>
                    <div className="text-4xl font-bold mt-2">{dashboardData.leads}</div>
                  </div>
                  <div className="bg-white rounded-3xl border border-slate-200 p-5">
                    <div className="text-slate-500">EU Delivery Nodes</div>
                    <div className="text-4xl font-bold mt-2">2000+</div>
                  </div>
                  <div className="bg-white rounded-3xl border border-slate-200 p-5">
                    <div className="text-slate-500">China Pickup Cities</div>
                    <div className="text-4xl font-bold mt-2">200+</div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                  <h3 className="text-2xl font-bold mb-4">Recent Rail LCL Orders</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                      <thead>
                        <tr className="text-left text-slate-500 border-b">
                          <th className="py-3">Order No.</th>
                          <th className="py-3">Customer</th>
                          <th className="py-3">POL</th>
                          <th className="py-3">POD</th>
                          <th className="py-3">ATD</th>
                          <th className="py-3">Service</th>
                          <th className="py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shipments.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedShipment(item)}
                            className="border-b last:border-b-0 cursor-pointer hover:bg-slate-50"
                          >
                            <td className="py-4 font-medium text-emerald-600">{item.id}</td>
                            <td className="py-4">{item.customer}</td>
                            <td className="py-4">{item.pol}</td>
                            <td className="py-4">{item.pod}</td>
                            <td className="py-4">{item.atd}</td>
                            <td className="py-4">{item.service}</td>
                            <td className="py-4">{item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {activeMenu === 'orders' && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6">
                <h3 className="text-2xl font-bold mb-4">All Rail LCL Orders</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-3">Order No.</th>
                        <th className="py-3">Customer</th>
                        <th className="py-3">POL</th>
                        <th className="py-3">POD</th>
                        <th className="py-3">ATD</th>
                        <th className="py-3">Service</th>
                        <th className="py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipments.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedShipment(item)}
                          className="border-b last:border-b-0 cursor-pointer hover:bg-slate-50"
                        >
                          <td className="py-4 font-medium text-emerald-600">{item.id}</td>
                          <td className="py-4">{item.customer}</td>
                          <td className="py-4">{item.pol}</td>
                          <td className="py-4">{item.pod}</td>
                          <td className="py-4">{item.atd}</td>
                          <td className="py-4">{item.service}</td>
                          <td className="py-4">{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeMenu === 'quote' && <QuoteCalculator locale={locale} onSaveToCRM={handleSaveQuoteToCRM} />}
            {activeMenu === 'crm' && <InquiryCRM locale={locale} refreshKey={refreshKey + localRefreshKey} />}

            {activeMenu === 'schedule' && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6">
                <h3 className="text-2xl font-bold mb-4">Train Schedule</h3>
                <p className="text-slate-500">Next step can add weekly departures / cutoff / ETA.</p>
              </div>
            )}

            {activeMenu === 'delivery' && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6">
                <h3 className="text-2xl font-bold mb-4">EU Delivery Network</h3>
                <p className="text-slate-500">Next step can add EU hub map / last-mile coverage / transit SLA.</p>
              </div>
            )}
          </div>
        </div>
      </div>

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