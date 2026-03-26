import React, { useMemo, useState } from "react";
import mapSvg from "./Eurasia_location_map.svg";

// =========================
// 1) 可维护的数据（后续可从后台读取）
// =========================
const hubs = [
  { id: "xian", name: "Xi'an", x: 73, y: 46, type: "origin", country: "China" },
  { id: "wuhan", name: "Wuhan", x: 71, y: 51, type: "origin", country: "China" },
  { id: "alashankou", name: "Alashankou", x: 54, y: 43, type: "border", country: "China / Kazakhstan" },
  { id: "moscow", name: "Moscow", x: 42, y: 40, type: "hub", country: "Russia" },
  { id: "warsaw", name: "Warsaw", x: 35, y: 39, type: "hub", country: "Poland" },
  { id: "hamburg", name: "Hamburg", x: 30, y: 37, type: "hub", country: "Germany" },
  { id: "duisburg", name: "Duisburg", x: 31, y: 41, type: "hub", country: "Germany" },
  { id: "paris", name: "Paris", x: 27, y: 43, type: "hub", country: "France" },
  { id: "milan", name: "Milan", x: 31, y: 47, type: "hub", country: "Italy" },
  { id: "budapest", name: "Budapest", x: 36, y: 43, type: "hub", country: "Hungary" },
];

const routes = [
  {
    id: "route-1",
    name: "China Railway Express 1",
    color: "#ef4444",
    duration: "18–22 days",
    service: "Rail LCL",
    path: "M 73,46 Q 62,44 54,43 Q 48,42 42,40 Q 38,39 35,39 Q 32,38 30,37",
    points: ["xian", "alashankou", "moscow", "warsaw", "hamburg"],
  },
  {
    id: "route-2",
    name: "China Railway Express 2",
    color: "#3b82f6",
    duration: "20–25 days",
    service: "Rail LCL",
    path: "M 71,51 Q 60,49 54,43 Q 47,42 42,40 Q 36,41 31,41",
    points: ["wuhan", "alashankou", "moscow", "duisburg"],
  },
  {
    id: "route-3",
    name: "Europe Distribution",
    color: "#10b981",
    duration: "2–6 days",
    service: "Last-Mile Delivery",
    path: "M 35,39 Q 33,40 31,41 Q 29,42 27,43 Q 29,45 31,47 Q 34,45 36,43",
    points: ["warsaw", "duisburg", "paris", "milan", "budapest"],
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

      {/* 左下角标题信息 */}
      <div className="absolute left-4 top-4 md:left-6 md:top-6 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 px-4 py-3 shadow-sm max-w-xs">
        <div className="text-sm font-semibold text-slate-900">
          Eurasia Rail LCL Coverage
        </div>
        <div className="mt-1 text-xs text-slate-600 leading-relaxed">
          China origins → border crossing → CIS transit → European hub distribution
        </div>
      </div>

      {/* 右下角图例 */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-slate-200 text-xs shadow-sm">
        {routes.map((route) => (
          <div key={route.id} className="flex items-center gap-2 font-medium text-slate-700 mb-1 last:mb-0">
            <span
              className="inline-block w-4 h-0.5 rounded-full"
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