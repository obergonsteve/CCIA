CONVEX AUTH

**For a React/Next.js PWA stack**, Convex Auth works but requires careful setup due to its beta status and known Next.js integration friction (especially App Router + middleware). Many teams succeed with it for simpler apps, but race conditions, middleware/token issues, and PWA-specific gotchas are common.

### Key Setup Recommendations (Next.js App Router + Convex Auth)
1. **Core Integration**:
   - Use `convexAuthNextjsMiddleware` for route protection.
   - Wrap your app with `ConvexAuthNextjsProvider` (or similar) in `layout.tsx`.
   - Handle client-side auth with `useConvexAuth()` — always check `isLoading` to avoid races.

2. **Middleware for Protected Routes** (critical for PWA/SPA feel):
   ```ts
   // middleware.ts
   import { convexAuthNextjsMiddleware, isAuthenticatedNextjs } from "@convex-dev/auth/nextjs";
   import { createRouteMatcher } from "next-safe-action";

   const isPublic = createRouteMatcher(["/auth", "/public(.*)"]);

   export default convexAuthNextjsMiddleware((req) => {
     if (!isPublic(req) && !isAuthenticatedNextjs()) {
       return NextResponse.redirect(new URL("/auth", req.url));
     }
     // Add PWA allowances
   });

   export const config = {
     matcher: ["/((?!.*\\..*|_next|sw.js|manifest.json).*)", "/"], // Important for PWA
   };
   ```
   **PWA note**: Explicitly exclude service worker (`/sw.js`) and manifest files from middleware redirects, or they won't register properly.

3. **Server-Side Auth & Preloading** (for better SSR/hydration in PWA):
   - Use `convexAuthNextjsToken()` + `preloadQuery`/`fetchQuery` in server components.
   - This helps with initial load consistency.

4. **PWA-Specific Tips**:
   - Next.js PWA setup (via `next-pwa` or manual manifest/SW) + Convex works fine for offline/caching, but auth state must be handled gracefully on rehydration.
   - Test token persistence across app installs/updates.
   - Use short-lived JWTs + refresh logic carefully — background sync or periodic re-auth can help in PWA scenarios.

### Common Issues in Next.js + PWA Context
- **Middleware / `isAuthenticated()` always false** after OAuth (e.g., Google) — tokens not visible to proxy middleware. Ongoing issue.
- **Race conditions** with `useConvexAuth()` and queries on initial load/hydration.
- **Next.js 15+ header/async issues** in providers.
- **OAuth redirects & Safari** cookie problems on localhost.
- **404 on /api/auth** during setup.

Check the official GitHub issues for `get-convex/convex-auth` — many are Next.js-specific.

**Bottom line for your PWA**: Start with the official Convex + Next.js Auth guides + the labs.convex.dev examples. Test thoroughly on mobile (install as PWA) for auth persistence. Expect some debugging time due to beta. If you hit a specific error (e.g., middleware or OAuth), share it for targeted fixes!