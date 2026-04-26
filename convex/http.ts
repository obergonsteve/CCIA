import { httpRouter } from "convex/server";
import { auth } from "./auth";

/**
 * Convex HTTP: JWT/OAuth routes for Convex Auth + existing cookie helpers.
 */
const http = httpRouter();

auth.addHttpRoutes(http);

export default http;

export { parseAuthCookieFromHeader } from "./lib/httpCookies";
