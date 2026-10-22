import assert from 'node:assert/strict';
import { estimatePublishedQuote } from '../src/lib/publicQuotePricing.js';

const rows = [{id:'sale',origin:'上海',destination:'汉堡',transport:'lcl',currency:'USD',unit_price_low:100,unit_price_high:120,minimum_charge:300,ratio:500,valid_until:'2026-11-30',public_note:'Indicative'}];
const result = estimatePublishedQuote({containerType:'LCL',pol:'Shanghai',pod:'Hamburg',volume:'5',weight:'1000'}, rows);
assert.equal(result.low, 500);
assert.equal(result.high, 600);
assert.equal(result.quantity, 5);
assert.equal(estimatePublishedQuote({containerType:'LCL',pol:'Ningbo',pod:'Hamburg',volume:'5',weight:'1000'}, rows), null);
const unitOnly = estimatePublishedQuote({containerType:'LCL',pol:'Shanghai',pod:'Hamburg',volume:'',weight:''}, rows);
assert.equal(unitOnly.low, 100);
assert.equal(unitOnly.rateOnly, true);
const volumeOnly = estimatePublishedQuote({containerType:'LCL',pol:'Shanghai',pod:'Hamburg',volume:'5',weight:''}, rows);
assert.equal(volumeOnly.low, 500);
const fclRows=[{id:'fcl',origin:'宁波',destination:'汉堡',transport:'fcl',container:'40HQ',currency:'USD',unit_price_low:9000,unit_price_high:9600,minimum_charge:0}];
const fcl=estimatePublishedQuote({containerType:'FCL',pol:'Ningbo',pod:'Hamburg',containerSize:'',quantity:''},fclRows);
assert.equal(fcl.low,9000);
assert.equal(fcl.container,'40HQ');
console.log('Public quote pricing checks passed.');
