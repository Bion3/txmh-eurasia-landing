export default function App() {
    { name: '杜伊斯堡快线', days: '14–16天' },
    { name: '布拉格 / 捷克', days: '约20天' },
    { name: '布达佩斯', days: '约22天' },
    { name: '米兰', days: '约25天' },
  ]

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
          <div className="hidden md:flex gap-6 text-sm text-slate-300">
            <span>铁路拼箱 LCL</span>
            <span>铁路整柜 FCL</span>
            <span>欧洲全境配送</span>
            <span>中亚 / 俄罗斯</span>
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
              我们提供中国至欧洲、中亚、俄罗斯的铁路拼箱与整柜服务，并支持欧洲目的港后的全境派送。
            </p>

            <div className="space-y-6">
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
