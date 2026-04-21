/**
 * Emergency off-switch for all Microsoft Graph workshop sync (meeting create,
 * PATCH, attendee sync). Set Convex env `WORKSHOP_GRAPH_DISABLED=1`.
 */
export function isWorkshopGraphSyncDisabled(): boolean {
  const raw = (process.env.WORKSHOP_GRAPH_DISABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
