import { httpRouter } from "convex/server";

/**
 * §4 — Convex HTTP surface (extend with routes as needed).
 * JWT verification for browser sessions is enforced by Next.js proxy and Convex `auth.config`.
 * Use `parseAuthCookieFromHeader` from `./lib/httpCookies` if an HTTP action must read the `auth` cookie.
 */
const http = httpRouter();

export default http;

export { parseAuthCookieFromHeader } from "./lib/httpCookies";
