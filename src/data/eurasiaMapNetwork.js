// Geographic coordinates (longitude, latitude), WGS84. Schematic corridors, not verified rail track geometry.
export const hubs = [
  ["xian","西安",108.94,34.34,"origin"],["zhengzhou","郑州",113.63,34.75,"origin"],["wuhan","武汉",114.31,30.59,"origin"],
  ["yiwu","义乌",120.08,29.31,"origin"],["shenzhen","深圳",114.06,22.54,"origin"],
  ["alashankou","阿拉山口",82.56,45.17,"border"],["khorgos","霍尔果斯",80.42,44.21,"border"],
  ["almaty","阿拉木图",76.95,43.24,"hub"],["tashkent","塔什干",69.24,41.31,"hub"],
  ["aktau","阿克套",51.17,43.65,"hub"],["baku","巴库",49.87,40.41,"hub"],
  ["tehran","德黑兰",51.39,35.69,"hub"],["istanbul","伊斯坦布尔",28.98,41.01,"hub"],
  ["moscow","莫斯科",37.62,55.75,"hub"],["mala","马拉舍维奇",23.05,52.03,"hub"],
  ["warsaw","华沙",21.01,52.23,"hub"],["hamburg","汉堡",9.99,53.55,"hub"],
  ["duisburg","杜伊斯堡",6.76,51.43,"hub"],["paris","巴黎",2.35,48.86,"hub"],
  ["milan","米兰",9.19,45.46,"hub"],["budapest","布达佩斯",19.04,47.50,"hub"]
].map(([id,label,lon,lat,type])=>({id,label,lon,lat,type}));

// Route segments are shared, preventing overlapping animated lines on common trunks.
// Each segment can later be managed in CRM with status, geometry and publish flag.
export const routes = [
  {id:"f-zhengzhou",points:["zhengzhou","xian"],kind:"feeder"},
  {id:"f-wuhan",points:["wuhan","xian"],kind:"feeder"},
  {id:"f-yiwu",points:["yiwu","xian"],kind:"feeder"},
  {id:"f-shenzhen",points:["shenzhen","xian"],kind:"feeder"},
  {id:"trunk-west",points:["xian","alashankou"],via:[[103.83,36.06],[94.66,40.14],[87.62,43.82]],kind:"main"},
  {id:"trunk-khorgos",points:["xian","khorgos"],via:[[103.83,36.06],[94.66,40.14],[87.62,43.82]],kind:"main"},
  {id:"central-almaty",points:["khorgos","almaty"],kind:"central"},
  {id:"central-tashkent",points:["almaty","tashkent"],kind:"central"},
  {id:"europe-moscow",points:["alashankou","moscow"],via:[[80.5,50.4],[73.37,54.99],[60.6,56.84],[49.1,55.8]],kind:"europe"},
  {id:"europe-mala",points:["moscow","mala"],via:[[32.05,54.78],[27.56,53.90],[23.68,52.10]],kind:"europe"},
  {id:"europe-hamburg",points:["mala","hamburg"],kind:"europe"},
  {id:"europe-duisburg",points:["mala","duisburg"],kind:"europe"},
  {id:"europe-paris",points:["duisburg","paris"],kind:"europe"},
  {id:"europe-budapest",points:["mala","budapest"],kind:"europe"},
  {id:"europe-milan",points:["budapest","milan"],kind:"europe"},
  {id:"caspian-aktau",points:["tashkent","aktau"],via:[[64.42,39.77],[58.83,42.46]],kind:"westasia"},
  {id:"caspian-baku",points:["aktau","baku"],kind:"westasia",mode:"multimodal"},
  {id:"iran-tehran",points:["tashkent","tehran"],via:[[61.83,37.6],[58.8,36.3]],kind:"westasia"},
  {id:"turkiye-istanbul",points:["baku","istanbul"],via:[[44.8,41.7],[41.64,41.0],[35.33,40.7]],kind:"westasia"}
];
