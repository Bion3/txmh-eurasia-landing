const baseOrder = {
  company: "",
  contactName: "",
  email: "",
  phone: "",
  pickupAddress: "",
  origin: "",
  destination: "",
  deliveryAddress: "",
  cargo: "",
  pieces: "",
  volume: "",
  weight: "",
  packageType: "cartons",
  transportMode: "rail",
  shipmentType: "LCL",
  incoterm: "EXW",
  serviceScope: "door_to_door",
  readyDate: "this_month",
  customsRequired: true,
  deliveryRequired: true,
  notes: "",
};

function scoreSelfServiceOrder(form) {
  let score = 35;
  if (form.company.trim()) score += 8;
  if (form.contactName.trim()) score += 6;
  if (form.email.trim()) score += 8;
  if (form.phone.trim()) score += 10;
  if (form.origin.trim() && form.destination.trim()) score += 14;
  if (form.pickupAddress.trim()) score += 8;
  if (form.deliveryAddress.trim()) score += 8;
  if (form.cargo.trim()) score += 8;
  if (form.volume || form.weight || form.pieces) score += 8;
  if (form.readyDate === "this_week") score += 8;
  if (form.serviceScope === "door_to_door") score += 5;
  if (form.incoterm === "DDP") score += 4;
  return Math.min(score, 99);
}

function missingRequired(form) {
  const missing = [];
  if (!form.contactName.trim() && !form.company.trim()) missing.push("company or contact");
  if (!form.email.trim() && !form.phone.trim()) missing.push("email or WhatsApp");
  if (!form.origin.trim()) missing.push("origin");
  if (!form.destination.trim()) missing.push("destination");
  if (!form.cargo.trim()) missing.push("cargo");
  return missing;
}

const scenarios = [
  {
    name: "empty draft is cold and missing required fields",
    form: baseOrder,
    assert: (score, missing) => score === 40 && missing.length === 5,
  },
  {
    name: "minimum required order becomes actionable",
    form: {
      ...baseOrder,
      contactName: "Benjamin",
      email: "benjamin@example.com",
      origin: "Xi'an",
      destination: "Duisburg",
      cargo: "FBA cartons",
    },
    assert: (score, missing) => score >= 75 && missing.length === 0,
  },
  {
    name: "door pickup and delivery increase readiness",
    form: {
      ...baseOrder,
      company: "Demo Trading",
      contactName: "Benjamin",
      email: "benjamin@example.com",
      phone: "+86 13800000000",
      origin: "Chengdu",
      destination: "Hamburg",
      pickupAddress: "Factory address",
      deliveryAddress: "Amazon warehouse",
      cargo: "General cargo",
      volume: "4.2",
      readyDate: "this_week",
      incoterm: "DDP",
    },
    assert: (score, missing) => score === 99 && missing.length === 0,
  },
];

let failures = 0;

for (const scenario of scenarios) {
  const score = scoreSelfServiceOrder(scenario.form);
  const missing = missingRequired(scenario.form);
  if (scenario.assert(score, missing)) {
    console.log(`PASS  ${scenario.name} -> score ${score}, missing ${missing.length}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${scenario.name} -> score ${score}, missing ${missing.join(", ") || "none"}`);
  }
}

if (failures > 0) {
  console.error(`\nSelf-service order check: ${failures} failed, ${scenarios.length} total.`);
  process.exit(1);
}

console.log(`\nSelf-service order check: 0 failed, ${scenarios.length} total.`);
