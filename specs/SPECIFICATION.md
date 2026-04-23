
# CCIA Land Lease Division – Operator Training Portal  
**Initial PWA Build Specification for Cursor 3**

**Project Name:** `ccia-landlease-training-portal`

**Organisation:** Caravan & Camping Industry Association (CCIA) – Land Lease Division (Australia)  
**Purpose:** A secure, mobile-first Progressive Web App (PWA) for training operators and staff working in residential land lease communities across Australia.  
The portal supports structured certification pathways, unit-based training content, and assessments to ensure operators understand compliance, best practices, safety, and operational standards specific to the Australian land lease sector (governed by legislation such as the Residential (Land Lease) Communities Act).

**Key Users:**
- **Operators / Staff** – Complete training, view progress, pass assessments to earn certifications.
- **Content Creators / Admins** – Upload and manage training materials, units, assignments, and certifications.
- Users belong to **companies** (land lease community operators) that are granted access by CCIA.

**Core Features**
- JWT-based authentication (email/password)
- Company-based access control
- Certification levels → Units → Training content (videos, slideshows, PDFs, links) + Assignments/Tests
- Real-time progress tracking and test results stored in Convex
- Admin mode for content management
- Fully responsive, installable PWA optimised for tablets and phones used in the field

**Tech Stack (exact as of April 2026)**
- **Frontend:** Next.js 15+ (App Router, TypeScript, Tailwind CSS v4)
- **UI Library:** shadcn/ui + Lucide React icons
- **Backend & Database:** Convex (queries, mutations, actions, file storage)
- **Authentication:** Custom JWT with httpOnly cookies (no Clerk)
- **PWA:** Full manifest + service worker support
- **Deployment:**
  - Frontend → Vercel
  - Backend → Convex cloud (via official Vercel integration)

You already have Convex and Vercel accounts.

---

## 1. Project Setup Commands

Run these commands first:

```bash
# Create Next.js app
npx create-next-app@latest ccia-landlease-training-portal --typescript --tailwind --eslint --app --yes

cd ccia-landlease-training-portal

# Install Convex
npm install convex

# Additional dependencies
npm install jsonwebtoken bcryptjs cookie http-status-codes lucide-react date-fns

# shadcn/ui
npx shadcn@latest init -d
npx shadcn@latest add button card tabs accordion dialog form input label select textarea badge avatar progress toast sheet dropdown-menu table scroll-area separator

# Initialise Convex
npx convex init
```

After setup, proceed with the rest of this specification.

---

## 2. Environment & Deployment Setup

**Convex**
- Run `npx convex dev` to create your project and start the local backend.

**Vercel**
- Push the repository to GitHub.
- Import the project in Vercel.
- Install the official **Convex** integration from the Vercel Marketplace.
- Add these environment variables in both `.env.local` and Vercel:

```env
JWT_SECRET=your_very_strong_random_secret_key_min_32_characters
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=your_convex_deploy_key
```

Generate a strong `JWT_SECRET` using a secure method (e.g. `openssl rand -hex 32`).

---

## 3. Convex Database Schema

Replace `convex/schema.ts` with the following:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  companies: defineTable({
    name: v.string(),
    logoUrl: v.optional(v.string()),
    // CCIA member identifier or licence details if needed
  }).index("by_name", ["name"]),

  users: defineTable({
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),           // bcrypt hash
    companyId: v.id("companies"),
    role: v.union(
      v.literal("operator"),
      v.literal("supervisor"),
      v.literal("admin"),
      v.literal("content_creator")
    ),
    avatarUrl: v.optional(v.string()),
    lastLogin: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_company", ["companyId"]),

  certificationLevels: defineTable({
    name: v.string(),                   // e.g. "Level 1 - Foundations", "Compliance & Safety"
    description: v.string(),
    order: v.number(),
    // Can be global (CCIA standard) or company-specific
    companyId: v.optional(v.id("companies")),
  }).index("by_company", ["companyId"]),

  units: defineTable({
    levelId: v.id("certificationLevels"),
    title: v.string(),
    description: v.string(),
    order: v.number(),
  }),

  contentItems: defineTable({
    unitId: v.id("units"),
    type: v.union(
      v.literal("video"),
      v.literal("slideshow"),
      v.literal("link"),
      v.literal("pdf")
    ),
    title: v.string(),
    url: v.string(),                    // external or Convex storage URL
    storageId: v.optional(v.id("_storage")),
    duration: v.optional(v.number()),   // minutes for video
    order: v.number(),
  }),

  assignments: defineTable({
    unitId: v.id("units"),
    title: v.string(),
    description: v.string(),
    questions: v.array(v.object({
      id: v.string(),
      question: v.string(),
      type: v.union(v.literal("multiple_choice"), v.literal("text")),
      options: v.optional(v.array(v.string())),
      correctAnswer: v.optional(v.string()),
    })),
    passingScore: v.number(),           // e.g. 80
  }),

  userProgress: defineTable({
    userId: v.id("users"),
    unitId: v.id("units"),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    lastAccessed: v.number(),
  }).index("by_user_unit", ["userId", "unitId"]),

  testResults: defineTable({
    userId: v.id("users"),
    assignmentId: v.id("assignments"),
    score: v.number(),
    answers: v.array(v.any()),
    passed: v.boolean(),
    completedAt: v.number(),
  }).index("by_user_assignment", ["userId", "assignmentId"]),
});
```

Run `npx convex dev` after updating the schema.

---

## 4. JWT Authentication

Implement secure JWT auth with httpOnly cookies:

**Convex side (`convex/` folder):**
- `auth.ts` – mutations for register, login, logout, refresh
- `http.ts` – helpers to verify JWT from cookies
- Passwords must be hashed with `bcryptjs` inside Convex actions.

**Frontend:**
- `/login` page with email + password form
- Server-side or API route to set httpOnly `auth` cookie on successful login
- Next.js middleware to protect `/dashboard`, `/certifications`, `/units`, `/admin` routes
- Role-based checks (only `admin` and `content_creator` access `/admin`)

**Security:** Never store JWT in localStorage. Use httpOnly + Secure + SameSite=Strict cookies.

---

## 5. Application Pages & Features (MVP)

Use Next.js App Router with clean, professional UI tailored for Australian land lease operators.

**Public / Auth Pages**
- `/` – Landing page branded for **CCIA Land Lease Division** with login button
- `/login`
- `/register` (basic – full user management can be admin-only later)

**Operator Pages**
- `/dashboard` – Welcome, assigned certifications, overall progress summary, quick links
- `/certifications` – List of available certification levels (filtered by company or CCIA standards)
- `/certifications/[levelId]` – Units list with completion status and progress bars
- `/units/[unitId]` – Training interface with tabs:
  - **Content** – Play videos, view slideshows, open PDFs/links. Button to mark complete.
  - **Assessment** – Take assignment/test with multiple-choice or text questions. Auto-grading and immediate feedback.

**Admin / Content Creator Pages** (`/admin`)
- Dashboard for managing companies, users, certifications, units
- Create/edit certification levels and units (with drag-and-drop ordering)
- Upload content:
  - Videos and PDFs → Convex storage
  - External links and slideshow images
- Create/edit assignments with question builder
- Preview content before publishing

**Additional MVP Requirements**
- Realtime updates via Convex queries (progress appears instantly)
- Mobile-first responsive design (sidebar on desktop, bottom navigation on mobile)
- Beautiful cards, progress indicators, badges, and clean typography using shadcn/ui + Tailwind
- Dark/light mode support
- PWA features:
  - `app/manifest.json` with CCIA branding (name: "CCIA Land Lease Training", short_name, icons, theme_color)
  - Service worker for caching training assets where appropriate
  - Install prompt and offline-capable training viewer

**Content Types**
- Video (direct mp4 via Convex storage or embed)
- Slideshow (image sequence)
- PDF documents
- External supporting links (compliance documents, CCIA resources, legislation)

---

## 6. Recommended Folder Structure

```
app/
├── (auth)/
├── dashboard/
├── certifications/
├── units/
├── admin/
├── layout.tsx
├── globals.css
├── manifest.json          # PWA manifest
convex/
├── schema.ts
├── auth.ts
├── users.ts
├── certifications.ts
├── units.ts
├── content.ts
├── assignments.ts
├── progress.ts
├── http.ts
components/
├── ui/                    # shadcn
├── layout/                # sidebar, navbar
lib/
├── utils.ts
├── auth.ts
public/
├── icons/                 # PWA icons (192x192, 512x512 etc.)
```

---

## 7. Build Instructions for Cursor

Follow these steps precisely:

1. Execute all setup commands in Section 1.
2. Implement the exact Convex schema in Section 3 and run `npx convex dev`.
3. Build full JWT authentication (login/register with httpOnly cookies and middleware protection).
4. Create all pages and components as described in Section 5.
5. Implement training content viewer and auto-graded assessments with progress tracking.
6. Build the admin section with Convex storage file uploads and content management.
7. Add PWA manifest and basic service worker.
8. Ensure role-based access, responsive design, and realtime Convex queries throughout.
9. Polish the UI to feel professional, trustworthy, and suitable for industry training in Australia.
10. Test end-to-end flows: login → browse certifications → complete unit content → pass test → view updated progress → admin content creation.

**Branding Note:** Use professional blues/greens consistent with Australian industry associations. Include CCIA references where appropriate (e.g. footer: "CCIA Land Lease Division Training Portal").

This specification provides a complete, production-ready initial MVP. Once built and deployed, further phases can include certificate PDF generation, bulk user import, compliance reporting, and notifications.

Start building the full initial version now by strictly following this specification.
```

**How to use this file:**

1. Copy the entire content above.
2. In Cursor, create a new file called `CURSOR_BUILD_INSTRUCTIONS.md` (or `SPECIFICATION.md`).
3. Paste everything.
4. Prompt Cursor with:  
   **"Build the full initial version of the CCIA Land Lease Training Portal following the instructions in CURSOR_BUILD_INSTRUCTIONS.md"**

This version is fully customised for the **CCIA Land Lease Division** in Australia while keeping the JWT + Convex + Next.js + Tailwind + Vercel stack you requested. Let me know when the build is complete so we can refine or expand it!