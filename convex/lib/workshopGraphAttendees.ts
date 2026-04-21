/**
 * Graph event `attendees` payload shaping for PATCH (dedupe by email, strip noise).
 * Kept in lib/ so Vitest can cover it without loading Convex modules.
 */

type GraphAttendee = {
  emailAddress?: { address?: string; name?: string };
  type?: string;
};

export type GraphAttendeePatchRow = {
  emailAddress: { address: string; name?: string };
  type: "required";
};

export function normalizeAttendeesForPatch(raw: unknown): GraphAttendeePatchRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: GraphAttendeePatchRow[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const a = row as GraphAttendee;
    const addr = a.emailAddress?.address?.trim().toLowerCase();
    if (!addr || seen.has(addr)) {
      continue;
    }
    seen.add(addr);
    out.push({
      emailAddress: {
        address: a.emailAddress!.address!,
        ...(a.emailAddress?.name ? { name: a.emailAddress.name } : {}),
      },
      type: "required",
    });
  }
  return out;
}
