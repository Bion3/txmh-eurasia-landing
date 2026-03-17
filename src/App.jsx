import { useState } from 'react';

export default function TXMHEurasiaLandingPage() {
  const [activeTab, setActiveTab] = useState('lcl');
  const [currentPage, setCurrentPage] = useState('home');
  const [locale, setLocale] = useState('zh');

  const i18n = {
    zh: {
      siteTitle: 'TXMH-Eurasia',
      siteSub: 'Eurasia Rail Logistics',
      tabLcl: '铁路拼箱 LCL',
      tabFcl: '铁路整柜 FCL',
      tabEurope: '欧洲全境配送',
      tabAsiaRussia: '中亚 / 俄罗斯',
      heroLabel: 'China–Europe / Russia / Central Asia Rail Freight',
      heroTitle: '中欧门到门铁路拼箱',
      heroSubtitle: '稳定时效 · 欧洲全境配送',
      heroText: '适合中国出口企业的欧亚铁路物流方案。支持拼箱（LCL）与整柜（FCL），全国 200+ 收货网点，覆盖欧洲、中亚及俄罗斯主要目的地。',
      btnEta: '获取最新时效',
      btnQuote: '立即询价',
      whyTitle: '为什么选择铁路拼箱？',
      whyText: '当前海运绕行、时效波动、成本不确定性增加。铁路拼箱在速度、稳定性和综合成本之间，提供更适合出口企业的平衡方案。',
      serviceTitle: '服务覆盖范围',
      serviceDescLcl: '拼箱服务支持全国 200+ 网点提货，覆盖欧洲、中亚、俄罗斯主要目的地。',
      serviceDescFcl: '整柜服务适合大批量出货，支持全国集港，更经济高效。',
      serviceDescEurope: '欧洲全境门到门派送，波兰枢纽清关后可直送欧洲各地。',
      serviceDescAsia: '直达中亚及俄罗斯主要城市，稳定班列时效。',
      timelineTitle: '典型服务流程',
      timelineSteps: [
        '下单确认：测算体积重量、报价核价',
        '提货进仓：全国收货网点揽收、集中拼箱',
        '铁路运输：班列出发至波兰枢纽/中亚枢纽',
        '清关派送：目的地清关、欧洲/中亚/俄罗斯派送',
        '签收反馈：到站确认、图片回传、异常处理',
      ],
      laterTitle: '近期欧洲主要站点参考时效',
      laterText: '以下为近期参考时效，具体以实际班列计划与操作安排为准。',
      finalTitle: '让铁路帮助客户更快周转',
      finalText: '特别适合光伏、汽配、设备及出口制造企业。在海运不稳定时期，用更可控的铁路方案，提升交付效率与客户体验。',
      cardBrand: '品牌：',
      cardService: '服务：',
      cardAdvantage: '优势：',
      cardBtn: '联系我们获取时效 & 报价',
      lclDetailTitle: '铁路拼箱（LCL）服务说明',
      lclDetailDesc: 'LCL（Less than Container Load）适合中小批量货物，按体积或重量计费，可与其他客户货物拼柜运输，成本与效率更佳。',
      applicableTitle: '适用场景',
      applicableItems: [
        '单票货量少于整柜或不满一柜',
        '订单频率中高、资金周转快',
        '希望减少库存压力、分批发运',
        '普货、轻小件或非危险品',
      ],
      advantageTitle: '服务优势',
      advantageItems: [
        '成本按实际体积 / 重量计费，更灵活',
        '全国 200+ 提货网点，覆盖中国主要产区',
        '欧洲中转清关、末端派送一站式跟进',
        '实时班列跟踪、专业客户服务支持',
      ],
      backButton: '返回首页',
    },
    en: {
      siteTitle: 'TXMH-Eurasia',
      siteSub: 'Eurasia Rail Logistics',
      tabLcl: 'Rail LCL',
      tabFcl: 'Rail FCL',
      tabEurope: 'EU Delivery',
      tabAsiaRussia: 'Central Asia / Russia',
      heroLabel: 'China–Europe / Russia / Central Asia Rail Freight',
      heroTitle: 'Door-to-Door Railway LCL',
      heroSubtitle: 'Stable Transit · Europe Wide Delivery',
      heroText: 'A Eurasia rail logistics solution for Chinese exporters. Supports LCL and FCL, 200+ pickup points across China, covering Europe, Central Asia, and Russia.',
      btnEta: 'Get Transit Time',
      btnQuote: 'Get Quote',
      whyTitle: 'Why Choose Rail LCL?',
      whyText: 'As ocean rates fluctuate and schedules vary, rail LCL offers better balance between speed, reliability and cost for exporters.',
      serviceTitle: 'Service Coverage',
      serviceDescLcl: 'LCL service with 200+ pickup locations, covering Europe, Central Asia and Russia.',
      serviceDescFcl: 'FCL service ideal for large volumes with port consolidation nationwide.',
      serviceDescEurope: 'Europe-wide door-to-door delivery via Poland hub clearance.',
      serviceDescAsia: 'Direct rail routes to Central Asia and Russia with stable schedules.',
      timelineTitle: 'Typical Service Flow',
      timelineSteps: [
        'Order confirmation: calculate volume/weight and quote',
        'Pickup & consolidation: nationwide collection and container loading',
        'Rail transit: train departure to Poland/Central Asia hub',
        'Customs & delivery: clearance and final delivery',
        'Delivery confirmation: arrival check, photo feedback, exception handling',
      ],
      laterTitle: 'Recent EU Main Route Transit Times',
      laterText: 'Reference transit times. Final times depend on actual train schedules.',
      finalTitle: 'Faster Turnaround with Rail',
      finalText: 'Best for PV, auto parts, equipment and export manufacturing. Stable rail solution improves delivery and customer experience.',
      cardBrand: 'Brand:',
      cardService: 'Service:',
      cardAdvantage: 'Advantage:',
      cardBtn: 'Contact us for transit time & quote',
      lclDetailTitle: 'Rail LCL Service Description',
      lclDetailDesc: 'LCL is for small/medium shipments; charged by volume or weight; combined freight in containers improves cost-efficiency.',
      applicableTitle: 'Applicable Scenarios',
      applicableItems: [
        'Shipment less than full container',
        'High frequency orders and quick turnover',
        'Reduce inventory pressure with partial shipments',
        'General cargo, small items, non-hazardous',
      ],
      advantageTitle: 'Service Advantages',
      advantageItems: [
        'Flexible charges by actual volume/weight',
        '200+ pickup points nationwide',
        'One-stop customs and delivery',
        'Train tracking and dedicated support',
      ],
      backButton: 'Back to Home',
    },
    ru: {
      siteTitle: 'TXMH-Eurasia',
      siteSub: 'Eurasia Rail Logistics',
      tabLcl: 'ЖД LCL',
      tabFcl: 'ЖД FCL',
      tabEurope: 'Доставка по ЕС',
      tabAsiaRussia: 'ЦА / Россия',
      heroLabel: 'ЖД грузоперевозки Китай–Европа / Россия / Центральная Азия',
      heroTitle: 'Дверь в дверь железная дорога LCL',
      heroSubtitle: 'Стабильное время в пути · Доставка по всей Европе',
      heroText: 'Логистика по Евразии для китайских экспортеров. Поддержка LCL и FCL, 200+ пунктов приема по Китаю, покрытие Европы, ЦА и России.',
      btnEta: 'Узнать срок',
      btnQuote: 'Запросить цену',
      whyTitle: 'Почему LCL по железной дороге?',
      whyText: 'Когда морские маршруты нестабильны, железная дорога предлагает сбалансированный вариант скорости, надежности и стоимости.',
      serviceTitle: 'Область обслуживания',
      serviceDescLcl: 'LCL через 200+ пунктов приема, покрытие Европа/ЦА/Россия.',
      serviceDescFcl: 'FCL для больших объемов с консолидацией по стране.',
      serviceDescEurope: 'Доставка по Европе через польский хаб.',
      serviceDescAsia: 'Прямые маршруты в ЦА и Россию с стабильным графиком.',
      timelineTitle: 'Типичный процесс',
      timelineSteps: [
        'Подтверждение заказа: расчет объема/веса и цены',
        'Прием и консолидация: сбор по стране, загрузка',
        'Железная дорога: отправка поезда в польский/ЦА хаб',
        'Таможня и доставка: оформление и доставка',
        'Подтверждение: прием, фотоотчет, обработка ошибок',
      ],
      laterTitle: 'Сроки по основным маршрутам ЕС',
      laterText: 'Примерные сроки. Фактические зависят от графика поездов.',
      finalTitle: 'Быстрее с железной дорогой',
      finalText: 'Подходит для солнечных панелей, автозапчастей, оборудования и экспорта.',
      cardBrand: 'Бренд:',
      cardService: 'Сервис:',
      cardAdvantage: 'Преимущества:',
      cardBtn: 'Связаться для срока и цены',
      lclDetailTitle: 'Описание сервиса LCL',
      lclDetailDesc: 'LCL для малых/средних грузов, оплата за объем/вес, совместная загрузка снижает стоимость.',
      applicableTitle: 'Сценарии',
      applicableItems: [
        'Меньше контейнера',
        'Частые заказы, быстрая оборачиваемость',
        'Снижение складских запасов',
        'Обычный, мелкий, неопасный груз',
      ],
      advantageTitle: 'Преимущества',
      advantageItems: [
        'Гибкая тарификация по объему/весу',
        '200+ пунктов приема',
        'Таможня и доставка «под ключ»',
        'Отслеживание и поддержка',
      ],
      backButton: 'Назад на главную',
    },
  };

  const t = i18n[locale];

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

  if (currentPage === 'lclDetail') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold tracking-wide">TXMH-Eurasia</div>
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400 mt-1">铁路拼箱 LCL 详情</div>
            </div>
            <div className="hidden md:flex gap-6 text-sm">
              <button
                onClick={() => {
                  setActiveTab('lcl');
                  setCurrentPage('lclDetail');
                }}
                className={`pb-2 border-b-2 transition ${activeTab === 'lcl' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
              >
                铁路拼箱 LCL
              </button>
              <button
                onClick={() => {
                  setActiveTab('fcl');
                  setCurrentPage('home');
                }}
                className={`pb-2 border-b-2 transition ${activeTab === 'fcl' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
              >
                铁路整柜 FCL
              </button>
              <button
                onClick={() => {
                  setActiveTab('europe');
                  setCurrentPage('home');
                }}
                className={`pb-2 border-b-2 transition ${activeTab === 'europe' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
              >
                欧洲全境配送
              </button>
              <button
                onClick={() => {
                  setActiveTab('asia-russia');
                  setCurrentPage('home');
                }}
                className={`pb-2 border-b-2 transition ${activeTab === 'asia-russia' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
              >
                中亚 / 俄罗斯
              </button>
            </div>
            <button
              onClick={() => setCurrentPage('home')}
              className="px-4 py-2 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-200 transition"
            >
              {t.backButton}
            </button>
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.lclDetailTitle}</h2>
          <p className="text-slate-600 leading-7 mb-6">
            {t.lclDetailDesc}
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-xl font-semibold mb-3">{t.applicableTitle}</h3>
              <ul className="list-disc list-inside text-slate-600 space-y-2">
                {t.applicableItems.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-xl font-semibold mb-3">{t.advantageTitle}</h3>
              <ul className="list-disc list-inside text-slate-600 space-y-2">
                {t.advantageItems.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 rounded-3xl bg-slate-950 text-white p-6">
            <h3 className="text-xl font-semibold mb-3">典型流程</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>下单确认：测算体积重量、报价核价</li>
              <li>提货进仓：全国收货网点揽收、集中拼箱</li>
              <li>铁路运输：班列出发至波兰枢纽/中亚枢纽</li>
              <li>清关派送：目的地清关、欧洲/中亚/俄罗斯派送</li>
              <li>签收反馈：到站确认、图片回传、异常处理</li>
            </ol>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
              <div className="text-2xl font-bold tracking-wide">{t.siteTitle}</div>
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400 mt-1">
                {t.siteSub}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLocale('zh')}
                className={`px-2 py-1 rounded ${locale === 'zh' ? 'bg-amber-400 text-slate-900' : 'bg-white/20 text-white hover:bg-white/30'}`}
              >中文</button>
              <button
                onClick={() => setLocale('en')}
                className={`px-2 py-1 rounded ${locale === 'en' ? 'bg-amber-400 text-slate-900' : 'bg-white/20 text-white hover:bg-white/30'}`}
              >EN</button>
              <button
                onClick={() => setLocale('ru')}
                className={`px-2 py-1 rounded ${locale === 'ru' ? 'bg-amber-400 text-slate-900' : 'bg-white/20 text-white hover:bg-white/30'}`}
              >RU</button>
            </div>
          <div className="hidden md:flex gap-6 text-sm">
            <button 
              onClick={() => {
                setActiveTab('lcl');
                setCurrentPage('lclDetail');
              }}
              className={`pb-2 border-b-2 transition ${activeTab === 'lcl' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
            >
              {t.tabLcl}
            </button>
            <button 
              onClick={() => {
                setActiveTab('fcl');
                setCurrentPage('home');
              }}
              className={`pb-2 border-b-2 transition ${activeTab === 'fcl' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
            >
              {t.tabFcl}
            </button>
            <button 
              onClick={() => {
                setActiveTab('europe');
                setCurrentPage('home');
              }}
              className={`pb-2 border-b-2 transition ${activeTab === 'europe' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
            >
              {t.tabEurope}
            </button>
            <button 
              onClick={() => {
                setActiveTab('asia-russia');
                setCurrentPage('home');
              }}
              className={`pb-2 border-b-2 transition ${activeTab === 'asia-russia' ? 'border-amber-400 text-amber-400 font-semibold' : 'border-transparent text-slate-300 hover:text-white'}`}
            >
              {t.tabAsiaRussia}
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="uppercase tracking-[0.2em] text-sm text-slate-300 mb-4">
                {t.heroLabel}
              </p>
              <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
                {t.heroTitle}
                <span className="block text-amber-400">{t.heroSubtitle}</span>
              </h1>
              <p className="text-lg text-slate-200 mb-8 max-w-xl leading-8">
                {t.heroText}
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="px-6 py-3 rounded-2xl bg-amber-400 text-slate-900 font-semibold shadow-lg hover:scale-105 transition">
                  {t.btnEta}
                </button>
                <button className="px-6 py-3 rounded-2xl border border-slate-300 text-white hover:bg-white/10 transition">
                  {t.btnQuote}
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
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{t.whyTitle}</h2>
          <p className="text-slate-600 max-w-3xl mx-auto">
            {t.whyText}
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.serviceTitle}</h2>
            <p className="text-slate-600 mb-6">
              {activeTab === 'lcl' ? t.serviceDescLcl : 
               activeTab === 'fcl' ? t.serviceDescFcl :
               activeTab === 'europe' ? t.serviceDescEurope :
               t.serviceDescAsia}
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
            <h3 className="text-2xl font-bold mb-4">{t.timelineTitle}</h3>
            <div className="space-y-4 text-slate-200 leading-7">
              {t.timelineSteps.map((step, idx) => (
                <div key={idx}>{idx + 1}. {step}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{t.laterTitle}</h2>
          <p className="text-slate-600">{t.laterText}</p>
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
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{t.finalTitle}</h2>
              <p className="text-slate-800 text-lg leading-8">
                {t.finalText}
              </p>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-md">
              <div className="space-y-4 text-sm text-slate-700 leading-7">
                <div><strong>{t.cardBrand}</strong>TXMH-Eurasia</div>
                <div><strong>{t.cardService}</strong>中欧 / 中亚 / 中俄 铁路拼箱 & 整柜</div>
                <div><strong>{t.cardAdvantage}</strong>200+收货网点 / 欧洲全境配送 / 稳定班列时效</div>
                <button className="w-full mt-2 px-5 py-3 rounded-2xl bg-slate-900 text-white font-semibold hover:opacity-90 transition">
                  {t.cardBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
