### OBJECTIVE:
When a workshop is scheduled in the PWA, a Teams meeting is created and a link stored in the convex db. This link will be emailed to each user that subsequently registers to attend the workshop. At that time the meeting is also added to their calendar (outlook? how does teams work here?). When the workshop is started by the admin or joined by the attendees, a separate window will open for the Teams meeting. Joining/leaving a workshop will be recorded in the convex db. Outline the cleanest, simplest, most efficient approach for this.

In this scenario, the LiveKit approach would be disabled. All through Teams, which is what everyone is familiar with.

### IMPORTANT:
Keep this in mind at all times!
The LiveKit solution is to remain UNTOUCHED and FULLY FUNCTIONAL.  It will just be hidden for now.

### Convex environment variables (`ccia-landlease`)

Set these in the **Convex dashboard** → your deployment → **Settings → Environment Variables**. Graph and Resend calls run in **Convex** (internal actions), not only in Next.js.

**Required for Microsoft Graph (Teams / `microsoft_teams` workshop sessions)**

| Variable | Description |
|----------|-------------|
| `GRAPH_TENANT_ID` | Entra ID (Azure AD) tenant ID |
| `GRAPH_CLIENT_ID` | App registration (client) ID |
| `GRAPH_CLIENT_SECRET` | App client secret (client credentials) |
| `GRAPH_ORGANIZER_USER_ID` | **Object ID** of the user whose calendar hosts meetings — used as `/users/{id}/events` (not `/me/...` with app-only auth) |

If any of the required four are missing, meeting creation and attendee sync will fail at runtime.

**Optional (Graph)**

| Variable | Description |
|----------|-------------|
| `WORKSHOP_GRAPH_TIMEZONE` | Default IANA timezone when building Graph `start`/`end` if a session has no `timeZone` on the row. **Default in code:** `Australia/Sydney` |

**Demo / QA: fake Teams workflow (no Microsoft Graph)**

Use while Entra is broken or for client demos. Admin still picks **Microsoft Teams (Graph)** on sessions; the app fills a **simulated** join URL and `teamsGraphEventId` prefix `sim:…` so registration, **Join in Teams** (opens your PWA page), and **join/leave** timestamps still work.

| Variable | Description |
|----------|-------------|
| `WORKSHOP_TEAMS_SIMULATION` | Set to `1` (or `true`) to enable simulation. |
| `WORKSHOP_SIMULATION_PUBLIC_ORIGIN` | Your site root **as the learner’s browser would open it**, e.g. `http://localhost:3000` or `https://your-demo.vercel.app` — **no trailing slash**. Used to build `/workshop-sim/join/{sessionId}`. |

**Optional (turn off real Graph without simulation)**

| Variable | Description |
|----------|-------------|
| `WORKSHOP_GRAPH_DISABLED` | Set to `1` to skip all Graph jobs; you must set **external join URL** manually. Does not create a demo link by itself. |

**Optional (branded confirmation email via Resend)**

Both must be set or the app skips Resend entirely (Outlook may still send the official invite when Graph adds the attendee).

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_WORKSHOP_FROM` | Verified sender, e.g. `Workshops <onboarding@resend.dev>` or your domain |

**Resend test keys:** With a default/testing setup, Resend often returns **403** if `to` is **not** the same email as your Resend account (“you can only send testing emails to your own email address”). That is normal until you **verify a domain** at [resend.com/domains](https://resend.com/domains) and set `RESEND_WORKSHOP_FROM` to an address on that domain. Workshop registration and join links in the app still work; only the extra confirmation email is blocked.

**Embedded LiveKit only** (unchanged; not used for Teams-only sessions)

| Variable | Description |
|----------|-------------|
| `LIVEKIT_API_KEY` | LiveKit Cloud API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `LIVEKIT_URL` | WebSocket URL, e.g. `wss://….livekit.cloud` |

#### How to obtain these values

**Microsoft Graph / Entra ID (the four required `GRAPH_*` variables)**

1. **Tenant and app (client id + secret)**  
   - Sign in to **[Microsoft Azure portal](https://portal.azure.com)** (or **[Microsoft Entra admin center](https://entra.microsoft.com)**).  
   - Go to **Microsoft Entra ID** → **App registrations** → **New registration**.  
   - Name the app (e.g. `CCIA Workshop Graph`), choose **Accounts in this organizational directory only**, register.  
   - On the app’s **Overview** page:  
     - **Application (client) ID** → use as `GRAPH_CLIENT_ID`.  
     - **Directory (tenant) ID** → use as `GRAPH_TENANT_ID`.  
   - **Certificates & secrets** → **New client secret** → description, expiry → **Add** → copy the **Value** immediately (it is shown once) → `GRAPH_CLIENT_SECRET`.

2. **API permissions (so the app can create/update calendar events)**  
   - Same app → **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**.  
   - Add Microsoft Graph **Application** permission **`Calendars.ReadWrite`** (Entra description: *Read and write calendars in all mailboxes*). Older Microsoft docs sometimes call this **`Calendars.ReadWrite.All`**; use whatever name your portal shows under **Application permissions**. Grant **admin consent** for the tenant.  
   - Optionally add **`User.Read.All`** if you later resolve users by UPN in other flows; the current code uses the organizer object id you configure, not directory search.  
   - The backend creates a **plain calendar event first**, then **PATCH**es it to add **Teams** (`isOnlineMeeting` / `teamsForBusiness`). Some tenants still require extra permissions or Exchange policies; if PATCH fails after POST succeeds, ask your admin about **`OnlineMeetings.ReadWrite.All`** (Application) and **Exchange application access policies** for this app and the organizer mailbox.  
   - If logs show **`Graph POST event (calendar shell) 401`** while `npm run verify:graph` shows correct **JWT roles**, the usual cause is **Exchange** restricting which mailboxes this app may touch. From `ccia-landlease` run **`npm run verify:graph:probe`** (same Convex env as the app); it runs **GET /users/{organizer}** and a **minimal POST event**, then explains the result. Admin doc: [Limit Microsoft Graph access to Exchange mailboxes](https://learn.microsoft.com/en-us/graph/auth-limit-mailbox-access).

3. **Organizer user id (`GRAPH_ORGANIZER_USER_ID`)**  
   - The app uses **client credentials** (no signed-in user), so Graph calls use **`/users/{id}/events`**, not `/me/events`.  
   - **Microsoft Entra ID** → **Users** → open the **organizer** account (a real Microsoft 365 mailbox that is allowed to create Teams meetings — often a shared “workshops@…” mailbox or a dedicated user).  
   - Copy **Object ID** (not UPN, not client id) → `GRAPH_ORGANIZER_USER_ID`.  
   - That identity must be **licensed** for Teams/meeting creation in your tenant; meetings appear on **their** calendar.  
   - Do **not** use a **guest / B2B** user as organizer (Entra often shows `userPrincipalName` containing **`#EXT#@…`** and **`mail` may be null**). App-only calendar create for those accounts commonly fails with **401**. Use a **member** mailbox created in your tenant (e.g. a shared mailbox or `workshops@yourdomain.com` with Exchange Online).

**`WORKSHOP_GRAPH_TIMEZONE` (optional)**  
- Use an **IANA** timezone name, e.g. `Australia/Sydney`, `Pacific/Auckland`.  
- Same list as used by browsers/OS (e.g. [tz database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)).  
- Only used when a workshop session row has no `timeZone` set; per-session timezone in the admin UI overrides this for Graph date/time conversion.

**Resend (`RESEND_API_KEY`, `RESEND_WORKSHOP_FROM`)**  
- Sign up at **[resend.com](https://resend.com)** → **API Keys** → create a key → `RESEND_API_KEY`.  
- **`RESEND_WORKSHOP_FROM`**: must be a **verified** sender. For quick tests, Resend provides a sandbox domain (e.g. `onboarding@resend.dev` — check current Resend docs for the exact onboarding address). For production, add your domain under **Domains**, verify DNS, then use e.g. `Workshops <workshops@yourdomain.com>`.

**LiveKit (`LIVEKIT_*`)**  
- **[LiveKit Cloud](https://cloud.livekit.io)** (or your self-hosted equivalent) → select **project** → **Settings** (or project dashboard).  
- Copy **API key**, **API secret**, and **WebSocket URL** (`wss://…`) → `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`.

### Core Idea
- Workshops = standard **Teams meetings** (online meetings).
- Your **React + Convex PWA** acts purely as the **scheduling + registration + attendance tracking** layer.
- Everything else (video, audio, screen sharing, chat, recording, breakout rooms, etc.) happens natively in Teams — zero extra complexity.

### Step-by-Step Flow

1. **Admin schedules a workshop in the PWA**
   - React form collects: title, date/time, duration, description, optional attendees list.
   - On submit → Convex **mutation**:
     - Creates a workshop record in Convex DB (with status: "scheduled").
     - Calls a **Convex action** that uses **Microsoft Graph API** to create a Teams meeting.
   - Best & simplest Graph call:  
     `POST /me/events` (or `/users/{organizerId}/events`) with:
     ```json
     {
       "subject": "Workshop: Advanced React Patterns",
       "start": { "dateTime": "2026-05-15T10:00:00", "timeZone": "Australia/Sydney" },
       "end": { "dateTime": "2026-05-15T11:30:00", "timeZone": "Australia/Sydney" },
       "isOnlineMeeting": true,
       "onlineMeetingProvider": "teamsForBusiness",
       "attendees": [ /* optional initial list */ ],
       "body": { "contentType": "html", "content": "..." }
     }
     ```
     - The response immediately returns the **joinWebUrl** (the Teams meeting link) and the full event details.
   - Store in Convex DB: `workshop.teamsMeetingLink`, `workshop.teamsEventId`, `workshop.organizerId`, etc.

2. **User registers for the workshop**
   - User clicks "Register" in your PWA.
   - Convex mutation:
     - Adds the user to the workshop's attendee list in Convex DB (for your tracking).
     - Calls Graph to **add the user as an attendee** to the existing calendar event (PATCH /me/events/{eventId} or use the attendees collection). This adds the meeting to their Outlook/Teams calendar automatically.
     - Triggers your email service (e.g., **Resend** via Convex component) with a clean confirmation email containing:
       - Workshop details
       - Direct **Teams join link** (`joinWebUrl`)
       - "Add to calendar" ics link (optional, Graph can generate it)
   - Graph automatically sends the official meeting invitation email from the organizer's account (with calendar invite). Your custom email is just a friendly confirmation from your app.

3. **How calendar addition works (Outlook/Teams)**
   - When you add someone as an **attendee** to the event via Graph, Microsoft automatically:
     - Adds the meeting to their Outlook calendar.
     - Sends them the official Teams meeting invite email.
     - Makes the meeting appear in their Teams **Calendar** tab.
   - Users get reminders, can accept/decline/tentative, and see it everywhere they use Outlook or Teams.
   - No extra work needed on your side — this is native Microsoft behavior.

4. **When the workshop starts**
   - Admin (or any registered user) clicks **"Start Workshop"** or **"Join Workshop"** in your PWA.
   - Your React app simply does: `window.open(teamsMeetingLink, '_blank')` — this opens the meeting directly in the Teams desktop app (preferred) or Teams for web.
   - Users can also just click the link from their email or open it from their Outlook/Teams calendar — no need to go through your PWA if they don't want to.

5. **Attendance tracking (Join / Leave)**
   - Store join/leave timestamps in Convex DB for your records (e.g., "attended", "late", "left early").
   - **Simplest reliable method (2026)**:
     - On "Join" button click in your PWA → record "joined" timestamp + open the Teams link.
     - Periodically (or on a "Mark as Attended" button after the session) let the admin or users self-report attendance.
     - For automatic tracking: Use Graph API to query meeting attendance reports after the meeting ends (`GET /me/onlineMeetings/{meetingId}/attendanceReports` or the event's attendance data). This requires the right permissions and works best for organizers.
   - Keep it lightweight: Most teams just use the "Join" button in the PWA as the signal + manual admin confirmation.

### Cleanest Tech Implementation (Your Stack)

**Permissions (Entra ID app registration)** — Use **application permissions** for backend automation:
- `Calendars.ReadWrite` (Application — “all mailboxes”; some docs: `Calendars.ReadWrite.All`)
- `OnlineMeetings.ReadWrite.All`
- `User.Read.All` (to resolve users)
- `Mail.Send` (if you want extra control)

**Convex side** (recommended structure):
- One mutation for scheduling (creates DB record + calls action for Graph).
- One mutation for registering (adds attendee in DB + updates Graph event + sends friendly email).
- Store the `joinWebUrl` once and reuse it.

**React side**:
- Very thin: forms, buttons that call Convex mutations/queries.
- On join: simple `window.open(link)` or a nice modal with "Opening Teams...".

**Email**:
- Rely on Graph's automatic invite for the official calendar entry.
- Send one clean branded email via **Resend** (with React Email template) that says "Your workshop is confirmed — click here to join in Teams" + the direct link.

### Why This Is the Cleanest & Most Efficient
- **Zero latency problems** — Everyone uses native Teams (sub-second real-time, screen sharing, recordings, live captions, etc.).
- **Users are already familiar** — No new UI to learn.
- **Minimal code** — You only handle scheduling + registration + tracking. Microsoft handles the hard parts.
- **Reliable & scalable** — Graph + Outlook/Teams calendar is battle-tested.
- **No bridging/maintenance** — No LiveKit, no RTMP, no custom agents.

**Potential small gotchas**:
- The meeting organizer should be a real Microsoft 365 user (or a service account with proper licensing).
- For external users (non-org), they can still join via the link (guest access works fine).
- Test with both work/school and personal Microsoft accounts if needed.

This approach is straightforward, low-risk, and leverages what Microsoft already does extremely well.
