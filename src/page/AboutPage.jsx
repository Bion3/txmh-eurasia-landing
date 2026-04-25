export default function AboutPage({ locale, text }) {
  const content = locale === "zh" ? zhContent : enContent;

  return (
    <main>
      {/* Hero Section */}
      <section className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            {content.title}
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
            {content.subtitle}
          </p>
        </div>
      </section>

      {/* Introduction Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-20">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="prose prose-lg text-gray-600 max-w-none">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">{content.intro.heading}</h2>
            <p className="leading-relaxed">{content.intro.paragraph1}</p>
            <p className="mt-4 leading-relaxed">{content.intro.paragraph2}</p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {content.strengths.map((strength, index) => (
              <div key={index} className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-shadow duration-300">
                <h3 className="font-semibold text-gray-900 text-lg">{strength.title}</h3>
                <p className="mt-3 text-gray-600">{strength.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Keywords Section */}
      <section className="bg-blue-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-10">{content.keywords.title}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {content.keywords.list.map((keyword, index) => (
              <span key={index} className="px-5 py-2 rounded-full bg-blue-100 text-blue-800 font-semibold">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

// Chinese Content
const zhContent = {
  title: "连接亚洲与欧洲的物流动脉",
  subtitle: "我们专注于中欧铁路运输，提供从拼箱、整箱到欧洲全境派送的一站式综合物流解决方案。",
  intro: {
    heading: "关于我们：EurasiaGo",
    paragraph1: "作为专业的中欧铁路物流供应商，EurasiaGo 精于铁路拼箱 (LCL) 与整箱 (FCL) 服务。我们整合了欧洲全境的清关与派送网络，并提供覆盖中亚及俄罗斯的多式联运方案，为客户打造无缝、高效的跨境物流体验。",
    paragraph2: "我们凭借深厚的行业知识、广泛的全球运营网络以及对客户需求的敏锐洞察，无论是小批量货物还是大宗运输，都能提供量身定制的方案，确保货物安全、准时地送达目的地。"
  },
  strengths: [
    { title: "铁路拼箱 (LCL)", desc: "灵活经济，适合小批量、多频次货物。" },
    { title: "铁路整箱 (FCL)", desc: "稳定可靠，保障大批量货物准时到达。" },
    { title: "欧洲全境服务", desc: "无缝整合清关与最后一公里派送。" },
    { title: "定制化解决方案", desc: "面向中亚和俄罗斯的专业多式联运。" },
  ],
  keywords: {
    title: "核心业务关键词",
    list: [
      "中欧班列", "铁路拼箱", "LCL", "整箱", "FCL", "欧洲清关", "欧洲派送", "中亚物流", "俄罗斯运输", "多式联运", "跨境电商物流", "国际货运代理"
    ]
  }
};

// English Content
const enContent = {
  title: "The Logistic Artery Connecting Asia and Europe",
  subtitle: "We specialize in China-Europe rail transport, offering one-stop integrated logistics solutions from LCL and FCL to last-mile delivery across Europe.",
  intro: {
    heading: "About Us: EurasiaGo",
    paragraph1: "As a professional China-Europe rail logistics provider, EurasiaGo excels in Less than Container Load (LCL) and Full Container Load (FCL) services. We have an integrated customs clearance and delivery network across Europe and offer multimodal solutions covering Central Asia and Russia, creating a seamless and efficient cross-border logistics experience for our clients.",
    paragraph2: "Leveraging our deep industry knowledge, extensive global operational network, and a keen insight into customer needs, we provide tailored solutions for both small-batch shipments and large-scale transportation, ensuring goods are delivered safely and on time."
  },
  strengths: [
    { title: "Rail LCL", desc: "Flexible and economical for small, frequent shipments." },
    { title: "Rail FCL", desc: "Stable and reliable for timely delivery of large volumes." },
    { title: "All-Europe Service", desc: "Seamlessly integrated customs and final-mile delivery." },
    { title: "Customized Solutions", desc: "Professional multimodal transport for Central Asia & Russia." },
  ],
  keywords: {
    title: "Core Business Keywords",
    list: [
      "China-Europe Railway Express", "Rail LCL", "LCL", "Rail FCL", "FCL", "European Customs Clearance", "Europe Delivery", "Central Asia Logistics", "Russia Transport", "Multimodal Transport", "Cross-border E-commerce Logistics", "International Freight Forwarding"
    ]
  }
};