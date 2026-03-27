import React, { useMemo, useState } from "react";
import mapSvg from "./Eurasia_location_map.svg";

// =========================
// 1) 可维护的数据（后续可从后台读取）
// =========================
const hubs = [
  { id: "xian", name: "Xi'an", x: 58, y: 30, type: "origin", country: "China" },
  { id: "zhengzhou", name: "Zhengzhou", x: 63, y: 31, type: "origin", country: "China" },
  { id: "wuhan", name: "Wuhan", x: 62, y: 34, type: "origin", country: "China" },
  { id: "alashankou", name: "Alashankou", x: 49, y: 25, type: "border", country: "China / Kazakhstan" },
  { id: "moscow", name: "Moscow", x: 30, y: 18, type: "hub", country: "Russia" },
  { id: "mala", name: "Mala", x: 23, y: 21, type: "hub", country: "Poland" },
  { id: "warsaw", name: "Warsaw", x: 21, y: 22, type: "hub", country: "Poland" },
  { id: "hamburg", name: "Hamburg", x: 16, y: 21, type: "hub", country: "Germany" },
  { id: "duisburg", name: "Duisburg", x: 15, y: 22, type: "hub", country: "Germany" },
  { id: "paris", name: "Paris", x: 13, y: 24, type: "hub", country: "France" },
  { id: "milan", name: "Milan", x: 17, y: 26, type: "hub", country: "Italy" },
  { id: "budapest", name: "Budapest", x: 21, y: 24, type: "hub", country: "Hungary" },
];

const routes = [
  {
    id: "route-1",
    name: "China-EU Route (Xian)",
    color: "#151414",
    duration: "18–22 days",
    service: "Rail LCL",
    path: "M 58,30 Q 54,27 49,25 Q 40,21 30,18 Q 26,19 23,21 T 19,21.5 T 16,21",
    points: ["xian", "alashankou", "moscow", "mala", "warsaw", "hamburg"],
  },
  {
    id: "route-2",
    name: "China-EU Route (Wuhan)",
    color: "#3b82f6",
    duration: "20–25 days",
    service: "Rail LCL",
    path: "M 62,34 Q 55,28 49,25 Q 40,21 30,18 Q 26,19 23,21 T 16,22 T 13,24",
    points: ["wuhan", "alashankou", "moscow", "mala", "duisburg", "paris"],
  },
  {
    id: "route-3",
    name: "China-EU Route (Zhengzhou)",
    color: "#10b981",
    duration: "22–26 days",
    service: "Rail LCL",
    path: "M 63,31 Q 56,29 49,25 Q 40,21 30,18 Q 26,19 23,21 T 21,24 T 17,26",
    points: ["zhengzhou", "alashankou", "moscow", "mala", "budapest", "milan"],
  },
];

// =========================
// 2) 工具函数：百分比坐标转真实像素
// 你的地图底图尺寸用 viewBox 100x60 统一处理
// =========================
const VIEW_W = 100;
const VIEW_H = 60;

function getTypeColor(type) {
  if (type === "origin") return "#dc2626";
  if (type === "border") return "#f59e0b";
  return "#2563eb";
}

// =========================
// 3) 城市点位组件
// =========================
function CityMarker({ hub, active, onEnter, onLeave }) {
  const color = getTypeColor(hub.type);

  return (
    <g
      transform={`translate(${hub.x}, ${hub.y})`}
      onMouseEnter={(e) => onEnter?.(e, hub)}
      onMouseLeave={onLeave}
      style={{ cursor: "pointer" }}
    >
      {/* 外圈脉冲 */}
      <circle
        cx="0"
        cy="0"
        r={active ? "1.8" : "1.3"}
        fill={color}
        opacity="0.15"
      />
      {/* 主点 */}
      <circle
        cx="0"
        cy="0"
        r={active ? "0.85" : "0.65"}
        fill={color}
        stroke="#ffffff"
        strokeWidth="0.25"
      />
      {/* 文字 */}
      <text
        x="1.2"
        y="0.5"
        fontSize="1.2"
        fill="#0f172a"
        className="font-semibold"
      >
        {hub.name}
      </text>
    </g>
  );
}

// =========================
// 4) 主组件
// =========================
export default function EurasiaMapSvg() {
  const [hoveredHub, setHoveredHub] = useState(null);
  const [hoveredRoute, setHoveredRoute] = useState(null);

  const hubMap = useMemo(() => {
    const map = {};
    hubs.forEach((h) => {
      map[h.id] = h;
    });
    return map;
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* 动画样式 */}
      <style>{`
        .txmh-route {
          stroke-dasharray: 2.8 1.8;
          animation: txmhDashMove 8s linear infinite;
          transition: opacity 0.25s ease, stroke-width 0.25s ease;
        }

        .txmh-route-glow {
          filter: drop-shadow(0 0 3px rgba(59,130,246,0.18));
        }

        @keyframes txmhDashMove {
          to {
            stroke-dashoffset: -18;
          }
        }
      `}</style>

      {/* 地图容器：底图 + 覆盖层 */}
      <div className="relative w-full">
        {/* 真实底图 */}
        <img
          src={mapSvg}
          alt="Eurasia logistics map"
          className="block w-full h-auto select-none"
          draggable="false"
        />

        {/* 覆盖层：必须 absolute */}
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* 路线层 */}
          {routes.map((route) => {
            const isActive = hoveredRoute?.id === route.id;

            return (
              <g key={route.id}>
                {/* 发光底层 */}
                <path
                  d={route.path}
                  fill="none"
                  stroke={route.color}
                  strokeWidth={isActive ? "1.15" : "0.85"}
                  opacity={isActive ? "0.2" : "0.08"}
                  className="txmh-route-glow"
                />

                {/* 主线路 */}
                <path
                  d={route.path}
                  fill="none"
                  stroke={route.color}
                  strokeWidth={isActive ? "0.62" : "0.48"}
                  strokeLinecap="round"
                  className="txmh-route"
                  opacity={hoveredRoute && !isActive ? 0.25 : 0.95}
                  onMouseEnter={() => setHoveredRoute(route)}
                  onMouseLeave={() => setHoveredRoute(null)}
                  style={{ cursor: "pointer" }}
                />
              </g>
            );
          })}

          {/* 城市点位层 */}
          {hubs.map((hub) => (
            <CityMarker
              key={hub.id}
              hub={hub}
              active={hoveredHub?.id === hub.id}
              onEnter={(e, item) => setHoveredHub(item)}
              onLeave={() => setHoveredHub(null)}
            />
          ))}
        </svg>
      </div>

  

      {/* 右下角图例 */}
      <div className="absolute bottom-3 right-3 bg-white/50 backdrop-blur-sm p-1 rounded-xl border border-slate-200 text-xs shadow-sm">
        {routes.map((route) => (
          <div key={route.id} className="flex items-center gap-1 font-medium text-slate-500 mb-1 last:mb-0">
            <span
              className="inline-block w-2 h-0.5 rounded-full"
              style={{ backgroundColor: route.color }}
            />
            {route.name}
          </div>
        ))}
      </div>

      {/* 城市 hover 信息卡 */}
      {hoveredHub && (
        <div className="absolute left-4 bottom-4 md:left-6 md:bottom-6 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 px-4 py-3 shadow-md min-w-[180px]">
          <div className="text-sm font-semibold text-slate-900">{hoveredHub.name}</div>
          <div className="mt-1 text-xs text-slate-600">Type: {hoveredHub.type}</div>
          <div className="text-xs text-slate-600">Country: {hoveredHub.country}</div>
        </div>
      )}

      {/* 路线 hover 信息卡 */}
      {hoveredRoute && (
        <div className="absolute right-4 top-20 md:right-6 md:top-24 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 px-4 py-3 shadow-md min-w-[220px]">
          <div className="text-sm font-semibold text-slate-900">{hoveredRoute.name}</div>
          <div className="mt-1 text-xs text-slate-600">Service: {hoveredRoute.service}</div>
          <div className="text-xs text-slate-600">Transit: {hoveredRoute.duration}</div>
          <div className="text-xs text-slate-600 mt-1">
            Stops: {hoveredRoute.points.map((id) => hubMap[id]?.name).join(" → ")}
          </div>
        </div>
      )}
    </div>
  );
}