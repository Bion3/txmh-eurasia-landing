import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

const checks = [
  ["system readiness", ["run", "check:system-readiness"]],
  ["business flow", ["run", "check:business-flow"]],
  ["route acquisition", ["run", "check:routes"]],
  ["AI assistant", ["run", "check:ai-assistant"]],
  ["self-service order", ["run", "check:self-service-order"]],
  ["quote pricing", ["run", "check:quote-pricing"]],
  ["quote governance", ["run", "check:quote-governance"]],
  ["order lifecycle", ["run", "check:order-lifecycle"]],
  ["customer health", ["run", "check:customer-health"]],
  ["supplier health", ["run", "check:supplier-health"]],
  ["finance aging", ["run", "check:finance-aging"]],
  ["finance governance", ["run", "check:finance-governance"]],
  ["delivery gate", ["run", "check:delivery"]],
  ["production build", ["run", "build"]],
];

const results = [];
const startedAt = performance.now();

for (const [label, args] of checks) {
  const stepStartedAt = performance.now();
  console.log(`\n▶ ${label}`);
  const result = spawnSync("npm", args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
  const durationMs = Math.round(performance.now() - stepStartedAt);

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  results.push({
    label,
    status: result.status === 0 ? "PASS" : "FAIL",
    durationMs,
  });

  if (result.status !== 0) {
    break;
  }
}

const failed = results.filter((item) => item.status === "FAIL");
const totalDurationMs = Math.round(performance.now() - startedAt);
const maxLabelLength = Math.max(...results.map((item) => item.label.length));

console.log("\nCore verification summary:");
for (const result of results) {
  console.log(`${result.status.padEnd(4)}  ${result.label.padEnd(maxLabelLength)}  ${result.durationMs}ms`);
}
console.log(`\nCore verification: ${failed.length} failed, ${results.length}/${checks.length} completed, ${totalDurationMs}ms total.`);

if (failed.length > 0) {
  process.exit(1);
}
