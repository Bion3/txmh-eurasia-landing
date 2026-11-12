import { useEffect } from "react";
import { routeLandingPages, routeQuoteSearch } from "../data/routeLandingPages";

const hidden = new Set([
  "china-to-amazon-fba-germany-rail-ddp",
  "china-to-europe-ddp-rail-door-delivery",
  "shenzhen-guangzhou-to-germany-door-delivery",
  "china-to-poland-warehouse-rail-freight",
]);
const routes = routeLandingPages.filter((page) => !hidden.has(page.slug));
const zhRoutes = {
  "xian-chengdu-chongqing-to-duisburg": ["德国 · 杜伊斯堡", "西安、成都、重庆至杜伊斯堡，提供铁路拼箱、整柜及德国境内配送衔接。", "西安 / 成都 / 重庆", "杜伊斯堡", "铁路拼箱 / 整柜"],
  "yiwu-shenzhen-guangzhou-to-warsaw": ["波兰 · 华沙 / 马拉舍维奇", "义乌、深圳、广州至波兰铁路运输，衔接华沙仓库及东欧配送。", "义乌 / 深圳 / 广州", "华沙 / 马拉舍维奇", "波兰及东欧"],
  "zhengzhou-wuhan-to-hamburg-paris-milan": ["西欧 · 汉堡 / 巴黎 / 米兰", "郑州、武汉出发，衔接汉堡、巴黎、米兰及周边目的地。", "郑州 / 武汉", "汉堡 / 巴黎 / 米兰", "西欧配送"],
  "china-to-kazakhstan-central-asia-rail-truck": ["中亚 · 哈萨克斯坦及周边", "中国至哈萨克斯坦、乌兹别克斯坦及吉尔吉斯斯坦的铁路和公路运输。", "中国主要铁路站点", "阿拉木图 / 塔什干 / 比什凯克", "铁路 / 公路"],
  "china-to-russia-rail-truck-door-delivery": ["俄罗斯 · 莫斯科等", "中国至俄罗斯主要城市的铁路、汽运及末端配送方案。", "中国主要铁路站点", "莫斯科 / 圣彼得堡", "铁路 / 公路"],
  "eurasia-continental-truck-freight": ["欧亚国际公路运输", "中国至中亚、俄罗斯及欧洲部分地区的国际公路运输服务。", "中国工厂 / 仓库", "中亚 / 俄罗斯 / 欧洲", "国际汽运"],
};
const copy = {
  zh: {
    eyebrow: "EURASIAGO · 国际铁路运输",
    title: "中欧班列及国际铁路运输线路",
    intro: "按目的地查看主要运输线路，了解拼箱、整柜及公路衔接方案。运价、班期和具体操作要求以实际确认结果为准。",
    quote: "前往运价查询", home: "返回首页", origin: "起运地", destination: "目的地",
    details: "线路详情", routeQuote: "查询此线路报价", section: "主要运输线路",
    note: "没有找到合适的线路？可直接进入报价页面填写起运地、目的地和货物信息。",
    noteAction: "获取报价", transit: "参考运输时效", disclaimer: "实际运输时间受班期、口岸及清关等因素影响。",
  },
  en: {
    eyebrow: "EURASIAGO · RAIL FREIGHT",
    title: "China–Europe & Eurasia rail freight routes",
    intro: "Explore major freight corridors by destination, including LCL, FCL and connecting road transport. Rates, schedules and operating requirements are subject to confirmation.",
    quote: "Get a freight quote", home: "Back to homepage", origin: "Origin", destination: "Destination",
    details: "Route details", routeQuote: "Quote this route", section: "Main freight corridors",
    note: "Can't find your route? Enter your origin, destination and cargo details on the quote page.",
    noteAction: "Request a quote", transit: "Indicative transit time", disclaimer: "Actual transit times depend on schedules, border operations and customs clearance.",
  },
};

export default function RouteIndexPage({ locale = "en" }) {
  const language = locale === "zh" ? "zh" : "en";
  const t = copy[language];

  useEffect(() => {
    const id = "route-index-jsonld";
    document.getElementById(id)?.remove();
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "China–Europe and Eurasia rail freight routes",
      itemListElement: routes.map((page, index) => ({
        "@type": "ListItem", position: index + 1,
        name: page.title,
        url: `https://www.eurasiago.com/routes/${page.slug}`,
      })),
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <main className="bg-white text-slate-900" lang={language === "zh" ? "zh-CN" : "en"}>
      <section className="bg-slate-950 px-6 py-14 text-white md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">{t.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight md:text-5xl">{t.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">{t.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="/quote" className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300">{t.quote}</a>
            <a href="/" className="rounded-xl border border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">{t.home}</a>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <h2 className="mb-6 text-2xl font-bold">{t.section}</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {routes.map((page) => {
            const localized = zhRoutes[page.slug];
            const name = language === "zh" && localized ? localized[0] : page.title;
            const description = language === "zh" && localized ? localized[1] : page.description;
            const origin = language === "zh" && localized ? localized[2] : page.origin;
            const destination = language === "zh" && localized ? localized[3] : page.destination;
            return (
              <article key={page.slug} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold leading-7">{name}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{description}</p>
                <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                  <div><span className="text-slate-500">{t.origin}：</span><strong>{origin}</strong></div>
                  <div><span className="text-slate-500">{t.destination}：</span><strong>{destination}</strong></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href={`/routes/${page.slug}`} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">{t.details}</a>
                  <a href={`/quote${routeQuoteSearch(page)}`} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">{t.routeQuote}</a>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-slate-500">{t.disclaimer}</p>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-100 p-6">
          <p className="max-w-2xl text-sm leading-6 text-slate-700">{t.note}</p>
          <a href="/quote" className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600">{t.noteAction}</a>
        </div>
      </section>
    </main>
  );
}
