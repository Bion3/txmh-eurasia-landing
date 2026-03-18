export default function ServiceHighlights({ highlights }) {
  return (
    <section className="max-w-7xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">为什么选择铁路拼箱？</h2>
        <p className="text-slate-600 max-w-3xl mx-auto">
          当前海运绕行、时效波动、成本不确定性增加。铁路拼箱在速度、稳定性和综合成本之间，提供更适合出口企业的平衡方案。
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {highlights.map((item) => (
          <div
            key={item.title}
            className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-lg transition"
          >
            <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
            <p className="text-slate-600 text-sm leading-7">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
