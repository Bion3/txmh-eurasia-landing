import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const shouldWrite = process.argv.includes("--write");
const strictRemote = process.argv.includes("--strict-remote");
const stepTimeoutMs = 180000;

const checks = [
  ["local core readiness", ["run", "check:core"]],
  ["Supabase schema", ["run", "check:supabase:schema"]],
  ["Supabase public API", shouldWrite ? ["run", "check:supabase:write"] : ["run", "check:supabase"]],
];

const startedAt = performance.now();
const results = [];

for (const [label, args] of checks) {
  const stepStartedAt = performance.now();
  console.log(`\n▶ ${label}`);
  const result = spawnSync("npm", args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    timeout: stepTimeoutMs,
  });
  const durationMs = Math.round(performance.now() - stepStartedAt);

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(result.error.message || String(result.error));
  }

  const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}\n${result.error?.message || ""}`;
  const remoteUnavailable =
    label.startsWith("Supabase") &&
    /(fetch failed|ENOTFOUND|CERT_|certificate|Timeout|ETIMEDOUT|ECONNREFUSED|ECONNRESET|network)/i.test(combinedOutput);
  const remoteMigrationPending =
    label === "Supabase schema" &&
    /pending remote deploy/i.test(combinedOutput);
  const status = result.status === 0 && !result.error
    ? remoteMigrationPending && !strictRemote
      ? "WARN"
      : remoteMigrationPending && strictRemote
        ? "FAIL"
        : "PASS"
    : remoteUnavailable && !strictRemote
      ? "WARN"
      : "FAIL";

  results.push({
    label,
    status,
    durationMs,
  });

  if (status === "FAIL") break;
}

const failed = results.filter((item) => item.status === "FAIL");
const warned = results.filter((item) => item.status === "WARN");
const totalDurationMs = Math.round(performance.now() - startedAt);
const maxLabelLength = Math.max(...results.map((item) => item.label.length));

console.log("\nRelease verification summary:");
for (const result of results) {
  console.log(`${result.status.padEnd(4)}  ${result.label.padEnd(maxLabelLength)}  ${result.durationMs}ms`);
}
console.log(`\nRelease verification: ${failed.length} failed, ${warned.length} warning(s), ${results.length}/${checks.length} completed, ${totalDurationMs}ms total.`);

if (!shouldWrite) {
  console.log("Anonymous write smoke test skipped. Run `npm run check:release:write` when you intentionally want to create a cleanup-safe ANON-CHECK lead.");
}

if (warned.length > 0 && !strictRemote) {
  console.log("Remote Supabase checks had non-blocking warnings. Run `npm run check:release:strict` after deploying pending migrations to require remote success.");
}

if (failed.length > 0) {
  process.exit(1);
}
