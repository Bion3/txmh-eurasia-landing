const aliases = new Map([
  ['shanghai', '上海'], ['ningbo', '宁波'], ['xian', '西安'], ["xi'an", '西安'],
  ['hamburg', '汉堡'], ['duisburg', '杜伊斯堡'], ['warsaw', '华沙'], ['moscow','莫斯科'],['suzhou','苏州'],['nanjing','南京'],['stpetersburg','圣彼得堡'],['minsk','明斯克'],
  ['chengdu', '成都'], ['chongqing', '重庆'], ['zhengzhou', '郑州'], ['wuhan', '武汉'], ['shenzhen', '深圳'], ['yiwu','义乌'], ['budapest','布达佩斯'], ['prague','布拉格'], ['milan','米兰'], ['paris','巴黎'],
]);

function normalizePlace(value) {
  const text = String(value || '').trim().toLowerCase().replace(/（[^）]*）|\([^)]*\)/g,'').replace(/市$/, '');
  return aliases.get(text) || text.replace(/[\s’']/g, '');
}

function placeMatches(quoted, requested) {
  const left = String(quoted || '').split(/[,，/]/).map(normalizePlace).filter(Boolean);
  const right = String(requested || '').split(/[,，/]/).map(normalizePlace).filter(Boolean);
  return left.some((item) => right.includes(item));
}

export function estimatePublishedQuote(form, rows) {
  if (!['FCL', 'LCL'].includes(form.containerType)) return null;
  const scope = value => ({station:'port_to_port',door:'door_to_station'}[value] || value);
  const requestedScope = scope(form.serviceScope || 'port_to_port');
  if (!['port_to_port','door_to_station'].includes(requestedScope)) return null;
  const shipmentType = ['FBA', 'DDP'].includes(form.containerType) ? 'LCL' : form.containerType;
  const transport = shipmentType === 'FCL' ? 'fcl' : 'lcl';
  const candidates = (rows || []).filter((row) =>
    row.transport === transport &&
    scope(row.service_scope) === requestedScope &&
    placeMatches(row.origin, form.pol) &&
    placeMatches(row.destination, form.pod) &&
    (transport !== 'fcl' || !form.containerSize || row.container === form.containerSize) &&
    (transport !== 'fcl' || !form.equipment || !row.equipment || row.equipment === form.equipment)
  );
  const today = new Date().toISOString().slice(0, 10);
  const quote = candidates.sort((a,b)=>{
    const aRank=a.status==='active'?0:1,bRank=b.status==='active'?0:1;
    return aRank-bRank||Number(a.unit_price_low)-Number(b.unit_price_low);
  }).find((row) => {
    const low = Number(row.unit_price_low), high = Number(row.unit_price_high);
    return ['active','indicative'].includes(row.status) &&
      (row.status==='indicative' || !row.valid_from || row.valid_from <= today) &&
      (!row.valid_until || row.valid_until >= today) &&
      Number.isFinite(low) && low > 0 && Number.isFinite(high) && high >= low &&
      Number.isFinite(Number(row.minimum_charge ?? 0)) && Number(row.minimum_charge ?? 0) >= 0 &&
      (transport !== 'lcl' || (Number.isFinite(Number(row.ratio)) && Number(row.ratio) > 0));
  });
  if (!quote) return null;
  if (transport === 'lcl') {
    const volume = Number(form.volume), weight = Number(form.weight), ratio = Number(quote.ratio);
    const quantity = Math.max(volume > 0 ? volume : 0, weight > 0 ? weight / ratio : 0);
    if ((form.volume !== '' && form.volume != null && (!Number.isFinite(volume) || volume <= 0)) ||
        (form.weight !== '' && form.weight != null && (!Number.isFinite(weight) || weight <= 0))) return null;
    if (quote.rate_only || !(Number.isFinite(volume) && volume > 0 && Number.isFinite(weight) && weight > 0)) return {
      quoteId: quote.id,
      currency: quote.currency,
      low: Number(quote.unit_price_low),
      high: Number(quote.unit_price_high),
      quantity: null,
      unit: 'chargeable CBM',
      rateOnly: true,
      indicative:quote.status==='indicative',
      validFrom:quote.valid_from,
      railQty:Number.isFinite(volume)&&volume>0&&Number.isFinite(weight)&&weight>0?quantity:null,
      shipmentFee:Number(quote.shipment_fee||0),
      hasConfirmedFees:quote.shipment_fee!==undefined&&quote.shipment_fee!==null,
      validUntil: quote.valid_until,
      note: quote.public_note,
    };
    const shipmentFee=Number(quote.shipment_fee||0);
    const hasConfirmedFees=quote.shipment_fee!==undefined&&quote.shipment_fee!==null;
    return {
      quoteId: quote.id,
      currency: quote.currency,
      low: Math.max(quantity * Number(quote.unit_price_low), Number(quote.minimum_charge || 0))+shipmentFee,
      high: Math.max(quantity * Number(quote.unit_price_high), Number(quote.minimum_charge || 0))+shipmentFee,
      quantity,
      shipmentFee,
      hasConfirmedFees,
      unitPrice:Number(quote.unit_price_low),
      railSubtotal:hasConfirmedFees,
      unit: 'chargeable CBM',
      rateOnly: false,
      indicative:quote.status==='indicative',
      validFrom:quote.valid_from,
      validUntil: quote.valid_until,
      note: quote.public_note,
    };
  }
  const quantity = Number(form.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  return {
    quoteId: quote.id,
    currency: quote.currency,
    low: Math.max(quantity * Number(quote.unit_price_low), Number(quote.minimum_charge || 0)),
    high: Math.max(quantity * Number(quote.unit_price_high), Number(quote.minimum_charge || 0)),
    quantity,
    unit: 'container',
    container: quote.container || null,
    equipment:quote.equipment||null,
    indicative:quote.status==='indicative',
    validFrom:quote.valid_from,
    rateOnly: false,
    validUntil: quote.valid_until,
    note: quote.public_note,
  };
}


export function estimateDomesticRailLcl(form, railRows, domesticRows) {
 if(form.containerType!=='LCL'||form.serviceScope!=='door_to_station')return null;
 const volume=Number(form.volume),weight=Number(form.weight);
 if(!Number.isFinite(volume)||volume<=0||!Number.isFinite(weight)||weight<=0)return null;
 const candidates=[];
 for(const domestic of domesticRows||[]){
  if(!domestic.station||!Number.isFinite(Number(domestic.amount_usd))||Number(domestic.amount_usd)<=0)continue;
  const rail=estimatePublishedQuote({...form,pol:domestic.station,serviceScope:'port_to_port'},railRows);
  if(!rail||rail.rateOnly||rail.railSubtotal!==true)continue;
  const domesticUsd=Number(domestic.amount_usd);
  const validUntil=[domestic.valid_until,rail.validUntil].filter(Boolean).sort()[0]||null;
  candidates.push({
   ...rail,low:Math.round((rail.low+domesticUsd)*100)/100,
   high:Math.round((rail.high+domesticUsd)*100)/100,
   partial:true,railSubtotal:false,
   domesticLinehaul:domesticUsd,
   railwaySubtotal:rail.low,
   consolidationStation:domestic.station,
   validUntil,
   missingCosts:['门点提货与仓库收货费用','境外清关、末端派送和不包含的附加费用'],
   note:'参考费用组合仅含已确认国内干线和铁路段；门点提货、目的地费用及特殊货物收费另询。国内干线按预设参考汇率1美元=7元人民币换算，非正式全程报价。'
  });
 }
 candidates.sort((a,b)=>a.low-b.low);
 return candidates[0]||null;
}

/** Approximate city-centre locations, WGS84; not receiving-warehouse coordinates. */
const domesticCityCentres={
 '上海':[31.2304,121.4737],'宁波':[29.8683,121.5440],'杭州':[30.2741,120.1551],
 '嘉兴':[30.7461,120.7555],'绍兴':[30.0303,120.5802],'舟山':[30.0160,122.1069],
 '湖州':[30.8925,120.0875],'金华':[29.0787,119.6474],'义乌':[29.3065,120.0751],
 '温州':[27.9938,120.6994],'台州':[28.6564,121.4208],
 '南京':[32.0603,118.7969],'苏州':[31.2989,120.5853],'无锡':[31.4912,120.3119],
 '常州':[31.8107,119.9741],'镇江':[32.1878,119.4250],'南通':[31.9802,120.8943],
 '扬州':[32.3932,119.4129],'泰州':[32.4555,119.9231],'盐城':[33.3474,120.1636],
 '徐州':[34.2044,117.2858],'淮安':[33.6104,119.0153],'连云港':[34.5967,119.2216],
 '合肥':[31.8206,117.2272],'芜湖':[31.3525,118.4331],'蚌埠':[32.9163,117.3893],
 '安庆':[30.5429,117.0635],'滁州':[32.3018,118.3162],
 '济南':[36.6512,117.1201],'青岛':[36.0671,120.3826],'烟台':[37.4638,121.4479],
 '临沂':[35.1047,118.3564],'潍坊':[36.7069,119.1618],
 '郑州':[34.7466,113.6254],'洛阳':[34.6197,112.4540],'开封':[34.7973,114.3076],
 '新乡':[35.3030,113.9268],'许昌':[34.0357,113.8526],
 '西安':[34.3416,108.9398],'咸阳':[34.3296,108.7089],'渭南':[34.4994,109.5098],
 '宝鸡':[34.3619,107.2374],
 '成都':[30.5728,104.0668],'德阳':[31.1270,104.3987],'眉山':[30.0755,103.8485],
 '重庆':[29.5630,106.5516],'武汉':[30.5928,114.3055],'鄂州':[30.3919,114.8948],
 '黄冈':[30.4535,114.8724],'孝感':[30.9248,113.9169],'襄阳':[32.0089,112.1224],
 '长沙':[28.2282,112.9388],'株洲':[27.8274,113.1339],'湘潭':[27.8297,112.9441],
 '南昌':[28.6829,115.8582],
 '广州':[23.1291,113.2644],'佛山':[23.0215,113.1214],'东莞':[23.0207,113.7518],
 '深圳':[22.5431,114.0579],'珠海':[22.2710,113.5767],'中山':[22.5176,113.3928],
 '惠州':[23.1115,114.4158],'肇庆':[23.0472,112.4651],'江门':[22.5787,113.0819],
 '汕头':[23.3541,116.6820],
 '北京':[39.9042,116.4074],'天津':[39.3434,117.3616],'石家庄':[38.0428,114.5149],
 '太原':[37.8706,112.5489],'沈阳':[41.8057,123.4315],'大连':[38.9140,121.6147],
 '长春':[43.8171,125.3235],'哈尔滨':[45.8038,126.5349],
 '昆明':[25.0389,102.7183],'南宁':[22.8170,108.3669],'贵阳':[26.6470,106.6302],
 '兰州':[36.0611,103.8343],'银川':[38.4872,106.2309],'乌鲁木齐':[43.8256,87.6168]
};
const transliterations={
 'guangzhou':'广州','foshan':'佛山','dongguan':'东莞','hangzhou':'杭州',
 'jiaxing':'嘉兴','wuxi':'无锡','changzhou':'常州','hefei':'合肥',
 'qingdao':'青岛','jinan':'济南','changsha':'长沙','nanchang':'南昌',
 'tianjin':'天津','beijing':'北京','shijiazhuang':'石家庄','xianyang':'咸阳',
 'yangzhou':'扬州','shaoxing':'绍兴','wenzhou':'温州','jinhua':'金华'
};
export function findDomesticCity(value){
 let v=String(value||'').trim().toLowerCase().replace(/（[^）]*）|\([^)]*\)/g,'').replace(/(省|自治区|特别行政区)$/,'').replace(/(市|区|县)$/,'');
 const aliased=aliases.get(v)||transliterations[v]||v;
 if(domesticCityCentres[aliased])return aliased;
 // Province/city and address strings: only parse unambiguous city names.
 const matches=Object.keys(domesticCityCentres).filter(n=>v.includes(n));
 if(matches.length===1)return matches[0];
 return null;
}
export function estimateCityCentrePickupDistance(origin,station){
 const from=findDomesticCity(origin),to=findDomesticCity(station);
 if(!from||!to)return {status:'unresolved',originCity:from,warehouseCity:to};
 const a=domesticCityCentres[from],b=domesticCityCentres[to];
 const rad=Math.PI/180,dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;
 const straightKm=2*6371*Math.asin(Math.min(1,Math.sqrt(h)));
 // Provisional proxy, NOT actual driving distance: assume 30% roadway detour.
 const estimatedRoadKm=Math.round(straightKm*1.3*10)/10;
 // A 20km buffer protects near-boundary estimates.
 return {status:estimatedRoadKm<=80?'likely_within':estimatedRoadKm>100?'outside':'review',
  originCity:from,warehouseCity:to,straightKm:Math.round(straightKm*10)/10,
  estimatedRoadKm,method:'city_centres_x_1_3',limitKm:100};
}
export function estimateLocalStationLcl(form,railRows){
 if(form.containerType!=='LCL'||form.serviceScope!=='door_to_station')return null;
 const from=findDomesticCity(form.pol);
 if(!from)return null;
 const rail=estimatePublishedQuote({...form,pol:from,serviceScope:'port_to_port'},railRows);
 if(!rail||rail.rateOnly||rail.railSubtotal!==true)return null;
 const distance=estimateCityCentrePickupDistance(from,from);
 return {...rail,partial:true,railSubtotal:false,domesticLinehaul:0,domesticLinehaulIncluded:false,
  railwaySubtotal:rail.low,consolidationStation:from,pickupDistance:distance,
  missingCosts:['门点提货和实际收货仓位置待确认','目的地服务和未包含的附加费用'],
  note:'按同城集货站的已确认铁路运费试算；同城城市中心距离并非实际仓库路程，门点提货须确认。'};
}
