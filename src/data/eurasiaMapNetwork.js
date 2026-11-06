// Editable preview network data. Coordinates are schematic on the current SVG, not GIS coordinates.
// Replace with verified geometry and CMS records before publishing operational claims.
export const hubs = [
  { id: "xian", x: 58, y: 30, type: "origin", country: "China" },
  { id: "zhengzhou", x: 63, y: 31, type: "origin", country: "China" },
  { id: "wuhan", x: 62, y: 34, type: "origin", country: "China" },
  { id: "shenzhen", x: 64, y: 37, type: "origin", country: "China" },
  { id: "yiwu", x: 67, y: 35, type: "origin", country: "China" },
  { id: "alashankou", x: 49, y: 25, type: "border", country: "China / Kazakhstan" },
  { id: "almaty", x: 46.5, y: 29, type: "hub", country: "Kazakhstan", label: "阿拉木图 / Almaty" },
  { id: "tashkent", x: 43.5, y: 32.8, type: "hub", country: "Uzbekistan", label: "塔什干 / Tashkent" },
  { id: "baku", x: 34.5, y: 32.8, type: "hub", country: "Azerbaijan", label: "巴库 / Baku" },
  { id: "tehran", x: 35.5, y: 38.5, type: "hub", country: "Iran", label: "德黑兰 / Tehran" },
  { id: "istanbul", x: 26, y: 31.5, type: "hub", country: "Türkiye", label: "伊斯坦布尔 / Istanbul" },
  { id: "moscow", x: 30, y: 18, type: "hub", country: "Russia" },
  { id: "mala", x: 23, y: 21, type: "hub", country: "Poland" },
  { id: "warsaw", x: 21, y: 22, type: "hub", country: "Poland" },
  { id: "hamburg", x: 16, y: 21, type: "hub", country: "Germany" },
  { id: "duisburg", x: 15, y: 22, type: "hub", country: "Germany" },
  { id: "paris", x: 13, y: 24, type: "hub", country: "France" },
  { id: "milan", x: 17, y: 26, type: "hub", country: "Italy" },
  { id: "budapest", x: 21, y: 24, type: "hub", country: "Hungary" },
];

export const routes = [
  // Domestic feeder lines converge toward the westbound gateway.
  { id: "feeder-zhengzhou", color: "#93c5fd", duration: "Indicative", service: "Domestic feeder", path: "M 63,31 Q 60,30 58,30 Q 53,27 49,25", points: ["zhengzhou","xian","alashankou"], label: "郑州—西向集结通道" },
  { id: "feeder-wuhan", color: "#93c5fd", duration: "Indicative", service: "Domestic feeder", path: "M 62,34 Q 60,32 58,30 Q 53,27 49,25", points: ["wuhan","xian","alashankou"], label: "武汉—西向集结通道" },
  { id: "feeder-yiwu", color: "#93c5fd", duration: "Indicative", service: "Domestic feeder", path: "M 67,35 Q 63,33 58,30 Q 53,27 49,25", points: ["yiwu","xian","alashankou"], label: "义乌—西向集结通道" },
  { id: "feeder-shenzhen", color: "#93c5fd", duration: "Indicative", service: "Domestic feeder", path: "M 64,37 Q 60,34 58,30 Q 53,27 49,25", points: ["shenzhen","xian","alashankou"], label: "深圳—西向集结通道" },
  {
    id: "route-1",
    color: "#151414",
    duration: "18–22 days",
    service: "Rail LCL",
    path: "M 58,30 Q 54,27 49,25 Q 40,21 30,18 Q 26,19 23,21 T 19,21.5 T 16,21",
    points: ["xian", "alashankou", "moscow", "mala", "warsaw", "hamburg"],
  },
  {
    id: "route-2",
    color: "#3b82f6",
    duration: "20–25 days",
    service: "Rail LCL",
    path: "M 49,25 Q 40,21 30,18 Q 26,19 23,21 T 16,22 T 13,24",
    points: ["wuhan", "alashankou", "moscow", "mala", "duisburg", "paris"],
  },
  {
    id: "route-3",
    color: "#10b981",
    duration: "22–26 days",
    service: "Rail LCL",
    path: "M 49,25 Q 40,21 30,18 Q 26,19 23,21 T 21,24 T 17,26",
    points: ["zhengzhou", "alashankou", "moscow", "mala", "budapest", "milan"],
  },
  { id: "central-asia-almaty", color: "#e8792e", duration: "Subject to confirmation", service: "Indicative corridor", path: "M 58,30 Q 53,27 49,25 Q 47,27 46.5,29", points: ["xian","alashankou","almaty"], label: "中国—阿拉木图（示意）" },
  { id: "central-asia-tashkent", color: "#d97706", duration: "Subject to confirmation", service: "Indicative corridor", path: "M 58,30 Q 53,27 49,25 Q 47,29 43.5,32.8", points: ["xian","alashankou","tashkent"], label: "中国—塔什干（示意）" },
  { id: "caspian-baku", color: "#8b5cf6", duration: "Subject to confirmation", service: "Indicative multimodal corridor", path: "M 49,25 Q 47,29 43.5,32.8 Q 39,34 34.5,32.8", points: ["alashankou","tashkent","baku"], label: "中亚—巴库（示意）" },
  { id: "iran-tehran", color: "#db2777", duration: "Subject to confirmation", service: "Indicative multimodal corridor", path: "M 43.5,32.8 Q 39,36 35.5,38.5", points: ["tashkent","tehran"], label: "中亚—德黑兰（示意）" },
  { id: "turkiye-istanbul", color: "#0891b2", duration: "Subject to confirmation", service: "Indicative multimodal corridor", path: "M 34.5,32.8 Q 30,32 26,31.5", points: ["baku","istanbul"], label: "巴库—伊斯坦布尔（示意）" }
];



