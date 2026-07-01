const scenarios = [
  ["China to Germany DDP", "ddp"],
  ["Amazon FBA warehouse delivery", "fba"],
  ["Can you do door to door pickup?", "door"],
  ["How much is rail freight?", "quote"],
  ["How many days does it take?", "transit"],
  ["What documents do you need?", "requirements"],
  ["Track order OD2026", "tracking"],
  ["中国到德国包税", "ddp"],
  ["亚马逊仓库派送", "fba"],
  ["门到门上门提货", "door"],
  ["报价需要什么资料", "requirements"],
  ["订单进度到哪了", "tracking"],
];

function detectIntent(message) {
  const text = String(message || "").toLowerCase();

  if (/(track|tracking|order|订单|进度|物流|到哪)/.test(text)) return "tracking";
  if (/(fba|amazon|亚马逊|仓库)/.test(text)) return "fba";
  if (/(ddp|tax|duty|customs|清关|关税|包税)/.test(text)) return "ddp";
  if (/(door|pickup|delivery|派送|上门|门到门|提货)/.test(text)) return "door";
  if (/(document|docs|资料|文件|需要什么)/.test(text)) return "requirements";
  if (/(cost|price|quote|rate|freight|费用|价格|报价|运费)/.test(text)) return "quote";
  if (/(time|days|transit|多久|时效|几天)/.test(text)) return "transit";
  return "general";
}

let failures = 0;

for (const [message, expected] of scenarios) {
  const actual = detectIntent(message);
  if (actual === expected) {
    console.log(`PASS  ${message} -> ${actual}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${message} -> ${actual}, expected ${expected}`);
  }
}

if (failures > 0) {
  console.error(`\nAI assistant check: ${failures} failed, ${scenarios.length} total.`);
  process.exit(1);
}

console.log(`\nAI assistant check: 0 failed, ${scenarios.length} total.`);
