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
const worldUrl="https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";
export default function EurasiaMapSvg({ mapText }) {
  const mapScrollRef=useRef(null);
  const [features,setFeatures]=useState([]);
  const [mapError,setMapError]=useState(false);
  const [selected,setSelected]=useState(null);
  const [show,setShow]=useState({feeder:true,main:true,europe:true,central:true,westasia:true});
  useEffect(()=>{
    let live=true;
    fetch(worldUrl).then(r=>{if(!r.ok)throw new Error("map fetch");return r.json()}).then(data=>{if(live)setFeatures(data.features||[])}).catch(()=>{if(live)setMapError(true)});
    return ()=>{live=false};
  },[]);
  const byId=useMemo(()=>Object.fromEntries(hubs.map(h=>[h.id,h])),[]);
  const visibleRoutes=routes.filter(r=>show[r.kind]);\n  const jumpTo=(lon)=>{const el=mapScrollRef.current;if(!el)return;const width=el.scrollWidth;const target=((lon-WEST)/(EAST-WEST))*width-el.clientWidth/2;el.scrollTo({left:Math.max(0,target),behavior:"smooth"});};
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
      @media(prefers-reduced-motion:reduce){.eurasia-flow{animation:none}}\n      @media(max-width:767px){.eurasia-map-label{display:none}.eurasia-map-label.active{display:block}}
    `}</style>
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white/95 px-2 py-2 text-[11px] md:gap-1.5 md:p-3 md:text-xs">
      {Object.entries({feeder:"国内集货",main:"西向干线",europe:"欧洲",central:"中亚",westasia:"西亚"}).map(([key,label])=><label key={key} className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1"><input type="checkbox" checked={show[key]} onChange={e=>setShow(v=>({...v,[key]:e.target.checked}))}/><span style={{color:colors[key]}}>●</span>{label}</label>)}
    </div>
    <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white/90 px-3 py-2 text-xs md:hidden"><span className="shrink-0 text-slate-500">快速定位</span>{[["欧洲",18],["西亚",49],["中亚",70],["中国",108]].map(([label,lon])=><button key={label} type="button" onClick={()=>jumpTo(lon)} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700">{label}</button>)}</div>\n    <div ref={mapScrollRef} className="overflow-x-auto overscroll-x-contain touch-pan-x" aria-label="地图可左右滑动查看"><svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-[1100px] max-w-none md:w-full" role="img" aria-label="欧亚铁路线路地理坐标示意地图">
      <rect width={W} height={H} fill="#c9eafb"/>
      {features.map((f,i)=><path key={i} d={featurePath(f)} fill="#fbfae9" stroke="#8c9ca2" strokeWidth=".65" fillRule="evenodd"/>)}
      {visibleRoutes.map(r=><g key={r.id} onMouseEnter={()=>setSelected({type:"route",value:r})} onClick={()=>setSelected({type:"route",value:r})} style={{cursor:"pointer"}}>
        <path d={routePath(r)} fill="none" stroke={colors[r.kind]} strokeWidth="2.8" opacity=".18"/>
        <path d={routePath(r)} fill="none" stroke={colors[r.kind]} strokeWidth="2" opacity=".9" className="eurasia-flow" strokeDasharray={r.mode==="multimodal"?"3 7":undefined}/>
        <path d={routePath(r)} fill="none" stroke="transparent" strokeWidth="13"/>
      </g>)}
      {hubs.map(h=>{const [x,y]=project([h.lon,h.lat]);const compact = ["hamburg","duisburg","warsaw","mala","budapest","milan","paris"].includes(h.id);const dx=compact?(h.id==="hamburg"||h.id==="warsaw"?-8:8):8;const dy=compact?(h.id==="duisburg"||h.id==="milan"?15:-9):-6;return <g key={h.id} transform={`translate(${x} ${y})`} onMouseEnter={()=>setSelected({type:"hub",value:h})} onClick={()=>setSelected({type:"hub",value:h})} style={{cursor:"pointer"}}>
        <circle r="8" fill={hubColors[h.type]} opacity=".15"/><circle r="4.4" fill={hubColors[h.type]} stroke="white" strokeWidth="2"/>
        <text className={`eurasia-map-label ${selected?.type==="hub"&&selected.value.id===h.id?"active":""}`} x={dx} y={dy} textAnchor={dx<0?"end":"start"} fontSize="10.5" fontWeight="600" fill="#0f172a" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{mapText?.hubs?.[h.id]||h.label}</text>
      </g>})}
    </svg></div>
    <div className="bg-white/90 px-3 py-1 text-[11px] text-slate-600 md:hidden">点击区域快速定位 · 左右滑动查看 · 点击圆点查看城市</div>\n    {!features.length&&<div className="bg-white/90 px-3 py-1 text-xs text-slate-600">{mapError?"地图底图加载失败，请刷新重试":"正在加载矢量地理底图…"}</div>}
    {selected&&<div className="border-t border-slate-200 bg-white/95 p-3 text-xs">
      <button className="float-right ml-2" onClick={()=>setSelected(null)} aria-label="关闭">×</button>
      {selected.type==="hub"?<><strong>{selected.value.label}</strong><div>经度 {selected.value.lon}° · 纬度 {selected.value.lat}°</div></>:<><strong>{selected.value.points.map(id=>byId[id]?.label||id).join(" → ")}</strong><div>示意通道 · 实际运输线路待核实</div></>}
    </div>}
  </div>;
}
