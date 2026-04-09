# CCIA — Land lease training portal

CCIA Land Lease Division operator training (Next.js app).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure Convex and env per `.env.example` (copy to `.env.local`).

## Deploying on Vercel

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
