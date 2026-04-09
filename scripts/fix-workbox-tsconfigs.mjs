/**
 * Workbox packages ship tsconfig.json with "extends": "../../tsconfig", which
 * resolves to the *consumer's* project root under npm flat installs. That merges
 * Next's moduleResolution "bundler" with Workbox's "CommonJS" and floods the IDE
 * with spurious TS errors. Strip those extends lines after install.
 * Nested workbox-build under workbox-webpack-plugin references sibling packages
 * that are not present there when hoisted — remove project references there.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const extendsLine = /^\s*"extends": "\.\.\/\.\.\/tsconfig",\s*\r?\n/m;

function walk(dir, visitor) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".bin") continue;
      walk(p, visitor);
    } else if (entry.name === "tsconfig.json") visitor(p);
  }
}

const nodeModules = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules");

walk(nodeModules, (configPath) => {
  const normalized = configPath.replace(/\\/g, "/");
  if (!/\/workbox-[^/]*\//.test(normalized) && !normalized.includes("/workbox-webpack-plugin/")) {
    return;
  }

  let text = readFileSync(configPath, "utf8");
  const original = text;

  if (extendsLine.test(text)) {
    text = text.replace(extendsLine, "");
  }

  // Project references assume the Workbox monorepo; in npm installs they trip
  // composite / file-not-found checks in the IDE.
  if (
    normalized.endsWith("/workbox-build/tsconfig.json") ||
    normalized.endsWith("/workbox-webpack-plugin/tsconfig.json")
  ) {
    text = text.replace(/,\s*\r?\n\s*"references":\s*\[[\s\S]*?\]\s*/s, "");
  }

  if (text !== original) {
    writeFileSync(configPath, text);
    console.log("fix-workbox-tsconfigs:", configPath);
  }
});
