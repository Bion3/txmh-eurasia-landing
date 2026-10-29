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
