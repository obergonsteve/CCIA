/**
 * Loads `.env.local` into the environment, then runs `npx convex …`.
 * Convex `run` has no `--env-file` flag; this keeps the CLI on the same
 * deployment as NEXT_PUBLIC_CONVEX_URL (via CONVEX_DEPLOYMENT in .env.local).
 */
const { readFileSync } = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  let raw;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    console.error(
      "No .env.local file. Copy .env.example to .env.local and fill it in.",
    );
    process.exit(1);
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const result = spawnSync("npx", ["convex", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status === null ? 1 : result.status);
