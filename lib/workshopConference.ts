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
