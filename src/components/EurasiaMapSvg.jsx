import React, { useEffect, useMemo, useState } from "react";
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
  const [features,setFeatures]=useState([]);
  const [selected,setSelected]=useState(null);
  const [show,setShow]=useState({feeder:true,main:true,europe:true,central:true,westasia:true});
  useEffect(()=>{
    let live=true;
    fetch(worldUrl).then(r=>{if(!r.ok)throw new Error("map fetch");return r.json()}).then(data=>{if(live)setFeatures(data.features||[])}).catch(()=>{});
    return ()=>{live=false};
  },[]);
  const byId=useMemo(()=>Object.fromEntries(hubs.map(h=>[h.id,h])),[]);
  const visibleRoutes=routes.filter(r=>show[r.kind]);
  const routePath=(route)=>{
    const start=byId[route.points[0]],end=byId[route.points[route.points.length-1]];
    if(!start||!end)return "";
    return [[start.lon,start.lat],...(route.via||[]),[end.lon,end.lat]].map((point,i)=>{
      const [x,y]=project(point);return (i?"L":"M")+x.toFixed(2)+","+y.toFixed(2);
    }).join(" ");
  };
  return <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#c9eafb] shadow-sm">
    <style>{`
      .eurasia-flow{stroke-dasharray:8 12;animation:eurasiaFlow 7s linear infinite;stroke-linecap:round}
      @keyframes eurasiaFlow{to{stroke-dashoffset:-80}}
      @media(prefers-reduced-motion:reduce){.eurasia-flow{animation:none}}
    `}</style>
    <div className="absolute left-3 top-3 z-10 flex max-w-[90%] flex-wrap gap-1.5 rounded-xl bg-white/90 p-2 text-xs shadow-sm">
      {Object.entries({feeder:"国内集货",main:"西向干线",europe:"欧洲",central:"中亚",westasia:"西亚"}).map(([key,label])=><label key={key} className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1"><input type="checkbox" checked={show[key]} onChange={e=>setShow(v=>({...v,[key]:e.target.checked}))}/><span style={{color:colors[key]}}>●</span>{label}</label>)}
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="欧亚铁路线路地理坐标示意地图">
      <rect width={W} height={H} fill="#c9eafb"/>
      {features.map((f,i)=><path key={i} d={featurePath(f)} fill="#fbfae9" stroke="#8c9ca2" strokeWidth=".65" fillRule="evenodd"/>)}
      {visibleRoutes.map(r=><g key={r.id} onMouseEnter={()=>setSelected({type:"route",value:r})} onClick={()=>setSelected({type:"route",value:r})} style={{cursor:"pointer"}}>
        <path d={routePath(r)} fill="none" stroke={colors[r.kind]} strokeWidth="2.8" opacity=".18"/>
        <path d={routePath(r)} fill="none" stroke={colors[r.kind]} strokeWidth="2" opacity=".9" className="eurasia-flow"/>
        <path d={routePath(r)} fill="none" stroke="transparent" strokeWidth="13"/>
      </g>)}
      {hubs.map(h=>{const [x,y]=project([h.lon,h.lat]);return <g key={h.id} transform={`translate(${x} ${y})`} onMouseEnter={()=>setSelected({type:"hub",value:h})} onClick={()=>setSelected({type:"hub",value:h})} style={{cursor:"pointer"}}>
        <circle r="8" fill={hubColors[h.type]} opacity=".15"/><circle r="4.4" fill={hubColors[h.type]} stroke="white" strokeWidth="2"/>
        <text x="8" y="-6" fontSize="10.5" fontWeight="600" fill="#0f172a" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{mapText?.hubs?.[h.id]||h.label}</text>
      </g>})}
    </svg>
    {!features.length&&<div className="absolute bottom-3 left-3 rounded bg-white/90 px-3 py-1 text-xs text-slate-600">正在加载矢量地理底图…</div>}
    {selected&&<div className="absolute bottom-3 right-3 max-w-[60%] rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-md">
      <button className="float-right ml-2" onClick={()=>setSelected(null)} aria-label="关闭">×</button>
      {selected.type==="hub"?<><strong>{selected.value.label}</strong><div>经度 {selected.value.lon}° · 纬度 {selected.value.lat}°</div></>:<><strong>{selected.value.points.map(id=>byId[id]?.label||id).join(" → ")}</strong><div>示意通道 · 实际运输线路待核实</div></>}
    </div>}
  </div>;
}
