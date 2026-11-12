import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { routeLandingPages } from "../src/data/routeLandingPages.js";

const root = new URL("../dist/", import.meta.url);
const base = await readFile(new URL("index.html", root), "utf8");
const origin = "https://www.eurasiago.com";
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const replaceMeta = (html, title, description, url) => html
  .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${esc(description)}" />`)
  .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${esc(url)}" />`)
  .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${esc(url)}" />`)
  .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${esc(title)}" />`)
  .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${esc(description)}" />`);
async function emit(path, title, description, html) {
  const url = origin + path;
  const output = replaceMeta(base, title, description, url).replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  const dir = new URL("." + path + "/", root);
  await mkdir(dir, {recursive:true});
  await writeFile(new URL("index.html", dir), output);
}
const routeLinks = routeLandingPages.filter(p=>!/(amazon-fba|europe-ddp)/.test(p.slug));
await emit("/routes", "中欧班列线路_德国波兰俄罗斯中亚铁路运输 | EurasiaGo",
  "查询中国至德国、波兰、俄罗斯、中亚的铁路运输线路、铁路拼箱及整柜运输服务。",
  `<main lang="zh-CN"><h1>中欧班列与国际铁路运输线路</h1><p>了解中国到欧洲、俄罗斯及中亚的铁路拼箱和整柜运输线路。具体班期、口岸及费用请以人工确认为准。</p><nav aria-label="铁路线路">${routeLinks.map(p=>`<p><a href="/routes/${esc(p.slug)}">${esc(p.title)}</a> — ${esc(p.origin)} 至 ${esc(p.destination)}</p>`).join("")}</nav><p><a href="/quote">获取铁路运输报价</a></p></main>`);
for (const p of routeLinks) {
  const title = `${p.origin} 至 ${p.destination} 铁路运输 | EurasiaGo`;
  const desc = `中国到${p.destination}铁路运输，提供拼箱 LCL、整柜 FCL 线路咨询。实际班期、运输时效及费用需人工确认。`;
  const body = `<main lang="zh-CN"><nav><a href="/">首页</a> / <a href="/routes">铁路运输线路</a></nav><h1>${esc(p.origin)} 至 ${esc(p.destination)} 铁路运输</h1><p>${esc(desc)}</p><h2>线路与服务范围</h2><p>起运地：${esc(p.origin)}；目的地：${esc(p.destination)}。</p><p>${esc(p.description)}</p><h2>适运货物参考</h2><ul>${p.cargoFit.map(c=>`<li>${esc(c)}</li>`).join("")}</ul><p>运输时效参考：${esc(p.transit)}。实际以班期、口岸、清关及派送条件为准。</p><p><a href="/quote">提交线路询价</a></p></main>`;
  await emit("/routes/"+p.slug,title,desc,body);
}
console.log(`Generated ${routeLinks.length+1} crawlable route HTML files`);
