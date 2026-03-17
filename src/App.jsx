import { useState } from 'react';

export default function TXMHEurasiaLandingPage() {
  const [activeTab, setActiveTab] = useState('lcl');

  const europeRoutes = [
    "Germany",
    "Poland",
    "France",
    "Italy",
    "Czech Republic",
    "Hungary",
    "United Kingdom",
  ];

  const centralAsiaRoutes = ["Kazakhstan", "Uzbekistan", "Kyrgyzstan"];
  const russiaRoutes = ["Moscow", "St. Petersburg", "Yekaterinburg"];

  const highlights = [
    {
      title: "中欧门到门拼箱",
      desc: "全国提货、铁路干线、清关支持、欧洲末端派送，一站式覆盖。",
    },
    {
      title: "全国200+收货网点",
      desc: "覆盖中国主要制造业与出口城市，适合光伏、汽配、设备及一般贸易货。",
    },
    {
      title: "海运不稳，铁路更可控",
      desc: "近期海运绕行、舱位和时效波动明显，铁路时效更稳定，便于客户周转。",
    },
    {
      title: "欧洲全境配送",
      desc: "波兰枢纽到站后，可衔接卡车网络，支持欧洲全境门到门派送。",
    },
  ];

  const transit = [
    { name: "马拉快线", days: "10–15天" },
    { name: "汉堡快线", days: "14–16天" },
    { name: "杜伊斯堡快线", days: "14–16天" },
    { name: "布拉格 / 捷克", days: "约20天" },
    { name: "布达佩斯", days: "约22天" },
    { name: "米兰", days: "约25天" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold tracking-wide">TXMH-Eurasia</div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400 mt-1">
              Eurasia Rail Logistics
            </div>
          </div>
          <div className="hidden md:flex gap-6 text-sm">
            <button 
              onClick={() => setActiveTab('lcl')}
              className={`pb-2 border-b-2 transition ${activeTab === 'lcl' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
            >
              铁路拼箱 LCL
            </button>
            <button 
              onClick={() => setActiveTab('fcl')}
              className={`pb-2 border-b-2 transition ${activeTab === 'fcl' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
            >
              铁路整柜 FCL
            </button>
            <button 
              onClick={() => setActiveTab('europe')}
              className={`pb-2 border-b-2 transition ${activeTab === 'europe' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
            >
              欧洲全境配送
            </button>
            <button 
              onClick={() => setActiveTab('asia-russia')}
              className={`pb-2 border-b-2 transition ${activeTab === 'asia-russia' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
            >
              中亚 / 俄罗斯
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="uppercase tracking-[0.2em] text-sm text-slate-300 mb-4">
                China–Europe / Russia / Central Asia Rail Freight
              </p>
              <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
                中欧门到门铁路拼箱
                <span className="block text-amber-400">稳定时效 · 欧洲全境配送</span>
              </h1>
              <p className="text-lg text-slate-200 mb-8 max-w-xl leading-8">
                适合中国出口企业的欧亚铁路物流方案。支持拼箱（LCL）与整柜（FCL），全国 200+ 收货网点，覆盖欧洲、中亚及俄罗斯主要目的地。
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="px-6 py-3 rounded-2xl bg-amber-400 text-slate-900 font-semibold shadow-lg hover:scale-105 transition">
                  获取最新时效
                </button>
                <button className="px-6 py-3 rounded-2xl border border-slate-300 text-white hover:bg-white/10 transition">
                  立即询价
                </button>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-3xl p-6 shadow-2xl border border-white/10">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/10 p-5">
                  <div className="text-3xl font-bold text-amber-400">200+</div>
                  <div className="text-sm text-slate-200 mt-1">中国收货网点</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-5">
                  <div className="text-3xl font-bold text-amber-400">10–16天</div>
                  <div className="text-sm text-slate-200 mt-1">欧洲核心站点参考时效</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-5">
                  <div className="text-3xl font-bold text-amber-400">LCL/FCL</div>
                  <div className="text-sm text-slate-200 mt-1">拼箱 / 整柜双方案</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-5">
                  <div className="text-3xl font-bold text-amber-400">EU</div>
                  <div className="text-sm text-slate-200 mt-1">欧洲全境门到门</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">为什么选择铁路拼箱？</h2>
          <p className="text-slate-600 max-w-3xl mx-auto">
            当前海运绕行、时效波动、成本不确定性增加。铁路拼箱在速度、稳定性和综合成本之间，提供更适合出口企业的平衡方案。
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {highlights.map((item) => (
            <div key={item.title} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-lg transition">
              <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
              <p className="text-slate-600 text-sm leading-7">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">服务覆盖范围</h2>
            <p className="text-slate-600 mb-6">
              {activeTab === 'lcl' ? '拼箱服务支持全国 200+ 网点提货，覆盖欧洲、中亚、俄罗斯主要目的地。' : 
               activeTab === 'fcl' ? '整柜服务适合大批量出货，支持全国集港，更经济高效。' :
               activeTab === 'europe' ? '欧洲全境门到门派送，波兰枢纽清关后可直送欧洲各地。' :
               '直达中亚及俄罗斯主要城市，稳定班列时效。'}
            </p>

            <div className="space-y-6">
              {(activeTab === 'europe' || activeTab === 'lcl' || activeTab === 'fcl') && (
                <div>
                  <h3 className="font-semibold mb-3">欧洲直拼</h3>
                  <div className="flex flex-wrap gap-3">
                    {europeRoutes.map((route) => (
                      <span key={route} className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
                        {route}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(activeTab === 'asia-russia' || activeTab === 'lcl' || activeTab === 'fcl') && (
                <div>
                  <h3 className="font-semibold mb-3">中亚线路</h3>
                  <div className="flex flex-wrap gap-3">
                    {centralAsiaRoutes.map((route) => (
                      <span key={route} className="px-4 py-2 rounded-full bg-amber-50 text-slate-700 text-sm font-medium">
                        {route}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(activeTab === 'asia-russia' || activeTab === 'lcl' || activeTab === 'fcl') && (
                <div>
                  <h3 className="font-semibold mb-3">俄罗斯主要目的地</h3>
                  <div className="flex flex-wrap gap-3">
                    {russiaRoutes.map((route) => (
                      <span key={route} className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
                        {route}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl">
            <h3 className="text-2xl font-bold mb-4">典型服务流程</h3>
            <div className="space-y-4 text-slate-200 leading-7">
              <div>1. 中国工厂 / 仓库提货</div>
              <div>2. 起运站集拼 / 装柜</div>
              <div>3. 中欧班列发运</div>
              <div>4. 波兰枢纽清关 / 中转处理</div>
              <div>5. 欧洲卡车派送至最终收货地址</div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">近期欧洲主要站点参考时效</h2>
          <p className="text-slate-600">以下为近期参考时效，具体以实际班列计划与操作安排为准。</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {transit.map((item) => (
            <div key={item.name} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition">
              <div className="text-lg font-semibold mb-2">{item.name}</div>
              <div className="text-3xl font-bold text-amber-500">{item.days}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="bg-gradient-to-r from-amber-400 to-yellow-300 rounded-3xl p-8 md:p-12 shadow-xl">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">让铁路帮助客户更快周转</h2>
              <p className="text-slate-800 text-lg leading-8">
                特别适合光伏、汽配、设备及出口制造企业。在海运不稳定时期，用更可控的铁路方案，提升交付效率与客户体验。
              </p>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-md">
              <div className="space-y-4 text-sm text-slate-700 leading-7">
                <div><strong>品牌：</strong>TXMH-Eurasia</div>
                <div><strong>服务：</strong>中欧 / 中亚 / 中俄 铁路拼箱 & 整柜</div>
                <div><strong>优势：</strong>200+收货网点 / 欧洲全境配送 / 稳定班列时效</div>
                <button className="w-full mt-2 px-5 py-3 rounded-2xl bg-slate-900 text-white font-semibold hover:opacity-90 transition">
                  联系我们获取时效 & 报价
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
