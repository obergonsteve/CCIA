# CCIA — Land lease training portal

CCIA Land Lease Division operator training (Next.js app).

## Run it on your machine

You need **two terminals**, both in this folder (`ccia-landlease` — same place as `package.json`).

**Terminal 1 — database / backend**

```bash
npm install
npm run convex:dev
```

Leave it running. Wait until you see **Convex functions ready**.

**Terminal 2 — website**

```bash
npm run dev
```

Open **http://localhost:3000**.

**First time only (sample users and companies):** stop nothing; in a **third** terminal run:

```bash
npm run seed:dev
```

**Login (after seed):** use the accounts created by the seed (see `convex/seed.ts` for emails,e.g. Steve’s address there).

**If the site shows Convex errors:** your `.env.local` must list the same Convex URL as the project you’re syncing. Copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` to the **dev** deployment shown in the [Convex dashboard](https://dashboard.convex.dev) for this project. Always use `npm run convex:dev` (not plain `npx convex dev`) so those values are picked up.

**If you run `vercel link`:** it can **overwrite `.env.local`** with only Vercel/Convex keys. **Put back** `NEXT_PUBLIC_CONVEX_URL`, `SESSION_COOKIE_SECRET`, etc. (see `.env.example`), then restart `npm run dev`.

---

## Deploying on Vercel

### If `ccia-landlease.vercel.app` shows plain “NOT_FOUND” (not your app’s HTML)

That response comes from **Vercel before Next.js runs**: there is **no successful Production deployment** for that project, or the project’s **Root Directory / Git repo** does not point at this Next app. Fix it in the dashboard (steps below); changing Convex or `.env.local` will **not** fix that URL.

### Root Directory (important)

What matters is **where the Git repository root is**, not the parent folder name on your machine.

In **this** codebase, `.git` sits next to `package.json` and `app/`. On the remote, the Next app **is** the repo root — there is **no** `ccia-landlease/` directory inside the clone. On Vercel, **leave Root Directory empty**.

If you set Root Directory to `ccia-landlease` here, Vercel looks for a folder that **does not exist** in the GitHub checkout → build/deploy is wrong → **`404 NOT_FOUND`** from Vercel (plain text, `x-vercel-error: NOT_FOUND`).

Only set Root Directory to a subpath (e.g. `ccia-landlease`, `apps/web`) when your Git repo is a **monorepo** and that folder really exists under the remote root.

Check locally: `git rev-parse --show-toplevel` — that must match how Vercel is configured.

### Checklist

1. Vercel → your project → **Settings** → **Build and Deployment**.
2. **Root Directory:** blank for this repo (unless you use a true monorepo remote).
3. Confirm latest **deployment build** succeeded (open **Build Logs** on a deployment).
4. Redeploy after changing Root Directory.

### Prove the live site is *this* repo

A Vercel **404** (`text/plain`, `x-vercel-error: NOT_FOUND`) means that **project** has **no** working production deployment — not a Next.js routing bug.

A **200** can still be wrong: check the HTML. This app’s home page should show **“CCIA Land Lease Division”** and lucide **Award** branding (see `app/page.tsx` on GitHub). If production shows something else, the Vercel project is **not** deploying **`obergonsteve/CCIA`** (wrong repo, fork, or Git disconnected).

Fix in the dashboard:

1. **Settings → Git** — connected repository must be **`obergonsteve/CCIA`**, branch **`main`** (or whatever you deploy).
2. **Deployments** — latest **Production** row must be **Ready** (open **Build Logs** if not).
3. Use **Visit** on **that** deployment; each project slug gets `https://<slug>.vercel.app` only for **that** project.

Local `.vercel/project.json` is **not** proof of what’s on Vercel’s servers — only the dashboard + a successful Production deploy are.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Convex Documentation](https://docs.convex.dev)
