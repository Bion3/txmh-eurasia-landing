import React from 'react';

// 城市标记点组件
const CityMarker = ({ x, y, name }) => (
  <g transform={`translate(${x}, ${y})`}>
    <circle cx="0" cy="0" r="2.5" fill="#1d4ed8" />
    <text x="5" y="2" fontSize="0.55rem" fill="#1e3a8a" className="font-semibold">
      {name}
    </text>
  </g>
);

export default function EurasiaMap() {
  return (
    <div className="relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <style>
        {`
          .rail-line {
            stroke-dasharray: 1200;
            stroke-dashoffset: 1200;
            animation: draw-line 5s ease-in-out forwards;
          }

          @keyframes draw-line {
            to {
              stroke-dashoffset: 0;
            }
          }
        `}
      </style>
      <svg viewBox="150 100 700 400" className="w-full h-auto">
        {/* 欧亚大陆简化底图 */}
        <path
          d="M200 150 H 800 V 450 H 200 Z"
          fill="#f0f4f9"
          stroke="#dbeafe"
          strokeWidth="0.5"
        />

        {/* 高亮国家区域 */}
        <path d="M685,295 l5,10 l-5,5 l-10,-5 Z" fill="#bfdbfe" /> {/* 中国 */}
        <path d="M500,285 q20,-10 30,0 q10,10 -30,10 Z" fill="#e0e7ff" /> {/* 哈萨克斯坦 */}
        <path d="M335,255 l10,5 l5,-10 l-15,-5 Z" fill="#bfdbfe" /> {/* 欧洲 */}

        {/* 中欧班列主线路 */}
        {/* 西安 → 阿拉山口 → 莫斯科 → 华沙 → 汉堡 */}
        <path
          className="rail-line"
          d="M 680,300 Q 550,290 420,275 Q 380,270 340,260"
          stroke="#ef4444"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        {/* 武汉 → 乌鲁木齐 → 莫斯科 → 杜伊斯堡 */}
        <path
          className="rail-line" 
          style={{ animationDelay: '0.6s' }}
          d="M 670,320 Q 540,310 420,275 Q 380,280 350,280"
          stroke="#3b82f6"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />

        {/* 核心城市标记 */}
        <CityMarker x={680} y={300} name="Xi'an" />
        <CityMarker x={670} y={320} name="Wuhan" />
        <CityMarker x={500} y={285} name="Alashankou" />
        <CityMarker x={420} y={275} name="Moscow" />
        <CityMarker x={340} y={260} name="Hamburg" />
        <CityMarker x={350} y={280} name="Duisburg" />
        <CityMarker x={380} y={270} name="Warsaw" />
      </svg>

      {/* 图例 */}
      <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-slate-200 text-xs">
        <div className="flex items-center gap-2 font-medium text-slate-700">
          <span className="w-3 h-0.5 bg-red-500"/> China Railway Express 1
        </div>
        <div className="flex items-center gap-2 mt-1 font-medium text-slate-700">
          <span className="w-3 h-0.5 bg-blue-500"/> China Railway Express 2
        </div>
      </div>
    </div>
  );
}