import assert from 'node:assert/strict';
import {extractShipment} from '../src/lib/assistantShipment.js';
import {estimateDomesticRailLcl} from '../src/lib/publicQuotePricing.js';
import {quoteAnswer} from '../src/lib/businessAssistant.js';
// Published reference-rate snapshot from the diagnostic, with open fixture dates.
// Exercise extraction and pricing together: independent tests missed default FCL.
const rail=[{origin:'西安',destination:'汉堡（时刻表）',transport:'lcl',service_scope:'station',currency:'USD',unit_price_low:175,unit_price_high:175,minimum_charge:150,ratio:500,valid_from:'2026-11-01',valid_until:'2099-11-30',status:'indicative',rate_only:false,shipment_fee:150}];
const form=extractShipment('上海 汉堡3方6吨',{containerType:'FCL',serviceScope:'door_to_station'});
assert.equal(form.containerType,'LCL');
const result=estimateDomesticRailLcl(form,rail,[{station:'西安',amount_usd:386.57,valid_until:'2099-11-30'}]);
assert.equal(result.quantity,12);assert.equal(result.railwaySubtotal,2250);assert.equal(result.low,2636.57);assert.equal(result.partial,true);
const reply=quoteAnswer(result,form,'zh');
assert.match(reply,/拼箱/);assert.match(reply,/3 CBM \/ 6000 KG/);assert.match(reply,/2636.57/);assert.match(reply,/386.57/);assert.match(reply,/2250.00/);assert.match(reply,/非全程总价/);assert.match(reply,/铁路计费方：12/);
assert.equal(extractShipment('上海 汉堡3方6吨',extractShipment('整柜40HQ')).containerType,'FCL');
console.log('Screenshot cargo -> LCL -> domestic/rail subtotal -> transparent scope reply verified.');
