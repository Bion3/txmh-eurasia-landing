import HeroSection from './components/HeroSection'
import ServiceHighlights from './components/ServiceHighlights'
import CoverageSection from './components/CoverageSection'
import MiniTMSSection from './components/MiniTMSSection'
import ContactCTA from './components/ContactCTA'

export default function TXMHEurasiaLandingPage() {
  const europeRoutes = [
    'Germany',
    'Poland',
    'France',
    'Italy',
    'Czech Republic',
    'Hungary',
    'United Kingdom',
  ]

  const centralAsiaRoutes = ['Kazakhstan', 'Uzbekistan', 'Kyrgyzstan']
  const russiaRoutes = ['Moscow', 'St. Petersburg', 'Yekaterinburg']

  const highlights = [
    {
      title: '中欧门到门拼箱',
      desc: '全国提货、铁路干线、清关支持、欧洲末端派送，一站式覆盖。',
    },
    {
      title: '全国200+收货网点',
      desc: '覆盖中国主要制造业与出口城市，适合光伏、汽配、设备及一般贸易货。',
    },
    {
      title: '海运不稳，铁路更可控',
      desc: '近期海运绕行、舱位和时效波动明显，铁路时效更稳定，便于客户周转。',
    },
    {
      title: '欧洲全境配送',
      desc: '波兰枢纽到站后，可衔接卡车网络，支持欧洲全境门到门派送。',
    },
  ]

  const transit = [
    { name: '马拉快线', days: '10–15天' },
    { name: '汉堡快线', days: '14–16天' },
    { name: '杜伊斯堡快线', days: '14–16天' },
    { name: '布拉格 / 捷克', days: '约20天' },
    { name: '布达佩斯', days: '约22天' },
    { name: '米兰', days: '约25天' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <HeroSection />

      <ServiceHighlights highlights={highlights} />

      <CoverageSection
        europeRoutes={europeRoutes}
        centralAsiaRoutes={centralAsiaRoutes}
        russiaRoutes={russiaRoutes}
      />

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

      <MiniTMSSection />

      <ContactCTA />
    </div>
  )
}
