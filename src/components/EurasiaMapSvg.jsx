import { mapUi, stationNamesEn } from "../data/mapLocale";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { hubs, routes } from "../data/eurasiaMapNetwork";

// Equirectangular geographic projection: every marker and boundary uses the same lon/lat transform.
const W = 1100, H = 510;
const WEST = -13, EAST = 136, NORTH = 65, SOUTH = 10;
const project = ([lon, lat]) => [((lon-WEST)/(EAST-WEST))*W, ((NORTH-lat)/(NORTH-SOUTH))*H];
const polygonPath = (rings) => rings.map(ring => ring.map((pt,i) => {
  const [x,y]=project(pt); return (i===0?"M":"L")+x.toFixed(2)+","+y.toFixed(2);
}).join(" ")+" Z").join(" ");
function featurePath(feature) {
  const g=feature.geometry;
  if(!g) return "";
  if(g.type==="Polygon") return polygonPath(g.coordinates);
  if(g.type==="MultiPolygon") return g.coordinates.map(polygonPath).join(" ");
  return "";
}
const colors = {feeder:"#93c5fd",main:"#2563eb",europe:"#0d9488",central:"#16a34a",westasia:"#ea580c"};
const hubColors={origin:"#dc2626",border:"#f59e0b",hub:"#2563eb"};
// Corridor filters use route IDs and endpoints rather than a separate copy of network data.
const corridorGroups={
  manzhouli:["border-manchuria","ru-zabaikalsk-chita","ru-chita-irkutsk","ru-irkutsk-novosibirsk","ru-novosibirsk-yekaterinburg","ru-yekaterinburg-moscow","ru-moscow-stpetersburg","f-harbin-manzhouli","f-xian-manzhouli","f-shenyang-changchun","f-changchun-harbin","f-shijiazhuang-manzhouli","f-jinan-manzhouli"],
  erenhot:["border-mongolia","mn-zamynuud-ulaanbaatar","mn-ulaanbaatar-sukhbaatar","mn-sukhbaatar-naushki","ru-naushki-ulanude","ru-ulanude-irkutsk","ru-irkutsk-novosibirsk","ru-novosibirsk-yekaterinburg","ru-yekaterinburg-moscow","f-shijiazhuang-erlian","f-jinan-erlian"],
  west:["trunk-west","trunk-khorgos","border-dostyk","border-altynkol","europe-moscow","central-almaty","central-tashkent","caspian-aktau","caspian-baku","iran-tehran","iran-mary","iran-ashgabat","turkiye-istanbul"]
};
const worldUrl="/data/world.geojson";
export default function EurasiaMapSvg({ mapText, locale="en", onQuote }) {
  const ui=mapUi[locale==="zh"?"zh":"en"];
  const stationName=(id)=>locale==="zh"?(byId[id]?.label||id):(stationNamesEn[id]||byId[id]?.label||id);
  const mapScrollRef=useRef(null);
  const stationRefs=useRef({});
  const [features,setFeatures]=useState([]);
  const [mapError,setMapError]=useState(false);
  const [mapRetry,setMapRetry]=useState(0);
  const [selected,setSelected]=useState(null);
  const [search,setSearch]=useState("");
  const [corridor,setCorridor]=useState("all");
  const [showAllStations,setShowAllStations]=useState(false);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [show,setShow]=useState({feeder:true,main:true,europe:true,central:true,westasia:true});
  useEffect(()=>{
    let live=true;
    const controller=new AbortController();
    setMapError(false);
    const timeout=setTimeout(()=>controller.abort(),12000);
    fetch(worldUrl,{signal:controller.signal,cache:"force-cache"})
      .then(r=>{if(!r.ok)throw new Error("map fetch");return r.json()})
      .then(data=>{if(live){setFeatures(data.features||[]);setMapError(!(data.features||[]).length)}})
      .catch(()=>{if(live)setMapError(true)})
      .finally(()=>clearTimeout(timeout));
    return ()=>{live=false;clearTimeout(timeout);controller.abort()};
  },[mapRetry]);
  const byId=useMemo(()=>Object.fromEntries(hubs.map(h=>[h.id,h])),[]);
  const visibleRoutes=routes.filter(r=>show[r.kind]);
  const sharedFeederIds=["f-suzhou-xuzhou","f-xuzhou-shijiazhuang","f-xuzhou-jinan"];
  const sharedEuropeIds=["europe-minsk","europe-brest","europe-border-mala","europe-mala","europe-hamburg","europe-duisburg","europe-paris","europe-budapest","europe-milan","europe-prague","europe-rotterdam","europe-liege","europe-katowice","europe-gdansk","europe-vienna","europe-munich","europe-verona","europe-belgrade"];
  const routeInCorridor=(r)=>corridor==="all"||corridorGroups[corridor]?.includes(r.id)||sharedFeederIds.includes(r.id)||sharedEuropeIds.includes(r.id);
  const matchingStations=search.trim()?hubs.filter(h=>`${h.label} ${stationNamesEn[h.id]||""}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0,8):[];
  const selectStation=(h)=>{setSelected({type:"hub",value:h});jumpTo(h.lon);setSearch("");};
  const jumpTo=(lon)=>{const el=mapScrollRef.current;if(!el)return;const width=el.scrollWidth;const target=((lon-WEST)/(EAST-WEST))*width-el.clientWidth/2;el.scrollTo({left:Math.max(0,target),behavior:"smooth"});};
  const routePath=(route)=>{
    const start=byId[route.points[0]],end=byId[route.points[route.points.length-1]];
    if(!start||!end)return "";
    return [[start.lon,start.lat],...(route.via||[]),[end.lon,end.lat]].map((point,i)=>{
      const [x,y]=project(point);return (i?"L":"M")+x.toFixed(2)+","+y.toFixed(2);
    }).join(" ");
  };
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#c9eafb] shadow-sm">
    <style>{`
      .eurasia-flow{stroke-dasharray:8 12;animation:eurasiaFlow 7s linear infinite;stroke-linecap:round}
      @keyframes eurasiaFlow{to{stroke-dashoffset:-80}}
      @media(prefers-reduced-motion:reduce){.eurasia-flow{animation:none}}
      @media(max-width:767px){.eurasia-map-label{display:none}.eurasia-map-label.active{display:block}}
    `}</style>
    <div className="border-b border-slate-200 bg-white/95 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm"><span className="sr-only">{locale==="zh"?"搜索目的站":"Search destination"}</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={locale==="zh"?"搜索目的站，或直接点击地图":"Search destination or tap the map"} className="min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" aria-label={locale==="zh"?"搜索目的站":"Search destination"}/></label>
        <label className="min-w-0 flex-1 sm:max-w-xs"><span className="sr-only">{locale==="zh"?"出境通道":"Border corridor"}</span><select value={corridor} onChange={e=>{setCorridor(e.target.value);setSelected(null)}} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2" aria-label={locale==="zh"?"选择出境通道":"Choose border corridor"}><option value="all">{locale==="zh"?"全部通道":"All corridors"}</option><option value="manzhouli">{locale==="zh"?"满洲里":"Manzhouli"}</option><option value="erenhot">{locale==="zh"?"二连浩特":"Erenhot"}</option><option value="west">{locale==="zh"?"阿拉山口 / 霍尔果斯":"Alashankou / Khorgos"}</option></select></label>
        <button type="button" onClick={()=>setAdvancedOpen(v=>!v)} aria-expanded={advancedOpen} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-slate-700">{locale==="zh"?"图层":"Layers"} {advancedOpen?"−":"+"}</button>
      </div>
      {search.trim()&&<div className="mt-2 flex flex-wrap gap-2">{matchingStations.length?matchingStations.map(h=><button key={h.id} type="button" onClick={()=>selectStation(h)} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-800">{stationName(h.id)}</button>):<span className="text-slate-500">{locale==="zh"?"没有匹配站点":"No matching stations"}</span>}</div>}
      {advancedOpen&&<div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">{Object.entries(ui.groups).map(([key,label])=><label key={key} className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1"><input type="checkbox" checked={show[key]} onChange={e=>setShow(v=>({...v,[key]:e.target.checked}))}/><span style={{color:colors[key]}}>●</span>{label}</label>)}</div>}
    </div>
    <div className="flex items-center justify-between gap-2 bg-white/90 px-3 py-2 text-xs"><span className="text-slate-600">{locale==="zh"?"点击地图站点，选择目的地询价":"Tap a station to select your quote destination"}</span><label className="flex shrink-0 items-center gap-1"><input type="checkbox" checked={showAllStations} onChange={e=>setShowAllStations(e.target.checked)}/>{ui.allStations}</label></div>
    <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white/90 px-3 py-2 text-xs md:hidden"><span className="shrink-0 text-slate-500">{ui.quick}</span>{ui.regions.map((label,i)=>[label,[18,49,70,108][i]]).map(([label,lon])=><button key={label} type="button" onClick={()=>jumpTo(lon)} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700">{label}</button>)}</div>
    <div ref={mapScrollRef} className="overflow-x-auto overscroll-x-contain touch-pan-x" aria-label={ui.hint}><svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-[1100px] max-w-none md:w-full" role="img" aria-label={ui.intro}>
      <rect width={W} height={H} fill="#c9eafb"/>
      {features.map((f,i)=><path key={i} d={featurePath(f)} fill="#fbfae9" stroke="#8c9ca2" strokeWidth=".65" fillRule="evenodd"/>)}
      {visibleRoutes.map(r=><g key={r.id} opacity={routeInCorridor(r)?1:0.09} onClick={()=>setSelected({type:"route",value:r})} role="button" tabIndex={0} aria-label={r.points.map(stationName).join(" to ")} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected({type:"route",value:r})}}} style={{cursor:"pointer"}}>
        <path d={routePath(r)} fill="none" stroke={colors[r.kind]} strokeWidth="2.8" opacity=".18"/>
        <path d={routePath(r)} fill="none" stroke={colors[r.kind]} strokeWidth="2" opacity=".9" className="eurasia-flow" strokeDasharray={r.mode==="multimodal"?"3 7":undefined}/>
        <path d={routePath(r)} fill="none" stroke="transparent" strokeWidth="13"/>
      </g>)}
      {hubs.map(h=>{const [x,y]=project([h.lon,h.lat]);const isAdditional = !["xian","zhengzhou","wuhan","yiwu","shenzhen","alashankou","khorgos","almaty","tashkent","aktau","baku","tehran","istanbul","moscow","mala","warsaw","hamburg","duisburg","paris","milan","budapest"].includes(h.id);const compact = ["hamburg","duisburg","warsaw","mala","budapest","milan","paris"].includes(h.id);const dx=compact?(h.id==="hamburg"||h.id==="warsaw"?-8:8):8;const dy=compact?(h.id==="duisburg"||h.id==="milan"?15:-9):-6;return <g key={h.id} transform={`translate(${x} ${y})`} onClick={()=>selectStation(h)} role="button" tabIndex={0} aria-label={stationName(h.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectStation(h)}}} style={{cursor:"pointer"}}>
        <circle r="12" fill={hubColors[h.type]} opacity=".12"/><circle r="4.8" fill={hubColors[h.type]} stroke="white" strokeWidth="2"/><circle r="17" fill="transparent" pointerEvents="all"/>
        <text className={`eurasia-map-label ${showAllStations||selected?.type==="hub"&&selected.value.id===h.id?"active":""}`} style={{display:!showAllStations&&isAdditional&&selected?.value?.id!==h.id?"none":undefined}} x={dx} y={dy} textAnchor={dx<0?"end":"start"} fontSize="10.5" fontWeight="600" fill="#0f172a" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{locale==="zh"?h.label:(stationNamesEn[h.id]||h.label)}</text>
      </g>})}
    </svg></div>
    <div className="bg-white/90 px-3 py-1 text-[11px] text-slate-600 md:hidden">{ui.hint}</div>
    {!features.length&&<div className="bg-white/90 px-3 py-1 text-xs text-slate-600">{mapError?<>{ui.error} <button type="button" className="ml-2 underline text-blue-700" onClick={()=>setMapRetry(v=>v+1)}>{locale==="zh"?"重试加载":"Retry"}</button></>:ui.loading}</div>}
    {selected&&<div className="border-t border-slate-200 bg-white/95 p-3 text-xs">
      <button className="float-right ml-2" onClick={()=>setSelected(null)} aria-label={ui.close}>×</button>
      {selected.type==="hub"?<div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="text-sm">{stationName(selected.value.id)}</strong><div className="mt-1 text-slate-500">{locale==="zh"?"目的站已选择":"Destination selected"}</div></div>{onQuote&&<button type="button" className="rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800" onClick={()=>onQuote({destination:selected.value.label})}>{locale==="zh"?"立即询价":"Get a quote"}</button>}</div>:<><strong>{selected.value.points.map(stationName).join(" → ")}</strong><div>{ui.route}</div></>}
    </div>}
  </div>;
}
