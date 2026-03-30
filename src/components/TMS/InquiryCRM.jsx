import React, { useEffect, useMemo, useState } from "react";
import { getLeads } from "../../store/crmStore";

export default function InquiryCRM({ locale = "en", refreshKey = 0 }) {
  const [filter, setFilter] = useState("All");
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    async function fetchLeads() {
      const leadsData = await getLeads();
      if (Array.isArray(leadsData)) {
        setLeads(leadsData);
      }
    }
    fetchLeads();
  }, [refreshKey]);

  const t = {
    zh: {
      title: 'Inquiry CRM 询价管理',
      subtitle: '管理客户询价、报价进度与跟进状态，后续可接表单自动入库',
      all: '全部',
      new: '新询价',
      quoted: '已报价',
      follow: '跟进中',
      converted: '已成交',
      id: '询价号',
      customer: '客户',
      route: '线路',
      cargo: '货物',
      volume: '体积/重量',
      owner: '负责人',
      status: '状态',
      updated: '更新时间',
    },
    en: {
      title: 'Inquiry CRM',
      subtitle: 'Manage customer inquiries, quote progress and follow-ups. Can later auto-sync from forms.',
      all: 'All',
      new: 'New',
      quoted: 'Quoted',
      follow: 'Follow-up',
      converted: 'Won',
      id: 'Inquiry No.',
      customer: 'Customer',
      route: 'Route',
      cargo: 'Cargo',
      volume: 'Volume/Weight',
      owner: 'Owner',
      status: 'Status',
      updated: 'Updated',
    },
  }[locale];

  const filtered = useMemo(() => {
    if (filter === 'All') return leads;
    return leads.filter((x) => x.status === filter);
  }, [filter, leads]);

  const badgeClass = (status) => {
    switch (status) {
      case 'New':
        return 'bg-blue-100 text-blue-700';
      case 'Quoted':
        return 'bg-amber-100 text-amber-700';
      case 'Follow-up':
        return 'bg-violet-100 text-violet-700';
      case 'Won':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">{t.title}</h3>
          <p className="text-slate-500 mt-2">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {['All', 'New', 'Quoted', 'Follow-up', 'Won'].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`px-4 py-2 rounded-full text-sm font-medium border ${
                filter === item
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {item === 'All'
                ? t.all
                : item === 'New'
                ? t.new
                : item === 'Quoted'
                ? t.quoted
                : item === 'Follow-up'
                ? t.follow
                : t.converted}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-3">{t.id}</th>
              <th className="py-3">{t.customer}</th>
              <th className="py-3">{t.route}</th>
              <th className="py-3">{t.cargo}</th>
              <th className="py-3">{t.volume}</th>
              <th className="py-3">{t.owner}</th>
              <th className="py-3">{t.status}</th>
              <th className="py-3">{t.updated}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr key={lead.id} className="border-b last:border-b-0">
                <td className="py-4 font-medium text-emerald-600">{lead.id}</td>
                <td className="py-4 text-slate-900">{lead.customer}</td>
                <td className="py-4 text-slate-700">{lead.route}</td>
                <td className="py-4 text-slate-700">{lead.cargo}</td>
                <td className="py-4 text-slate-700">{lead.volume}</td>
                <td className="py-4 text-slate-700">{lead.owner}</td>
                <td className="py-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${badgeClass(lead.status)}`}>
                    {lead.status}
                  </span>
                </td>
                <td className="py-4 text-slate-500">{lead.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}