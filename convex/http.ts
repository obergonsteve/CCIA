import { httpRouter } from "convex/server";

/**
 * §4 — Convex HTTP surface (extend with routes as needed).
 * Browser sessions use an HMAC cookie via Next.js; Convex `auth.config` has no JWT providers by default.
 */
const http = httpRouter();

export default http;

export { parseAuthCookieFromHeader } from "./lib/httpCookies";
