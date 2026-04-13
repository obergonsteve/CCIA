/**
 * LiveKit room / identity constraints (see LiveKit docs: room names and identities
 * are limited ASCII; Convex `_id` strings are usually fine but we normalize anyway).
 */
const MAX_ROOM_NAME_LEN = 64;
const MAX_IDENTITY_LEN = 128;

export function liveKitRoomNameForWorkshopSession(
  workshopSessionId: string,
): string {
  const id = String(workshopSessionId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const name = `workshop_${id}`.slice(0, MAX_ROOM_NAME_LEN);
  return name.length > 0 ? name : "workshop_room";
}

export function liveKitParticipantIdentityFromUserId(userId: string): string {
  const s = String(userId)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, MAX_IDENTITY_LEN);
  return s.length > 0 ? s : "learner";
}

/** Strip whitespace and optional matching outer quotes from env values. */
export function trimEnvValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  let t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t.length > 0 ? t : undefined;
}

/** Convex / dashboard values often use https; LiveKit WebSocket URL must be wss. */
export function normalizeLiveKitServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`;
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`;
  }
  return trimmed;
}
