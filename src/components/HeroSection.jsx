export default function HeroSection() {
  return (
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
  )
}
