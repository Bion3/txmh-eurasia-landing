export default function ContactCTA() {
  return (
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
  )
}
