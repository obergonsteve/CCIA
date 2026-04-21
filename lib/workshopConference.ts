import type { Doc } from "@/convex/_generated/dataModel";

export function isMicrosoftTeamsSession(
  session:
    | Pick<Doc<"workshopSessions">, "conferenceProvider">
    | null
    | undefined,
): boolean {
  return session?.conferenceProvider === "microsoft_teams";
}

export function isEmbeddedLiveKitSession(
  session:
    | Pick<Doc<"workshopSessions">, "conferenceProvider">
    | null
    | undefined,
): boolean {
  return !isMicrosoftTeamsSession(session);
}

/**
 * True when this session should offer a Microsoft Teams (or Teams-sim) join URL,
 * even if `conferenceProvider` was not set to `microsoft_teams` (learners may still
 * see the embedded LiveKit shell on the unit page).
 */
type WorkshopSessionTeamsJoinFields = Pick<
  Doc<"workshopSessions">,
  | "conferenceProvider"
  | "externalJoinUrl"
  | "teamsGraphEventId"
  | "teamsOnlineMeetingId"
  | "teamsLastSyncAt"
>;

export function sessionSupportsOpenInTeamsMeeting(
  session: WorkshopSessionTeamsJoinFields | null | undefined,
): boolean {
  if (!session) {
    return false;
  }
  if (isMicrosoftTeamsSession(session)) {
    return true;
  }
  const u = session.externalJoinUrl?.trim();
  if (!u) {
    return false;
  }
  const graphId = session.teamsGraphEventId;
  if (
    graphId &&
    typeof graphId === "string" &&
    graphId.length > 0 &&
    !graphId.startsWith("sim:") &&
    /^https?:\/\//i.test(u)
  ) {
    // Graph-backed meeting: join URL may be aka.ms / redirect chains that do not
    // literally contain "teams.microsoft.com" until resolved.
    return true;
  }
  if (
    /teams\.(microsoft|live)\.com/i.test(u) ||
    /teams\.cloud\.microsoft/i.test(u) ||
    /microsoftteams\.com/i.test(u) ||
    /\/meetup-join\//i.test(u) ||
    /aka\.ms\//i.test(u)
  ) {
    return true;
  }
  if (u.includes("/workshop-sim/join/")) {
    return true;
  }
  if (graphId?.startsWith("sim:")) {
    return true;
  }
  // Graph sync has run for this row (Teams path) but join URL shape did not match
  // heuristics above — still offer Teams join on the unit page.
  if (session.teamsLastSyncAt != null && /^https?:\/\//i.test(u)) {
    return true;
  }
  if (session.teamsOnlineMeetingId?.trim() && /^https?:\/\//i.test(u)) {
    return true;
  }
  return false;
}

/**
 * Whether the unit page should render **Join in Teams** (purple strip): scheduled
 * session with a join URL that is not an obvious non-Teams provider.
 */
export function unitPageShouldRenderJoinInTeamsStrip(
  session: Doc<"workshopSessions">,
  now: number,
): boolean {
  const u = session.externalJoinUrl?.trim();
  if (!u || session.status !== "scheduled" || session.endsAt <= now) {
    return false;
  }
  if (/zoom\.us|meet\.google\.com|webex\.com|whereby\.com|jitsi\.org/i.test(u)) {
    return false;
  }
  if (sessionSupportsOpenInTeamsMeeting(session)) {
    return true;
  }
  // Teams-first webinars: show join for any remaining HTTPS / same-origin path
  // join link (Graph may return tenant-specific hosts not matched above).
  if (/^https?:\/\//i.test(u)) {
    return true;
  }
  return u.startsWith("/");
}
