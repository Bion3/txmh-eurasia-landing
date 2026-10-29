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
      validUntil: quote.valid_until,
      note: quote.public_note,
    };
    return {
      quoteId: quote.id,
      currency: quote.currency,
      low: Math.max(quantity * Number(quote.unit_price_low), Number(quote.minimum_charge || 0)),
      high: Math.max(quantity * Number(quote.unit_price_high), Number(quote.minimum_charge || 0)),
      quantity,
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
