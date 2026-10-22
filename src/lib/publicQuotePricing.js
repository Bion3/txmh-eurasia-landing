const aliases = new Map([
  ['shanghai', '上海'], ['ningbo', '宁波'], ['xian', '西安'], ["xi'an", '西安'],
  ['hamburg', '汉堡'], ['duisburg', '杜伊斯堡'], ['warsaw', '华沙'],
]);

function normalizePlace(value) {
  const text = String(value || '').trim().toLowerCase().replace(/市$/, '');
  return aliases.get(text) || text.replace(/[\s’']/g, '');
}

function placeMatches(quoted, requested) {
  const left = String(quoted || '').split(/[,，/]/).map(normalizePlace).filter(Boolean);
  const right = String(requested || '').split(/[,，/]/).map(normalizePlace).filter(Boolean);
  return left.some((item) => right.includes(item));
}

export function estimatePublishedQuote(form, rows) {
  const shipmentType = ['FBA', 'DDP'].includes(form.containerType) ? 'LCL' : form.containerType;
  const transport = shipmentType === 'FCL' ? 'fcl' : 'lcl';
  const candidates = (rows || []).filter((row) =>
    row.transport === transport &&
    placeMatches(row.origin, form.pol) &&
    placeMatches(row.destination, form.pod) &&
    (transport !== 'fcl' || !form.containerSize || row.container === form.containerSize)
  );
  const quote = candidates[0];
  if (!quote) return null;
  if (transport === 'lcl') {
    const volume = Number(form.volume), weight = Number(form.weight), ratio = Number(quote.ratio || 500);
    const quantity = Math.max(volume > 0 ? volume : 0, weight > 0 ? weight / ratio : 0);
    if (!(quantity > 0)) return {
      quoteId: quote.id,
      currency: quote.currency,
      low: Number(quote.unit_price_low),
      high: Number(quote.unit_price_high),
      quantity: null,
      unit: 'chargeable CBM',
      rateOnly: true,
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
      validUntil: quote.valid_until,
      note: quote.public_note,
    };
  }
  const quantity = Math.max(1, Number(form.quantity || 1));
  return {
    quoteId: quote.id,
    currency: quote.currency,
    low: Math.max(quantity * Number(quote.unit_price_low), Number(quote.minimum_charge || 0)),
    high: Math.max(quantity * Number(quote.unit_price_high), Number(quote.minimum_charge || 0)),
    quantity,
    unit: 'container',
    container: quote.container || null,
    rateOnly: false,
    validUntil: quote.valid_until,
    note: quote.public_note,
  };
}
