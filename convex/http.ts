import { httpRouter } from "convex/server";

/**
 * §4 — Convex HTTP surface (extend with routes as needed).
 * Browser sessions use a signed httpOnly cookie from Next.js (see `lib/password-session.ts`).
 */
const http = httpRouter();

export default http;

export { parseAuthCookieFromHeader } from "./lib/httpCookies";
