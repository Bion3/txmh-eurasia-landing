
import React from 'react';

export default function MiniTMSSection() {
  console.log('MiniTMSSection is rendering');

  const [selectedOrder, setSelectedOrder] = React.useState(null);
  const [showOrderDetail, setShowOrderDetail] = React.useState(false);

  // 当前日期用于状态计算
  const currentDate = new Date('2026-03-18');

  // 根据日期计算订单状态的函数
  const calculateOrderStatus = (atdDate) => {
    const orderDate = new Date(atdDate);
    const daysDiff = Math.floor((currentDate - orderDate) / (1000 * 60 * 60 * 24));

    if (daysDiff < -7) return 'Booked'; // 出发日期在7天后
    if (daysDiff < -1) return 'Confirmed'; // 出发日期在1-7天内
    if (daysDiff <= 0) return 'In Transit'; // 出发当天或之后
    if (daysDiff <= 14) return 'In Transit'; // 出发后14天内
    return 'Arrived'; // 出发后超过14天
  };

  const orders = [
    {
      orderNo: 'TXMH260328-HAM-001',
      customer: 'Auto Parts Import GmbH',
      pol: "XI'AN",
      pod: 'HAMBURG',
      atd: '2026-03-28',
      service: 'Rail LCL + Delivery',
      status: calculateOrderStatus('2026-03-28'),
    },
    {
      orderNo: 'TXMH260329-DUI-002',
      customer: 'Benelux Trade BV',
      pol: 'WUHAN',
      pod: 'DUISBURG',
      atd: '2026-03-29',
      service: 'Rail LCL',
      status: calculateOrderStatus('2026-03-29'),
    },
    {
      orderNo: 'TXMH260330-MAL-003',
      customer: 'Solar Components Sp. z o.o.',
      pol: "XI'AN",
      pod: 'MALASZEWICZE',
      atd: '2026-03-30',
      service: 'Rail LCL + EU Truck',
      status: calculateOrderStatus('2026-03-30'),
    },
    {
      orderNo: 'TXMH260318-SHA-004',
      customer: 'Nordic Electronics AB',
      pol: 'SHANGHAI',
      pod: 'STOCKHOLM',
      atd: '2026-03-21',
      service: 'Rail LCL',
      status: calculateOrderStatus('2026-03-21'),
    },
  ]

  // 处理订单点击
  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  // 关闭订单详情
  const closeOrderDetail = () => {
    setShowOrderDetail(false);
    setSelectedOrder(null);
  };

  // 统计各状态订单数
  const activeOrders = orders.filter(order => order.status === 'In Transit').length;
  const bookedOrders = orders.filter(order => order.status === 'Booked').length;
  const arrivedOrders = orders.filter(order => order.status === 'Arrived').length;

  const stats = [
    { label: 'Active LCL Orders', value: activeOrders.toString() },
    { label: 'This Week Departures', value: '18' },
    { label: 'EU Delivery Nodes', value: '2000+' },
    { label: 'China Pickup Cities', value: '200+' },
  ]

  const schedule = [
    { route: "西安 → 汉堡", etd: '每周三 / 六', transit: '14–16天', type: '快线', capacity: '95%', nextDeparture: '2026-03-26' },
    { route: "西安 → 杜伊斯堡", etd: '每周三 / 六', transit: '14–16天', type: '快线', capacity: '87%', nextDeparture: '2026-03-26' },
    { route: "西安 → 华沙", etd: '12 / 15 / 19 / 22', transit: '15–18天', type: '常规', capacity: '92%', nextDeparture: '2026-03-22' },
    { route: "西安 → 布达佩斯", etd: '每周四', transit: '16–18天', type: '常规', capacity: '78%', nextDeparture: '2026-03-20' },
    { route: "武汉 → 鹿特丹", etd: '每周二 / 五', transit: '13–15天', type: '快线', capacity: '91%', nextDeparture: '2026-03-25' },
    { route: "上海 → 慕尼黑", etd: '每周一 / 四', transit: '15–17天', type: '常规', capacity: '85%', nextDeparture: '2026-03-24' },
  ]

  const modules = [
    'Rail LCL Order Management',
    'Train Schedule & Capacity Plan',
    'Europe Delivery Tracking',
    'Deferred Customs / DDP Notes',
    'Quote Center + Margin Snapshot',
    'CRM for EU Importers & Agents',
  ]

  return (
    <section className="max-w-7xl mx-auto px-6 py-16 border-4 border-red-500 bg-red-50" id="mini-tms-section">
      <div style={{fontSize: '48px', color: 'red', fontWeight: 'bold', textAlign: 'center', marginBottom: '20px'}}>
        
      </div>
      <div className="mb-10 text-center">

        <p className="text-slate-600 max-w-3xl mx-auto">
          作为官网展示模块，可直接嵌入当前页面。既能展示我们“系统化运营能力”，后续也可独立升级为完整 TMS / CRM 平台。
        </p>
      </div>

      <div className="grid xl:grid-cols-12 gap-6">
        {/* 左侧菜单 */}
        <aside className="xl:col-span-3">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 xl:sticky xl:top-6">
            <h3 className="font-bold text-lg mb-4">TXMH Rail TMS</h3>
            <div className="space-y-3 text-sm">
              <div className="px-4 py-3 rounded-2xl bg-emerald-500 text-white font-medium">
                Dashboard
              </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-700">
                LCL Orders
              </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-700">
                Train Schedule
              </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-700">
                EU Delivery
              </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-700">
                Quote Center
              </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-700">
                CRM
              </div>
            </div>
          </div>
        </aside>

        {/* 右侧主体 */}
        <div className="xl:col-span-9 space-y-6">
          {/* 顶部统计 */}
          <div className="grid md:grid-cols-4 gap-4">
            {stats.map((item) => (
              <div
                key={item.label}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5"
              >
                <div className="text-sm text-slate-500">{item.label}</div>
                <div className="text-3xl font-bold mt-2">{item.value}</div>
              </div>
            ))}
          </div>

          {/* 订单表 */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-xl font-bold">Recent Rail LCL Orders</h3>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-600 text-xs font-medium">
                  Booked: {bookedOrders}
                </span>
                <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-600 text-xs font-medium">
                  Confirmed: {orders.filter(o => o.status === 'Confirmed').length}
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-600 text-xs font-medium">
                  In Transit: {activeOrders}
                </span>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                  Arrived: {arrivedOrders}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-3 pr-4">Order No.</th>
                    <th className="py-3 pr-4">Customer</th>
                    <th className="py-3 pr-4">POL</th>
                    <th className="py-3 pr-4">POD</th>
                    <th className="py-3 pr-4">ATD</th>
                    <th className="py-3 pr-4">Service</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((row) => (
                    <tr key={row.orderNo} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => handleOrderClick(row)}>
                      <td className="py-4 pr-4 font-medium text-emerald-600 hover:text-emerald-800">
                        {row.orderNo}
                      </td>
                      <td className="py-4 pr-4">{row.customer}</td>
                      <td className="py-4 pr-4">{row.pol}</td>
                      <td className="py-4 pr-4">{row.pod}</td>
                      <td className="py-4 pr-4">{row.atd}</td>
                      <td className="py-4 pr-4">{row.service}</td>
                      <td className="py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          row.status === 'Booked' ? 'bg-blue-100 text-blue-700' :
                          row.status === 'Confirmed' ? 'bg-yellow-100 text-yellow-700' :
                          row.status === 'In Transit' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 下方两列 */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-xl font-bold mb-4">March Train Schedule</h3>
              <div className="space-y-4">
                {schedule.map((item) => (
                  <div
                    key={item.route}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{item.route}</div>
                      <div className="text-sm text-slate-500 mt-1">
                        ETD: {item.etd}
                      </div>
                      <div className="text-sm text-slate-500">
                        Next: {item.nextDeparture}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{item.transit}</div>
                      <div className="text-xs text-amber-600 mt-1">{item.type}</div>
                      <div className="text-xs text-slate-600 mt-1">
                        Capacity: {item.capacity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-xl font-bold mb-4">Recommended Modules</h3>
              <div className="space-y-3 text-sm text-slate-700">
                {modules.map((item) => (
                  <div
                    key={item}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-100"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 订单详情模态框 */}
      {showOrderDetail && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Order Details</h3>
                <button
                  onClick={closeOrderDetail}
                  className="text-slate-400 hover:text-slate-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-500">Order Number</label>
                  <p className="text-lg font-semibold text-emerald-600">{selectedOrder.orderNo}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Status</label>
                  <p className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 ${
                    selectedOrder.status === 'Booked' ? 'bg-blue-100 text-blue-700' :
                    selectedOrder.status === 'Confirmed' ? 'bg-yellow-100 text-yellow-700' :
                    selectedOrder.status === 'In Transit' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedOrder.status}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Customer</label>
                  <p className="text-lg">{selectedOrder.customer}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Service</label>
                  <p className="text-lg">{selectedOrder.service}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Origin (POL)</label>
                  <p className="text-lg">{selectedOrder.pol}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Destination (POD)</label>
                  <p className="text-lg">{selectedOrder.pod}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">ATD</label>
                  <p className="text-lg">{selectedOrder.atd}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Estimated Transit</label>
                  <p className="text-lg">14-18 days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}