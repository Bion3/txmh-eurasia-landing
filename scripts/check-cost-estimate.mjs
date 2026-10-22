import assert from "node:assert/strict";
import { domesticCost, blankRate } from "../src/lib/procurement/domestic-model.js";
import { defaults } from "../src/lib/procurement/cost-model.js";
import { estimateLcl } from "../src/lib/procurement/cost-unified-model.js";

const pickupQuote = {
  ...blankRate(),
  kind: "pickup",
  status: "confirmed",
  currency: "USD",
  rule: "tier",
  tierMode: "ceil",
  ratio: 300,
  minimum: 0,
  deliveryIncluded: true,
  sharedPickup: true,
  templateName: "本地提货通用参考价",
  tiers: [
    { minVolume: 1, maxVolume: 5, minWeight: 0, maxWeight: 2500, amount: 80, unit: "fixed" },
    { minVolume: 4, maxVolume: 10, minWeight: 2500, maxWeight: 5000, amount: 80, unit: "fixed" },
    { minVolume: 10, maxVolume: 15, minWeight: 5000, maxWeight: 7500, amount: 150, unit: "fixed" },
  ],
};

assert.equal(domesticCost(pickupQuote, 10, 2000, 7).original, 80);
assert.equal(domesticCost(pickupQuote, 8, 2500, 7).original, 80);

const input = {
  transport: "lcl",
  scope: "door",
  origin: "上海",
  station: "西安",
  destination: "汉堡",
  date: "2026-10-22",
  pieces: 1,
  weight: 2000,
  volume: 10,
  fx: 7,
  eurFx: null,
  profitMode: "markup",
  profit: 0,
};
const data = {
  plans: [{ id: "plan", origin: "西安", destination: "汉堡", status: "confirmed", inputs: defaults() }],
  domestic: [
    { id: "pickup", kind: "pickup", origin: "通用本地提货", destination: "本地集货仓", status: "confirmed", quote: pickupQuote },
    { id: "line", kind: "linehaul", origin: "上海", destination: "西安", status: "confirmed", quote: { ...blankRate(), status: "confirmed", rule: "fixed", fixed: 300, minimum: 0, deliveryIncluded: true } },
  ],
};
const result = estimateLcl(input, data)[0];
assert.equal(result.inputs.pickupQuote.quoteId, "pickup");
assert(result.result.lines.some((line) => line.name === "国内提货" && line.value === 80));
assert(result.result.lines.some((line) => line.name === "国内干线"));

console.log("Cost estimate integration checks passed.");
