import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import { estimatePublishedQuote, estimateDomesticRailLcl } from '../src/lib/publicQuotePricing.js';

const rows = [{id:'sale',status:'active',origin:'上海',destination:'汉堡',transport:'lcl',service_scope:'station',currency:'USD',unit_price_low:100,unit_price_high:120,minimum_charge:300,ratio:500,valid_until:'2026-11-30',public_note:'Indicative'}];
const result = estimatePublishedQuote({containerType:'LCL',pol:'Shanghai',pod:'Hamburg',volume:'5',weight:'1000'}, rows);
assert.equal(result.low, 500);
assert.equal(result.high, 600);
assert.equal(result.quantity, 5);
assert.equal(estimatePublishedQuote({containerType:'LCL',pol:'Ningbo',pod:'Hamburg',volume:'5',weight:'1000'}, rows), null);
const unitOnly = estimatePublishedQuote({containerType:'LCL',pol:'Shanghai',pod:'Hamburg',volume:'',weight:''}, rows);
assert.equal(unitOnly.low, 100);
assert.equal(unitOnly.rateOnly, true);
const volumeOnly = estimatePublishedQuote({containerType:'LCL',pol:'Shanghai',pod:'Hamburg',volume:'5',weight:''}, rows);
assert.equal(volumeOnly.low, 100);
assert.equal(volumeOnly.rateOnly,true);
const fclRows=[{id:'fcl',status:'active',origin:'宁波',destination:'汉堡',transport:'fcl',service_scope:'station',container:'40HQ',currency:'USD',unit_price_low:9000,unit_price_high:9600,minimum_charge:0}];
const fcl=estimatePublishedQuote({containerType:'FCL',pol:'Ningbo',pod:'Hamburg',containerSize:'',quantity:''},fclRows);
assert.equal(fcl.low,9000);
assert.equal(fcl.container,'40HQ');
assert.equal(estimatePublishedQuote({containerType:'FCL',pol:'Ningbo',pod:'Hamburg',quantity:1.5},fclRows),null);
for(const serviceScope of ['door_to_door','door_to_station','ddp','fba_delivery'])assert.equal(estimatePublishedQuote({containerType:'LCL',pol:'Shanghai',pod:'Hamburg',serviceScope,volume:8,weight:5000},rows),null);
assert.equal(estimatePublishedQuote({containerType:'LCL',pol:'Shanghai',pod:'Hamburg',volume:8,weight:5000},rows).quantity,10);
assert.equal(estimatePublishedQuote({containerType:'LCL',pol:'Shanghai',pod:'Hamburg',volume:8,weight:2500},rows).quantity,8);
console.log('Public quote pricing checks passed.');

const endpoint=readFileSync(new URL('../src/api/publicQuotes.js',import.meta.url),'utf8');
assert.match(endpoint,/\.rpc\('freight_website_sale_rates'\)/);
assert.match(endpoint,/\.rpc\('freight_website_indicative_rates'\)/);
assert.match(endpoint,/\.rpc\('freight_website_completed_lcl_rates'\)/);
assert.match(endpoint,/\.rpc\('freight_website_linehaul_estimates'/);
assert.match(endpoint,/\.rpc\('freight_website_pickup_tier_reference'/);
assert.doesNotMatch(endpoint,/\.from\('freight_public_quotes'\)/);
const hiddenRows=[{...fclRows[0],status:'inactive'}];
assert.equal(estimatePublishedQuote({containerType:'FCL',pol:'Ningbo',pod:'Hamburg'},hiddenRows),null);
assert.equal(estimatePublishedQuote({containerType:'LCL',pol:'Shanghai',pod:'Hamburg',serviceScope:'door_to_door',volume:5,weight:1500},rows),null);
console.log('Purchase-rate public RPC wiring and safe unavailability checks passed.');

const upcoming=[
 {id:'nov-coc',origin:'苏州',destination:'莫斯科',transport:'fcl',service_scope:'station',container:'40HQ',equipment:'COC',currency:'USD',unit_price_low:10340,unit_price_high:10340,minimum_charge:0,valid_from:'2026-11-01',valid_until:'2026-11-30',status:'indicative',rate_only:false},
 {id:'nov-soc',origin:'苏州',destination:'莫斯科',transport:'fcl',service_scope:'station',container:'40HQ',equipment:'SOC',currency:'USD',unit_price_low:8800,unit_price_high:8800,minimum_charge:0,valid_from:'2026-11-01',valid_until:'2026-11-30',status:'indicative',rate_only:false},
 {id:'nov-lcl',origin:'西安',destination:'汉堡（时刻表）',transport:'lcl',service_scope:'station',currency:'USD',unit_price_low:175,unit_price_high:175,minimum_charge:0,ratio:500,status:'indicative',rate_only:true,valid_from:'2026-11-01',valid_until:'2026-11-30'}
];
const novCoc=estimatePublishedQuote({containerType:'FCL',pol:'Suzhou',pod:'Moscow',containerSize:'40HQ',equipment:'COC',quantity:'2'},upcoming);
assert.equal(novCoc.low,20680);
assert.equal(novCoc.equipment,'COC');
assert.equal(novCoc.indicative,true);
assert.equal(novCoc.validFrom,'2026-11-01');
assert.equal(estimatePublishedQuote({containerType:'FCL',pol:'Suzhou',pod:'Moscow',equipment:'SOC',quantity:1},upcoming).low,8800);
const railOnly=estimatePublishedQuote({containerType:'LCL',pol:"Xi'an",pod:'Hamburg',volume:'8',weight:'5000'},upcoming);
assert.equal(railOnly.rateOnly,true);
assert.equal(railOnly.railQty,10);
assert.equal(railOnly.low,175); // Never show the incomplete per-ticket fee as an 1,750 USD all-in quote.
assert.equal(estimatePublishedQuote({containerType:'LCL',pol:"Xi'an",pod:'Hamburg',serviceScope:'door_to_door'},upcoming),null);
console.log('Upcoming FCL and rail-only LCL indicative checks passed.');

const confirmedLcl=[{
 id:'xian-hamburg-complete',origin:'西安',destination:'汉堡（时刻表）',
 transport:'lcl',service_scope:'station',currency:'USD',unit:'chargeable CBM',
 unit_price_low:175,unit_price_high:175,minimum_charge:150,ratio:500,shipment_fee:150,
 valid_from:'2026-11-01',valid_until:'2026-11-30',status:'indicative',rate_only:false
}];
const confirmedSubtotal=estimatePublishedQuote({containerType:'LCL',pol:"Xi'an",pod:'Hamburg',volume:'8',weight:'5000'},confirmedLcl);
assert.equal(confirmedSubtotal.quantity,10);
assert.equal(confirmedSubtotal.low,1900);
assert.equal(confirmedSubtotal.high,1900);
assert.equal(confirmedSubtotal.shipmentFee,150);
assert.equal(confirmedSubtotal.railSubtotal,true);
const confirmedWithoutWeight=estimatePublishedQuote({containerType:'LCL',pol:"Xi'an",pod:'Hamburg',volume:'8',weight:''},confirmedLcl);
assert.equal(confirmedWithoutWeight.rateOnly,true);
assert.equal(confirmedWithoutWeight.low,175);
assert.equal(confirmedWithoutWeight.hasConfirmedFees,true);
console.log('Verified LCL rail subtotal includes fixed per-shipment charges.');

const domestic=[{station:'西安',amount_usd:322.14,valid_until:'2026-11-30'},{station:'武汉',amount_usd:100,valid_until:'2026-11-30'}];
const door=estimateDomesticRailLcl({containerType:'LCL',serviceScope:'door_to_station',pol:'Shanghai',pod:'Hamburg',volume:'8',weight:'5000'},confirmedLcl,domestic);
assert.equal(door.low,2222.14);
assert.equal(door.domesticLinehaul,322.14);
assert.equal(door.railwaySubtotal,1900);
assert.equal(door.consolidationStation,'西安');
assert.equal(door.partial,true);
assert.equal(door.missingCosts.length,2);
assert.equal(estimateDomesticRailLcl({containerType:'LCL',serviceScope:'door_to_station',pol:'Shanghai',pod:'Hamburg',volume:'8',weight:'5000'},confirmedLcl,[{station:'武汉',amount_usd:99}]),null);
assert.equal(estimateDomesticRailLcl({containerType:'LCL',serviceScope:'door_to_station',pol:'Shanghai',pod:'Hamburg',volume:'8',weight:''},confirmedLcl,domestic),null);
console.log('Domestic linehaul joins to the same rail consolidation station and retains missing-cost warnings.');

// Generic pickup templates have no geofenced coverage: they must never change the computed subtotal.
const withPickup={...door,optionalPickup:{amount:88,tier:'≤10 CBM / ≤5000 kg',validUntil:'2026-11-30'}};
assert.equal(withPickup.low,2222.14);
assert.equal(withPickup.optionalPickup.amount,88);
assert.equal(withPickup.missingCosts.some(v=>v.includes('门点提货')),true);
console.log('Optional generic pickup reference does not become an all-in charge.');
