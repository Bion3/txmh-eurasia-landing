export default function CoverageSection({ europeRoutes, centralAsiaRoutes, russiaRoutes }) {
  return (
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
                  <span
                    key={route}
                    className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-medium"
                  >
                    {route}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">中亚线路</h3>
              <div className="flex flex-wrap gap-3">
                {centralAsiaRoutes.map((route) => (
                  <span
                    key={route}
                    className="px-4 py-2 rounded-full bg-amber-50 text-slate-700 text-sm font-medium"
                  >
                    {route}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">俄罗斯主要目的地</h3>
              <div className="flex flex-wrap gap-3">
                {russiaRoutes.map((route) => (
                  <span
                    key={route}
                    className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-medium"
                  >
                    {route}
                  </span>
                ))}
              </div>
            </div>
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
  )
}
