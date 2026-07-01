import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const bundleFile = resolve(root, "supabase/deploy_bundle.sql");
const dryRun = process.argv.includes("--dry-run");
const buildOnly = process.argv.includes("--build-only");

const readEnv = (file) => {
  const path = resolve(root, file);
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return index === -1 ? [line, ""] : [line.slice(0, index), line.slice(index + 1)];
      })
  );
};

const env = {
  ...readEnv(".env"),
  ...process.env,
};

const buildResult = spawnSync("node", ["scripts/build-supabase-bundle.mjs"], {
  cwd: root,
  env,
  stdio: "inherit",
});

if ((buildResult.status ?? 1) !== 0) {
  process.exit(buildResult.status ?? 1);
}

if (buildOnly) {
  console.log("Bundle rebuilt successfully.");
  process.exit(0);
}

if (!existsSync(bundleFile)) {
  console.error("Missing supabase/deploy_bundle.sql after build step.");
  process.exit(1);
}

const args = [
  "db",
  "query",
  "--linked",
  "--file",
  bundleFile,
];

if (dryRun) {
  console.log("Dry run only. Command that would execute:");
  console.log("supabase " + args.join(" "));
  console.log("SUPABASE_DB_PASSWORD is set:", Boolean(env.SUPABASE_DB_PASSWORD));
  process.exit(0);
}

if (!env.SUPABASE_DB_PASSWORD) {
  console.error("Missing SUPABASE_DB_PASSWORD.");
  console.error("Set it temporarily, then rerun:");
  console.error("  SUPABASE_DB_PASSWORD='your_database_password' npm run deploy:supabase");
  process.exit(1);
}

const result = spawnSync("supabase", args, {
  cwd: root,
  env,
  stdio: "inherit",
});

if ((result.status ?? 1) === 0) {
  console.log("");
  console.log("Remote schema deploy completed.");
  console.log("Next recommended checks:");
  console.log("  npm run check:supabase:schema");
  console.log("  npm run check:supabase");
}

process.exit(result.status ?? 1);
