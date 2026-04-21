/**
 * One-shot check: Convex dev deployment GRAPH_* → AAD token → JWT app id vs GRAPH_CLIENT_ID.
 * Run from repo root: npm run verify:graph
 *
 * Optional: npm run verify:graph -- --probe
 *   Uses GRAPH_ORGANIZER_USER_ID from Convex: GET /users/{id}, POST minimal calendar event, DELETE if created.
 *   Use this when Convex logs "Graph POST event (calendar shell) 401".
 *
 * Does not print client secret or full access token.
 */
import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  let raw;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    console.error("Missing .env.local — copy .env.example and set CONVEX_DEPLOYMENT / NEXT_PUBLIC_CONVEX_URL.");
    process.exit(1);
  }
  const env = { ...process.env };
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
    if (env[key] === undefined) env[key] = val;
  }
  return env;
}

function convexEnvGet(env, name) {
  const r = spawnSync("npx", ["convex", "env", "get", name], {
    cwd: root,
    encoding: "utf8",
    env,
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || `convex env get ${name} failed`);
    process.exit(1);
  }
  return (r.stdout || "").trim();
}

function decodeJwtPayload(accessToken) {
  const parts = accessToken.split(".");
  if (parts.length < 2) {
    throw new Error("Token is not a JWT");
  }
  const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
}

const env = loadEnvLocal();
if (!env.CONVEX_DEPLOYMENT?.trim()) {
  console.error(".env.local must set CONVEX_DEPLOYMENT (e.g. dev:your-slug).");
  process.exit(1);
}

console.log("Using Convex deployment:", env.CONVEX_DEPLOYMENT.trim());
if (env.NEXT_PUBLIC_CONVEX_URL?.trim()) {
  console.log("NEXT_PUBLIC_CONVEX_URL host:", new URL(env.NEXT_PUBLIC_CONVEX_URL.trim()).host);
}

const tenantId = convexEnvGet(env, "GRAPH_TENANT_ID");
const clientId = convexEnvGet(env, "GRAPH_CLIENT_ID");
const clientSecret = convexEnvGet(env, "GRAPH_CLIENT_SECRET");

const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
const body = new URLSearchParams({
  client_id: clientId,
  client_secret: clientSecret,
  scope: "https://graph.microsoft.com/.default",
  grant_type: "client_credentials",
});

const res = await fetch(tokenUrl, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
});
const tokenJson = await res.json();
if (!res.ok || !tokenJson.access_token) {
  console.error("Token request failed:", tokenJson.error_description || tokenJson.error || res.status);
  process.exit(1);
}

let payload;
try {
  payload = decodeJwtPayload(tokenJson.access_token);
} catch (e) {
  console.error("Could not decode access_token:", e);
  process.exit(1);
}

const jwtAppId = payload.appid ?? payload.azp ?? "(missing in payload)";
const roles = Array.isArray(payload.roles) ? payload.roles : [];
const tid = payload.tid ?? "(missing)";

console.log("");
console.log("JWT tid (tenant):     ", tid);
console.log("JWT appid/azp:       ", jwtAppId);
console.log("Convex GRAPH_CLIENT_ID:", clientId);
console.log(
  jwtAppId === clientId
    ? "\n✓ MATCH — this Convex deployment uses the same app registration as the token."
    : "\n✗ MISMATCH — fix Convex env GRAPH_CLIENT_ID or use the app you tested in jwt.ms.",
);
console.log("");
console.log("JWT roles (app-only):", roles.length ? roles.join(", ") : "(none — calendar calls will fail)");
// Entra “Application permissions” UI lists **Calendars.ReadWrite** (“all mailboxes”). Some docs say
// Calendars.ReadWrite.All — either string can appear in JWT `roles` depending on tenant/API version.
const hasCalAll = roles.includes("Calendars.ReadWrite.All");
const hasCalRW = roles.includes("Calendars.ReadWrite");
if (hasCalAll || hasCalRW) {
  console.log(
    "✓ Application calendar write role present:",
    hasCalAll ? "Calendars.ReadWrite.All" : "Calendars.ReadWrite",
    "(Entra UI name is often Calendars.ReadWrite for app-only / all mailboxes.)",
  );
} else {
  console.log(
    "✗ No application calendar write role — in Entra add Microsoft Graph **Application** permission **Calendars.ReadWrite** (description: all mailboxes), then grant admin consent.",
  );
}

const accessToken = tokenJson.access_token;

if (process.argv.includes("--probe")) {
  const organizerId = convexEnvGet(env, "GRAPH_ORGANIZER_USER_ID");
  console.log("\n--- Mailbox probe (--probe) ---\n");
  console.log("GRAPH_ORGANIZER_USER_ID:", organizerId);

  const userUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(organizerId)}?$select=id,displayName,mail,userPrincipalName,userType`;
  const gu = await fetch(userUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const guText = await gu.text();
  console.log("GET /users/{id}:", gu.status, guText.slice(0, 800));
  try {
    const u = JSON.parse(guText);
    const upn = String(u.userPrincipalName ?? "");
    if (upn.includes("#EXT#") || (u.mail == null && upn)) {
      console.log(
        "\n⚠ Organizer looks like a **guest / B2B** user (`#EXT#` in UPN) or has **no mail**. Graph often **cannot** create calendar events for that identity with app-only access. Use **`GRAPH_ORGANIZER_USER_ID`** = Object ID of a **native member** mailbox in your tenant (e.g. `workshops@yourdomain.com` with Exchange + Teams).",
      );
    }
  } catch {
    /* ignore */
  }
  if (!gu.ok) {
    console.log(
      "\n→ Fix GRAPH_ORGANIZER_USER_ID (must be this tenant’s user **Object ID**). If 403, add **User.Read.All** (Application) + admin consent.",
    );
    process.exit(gu.status === 404 ? 2 : 1);
  }

  const start = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const wall = (d) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
  const postUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(organizerId)}/events`;
  const postBody = {
    subject: "[CCIA graph probe] safe to delete",
    start: { dateTime: wall(start), timeZone: "UTC" },
    end: { dateTime: wall(end), timeZone: "UTC" },
  };
  const pe = await fetch(postUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postBody),
  });
  const peText = await pe.text();
  console.log("POST /users/{id}/events (minimal):", pe.status, peText.slice(0, 800));

  if (pe.status === 201) {
    let id = "";
    try {
      id = JSON.parse(peText).id ?? "";
    } catch {
      /* ignore */
    }
    if (id) {
      const delUrl = `${postUrl}/${encodeURIComponent(id)}`;
      const del = await fetch(delUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log("DELETE probe event:", del.status, del.ok ? "ok" : (await del.text()).slice(0, 200));
    }
    console.log("\n✓ Calendar POST succeeded — Graph can write that mailbox; if the app still fails, compare organizer id and Convex env on the same deployment.");
    process.exit(0);
  }

  console.log(
    "\n→ GET user worked but POST calendar failed. If you saw the **guest / #EXT#** warning above, fix **`GRAPH_ORGANIZER_USER_ID`** first (native mailbox user). Otherwise typical cause: **Exchange Online application access policy** — allow this app’s **service principal** for that mailbox.",
  );
  console.log(
    "  Learn: https://learn.microsoft.com/en-us/graph/auth-limit-mailbox-access",
  );
  process.exit(1);
}
