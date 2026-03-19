import React from 'react';

export default function ShipmentDetailDrawer({ shipment, onClose, locale = 'en' }) {
  if (!shipment) return null;

  const t = {
    zh: {
      title: '货件详情',
      orderNo: '订单号',
      customer: '客户',
      route: '线路',
      service: '服务',
      status: '状态',
      atd: '发车日期',
      eta: '预计到达',
      cargo: '货物描述',
      volume: '体积/重量',
      customs: '清关',
      delivery: '派送',
      notes: '备注',
      close: '关闭',
    },
    en: {
      title: 'Shipment Detail',
      orderNo: 'Order No.',
      customer: 'Customer',
      route: 'Route',
      service: 'Service',
      status: 'Status',
      atd: 'ATD',
      eta: 'ETA',
      cargo: 'Cargo',
      volume: 'Volume / Weight',
      customs: 'Customs',
      delivery: 'Delivery',
      notes: 'Notes',
      close: 'Close',
    },
  }[locale];

  const Item = ({ label, value }) => (
    <div className="py-3 border-b last:border-b-0">
      <div className="text-sm text-slate-500 mb-1">{label}</div>
      <div className="text-slate-900 font-medium">{value}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900">{t.title}</h3>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            {t.close}
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 p-5">
          <Item label={t.orderNo} value={shipment.id} />
          <Item label={t.customer} value={shipment.customer} />
          <Item label={t.route} value={`${shipment.pol}  ${shipment.pod}`} />
          <Item label={t.service} value={shipment.service} />
          <Item label={t.status} value={shipment.status} />
          <Item label={t.atd} value={shipment.atd} />
          <Item label={t.eta} value={shipment.eta || '2026-04-18'} />
          <Item label={t.cargo} value={shipment.cargo || 'Auto Parts / General Cargo'} />
          <Item label={t.volume} value={shipment.volume || '3.2 CBM / 680 KG'} />
          <Item label={t.customs} value={shipment.customs || 'Deferred Customs Available'} />
          <Item label={t.delivery} value={shipment.delivery || 'Hamburg + Regional Distribution'} />
          <Item label={t.notes} value={shipment.notes || 'Priority handling for destination delivery coordination.'} />
        </div>
      </div>
    </div>
  );
}
