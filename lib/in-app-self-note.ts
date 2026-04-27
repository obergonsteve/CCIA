/**
 * Personal “note to self” in-app post-its are tagged in Convex with a
 * {@link dedupeKey} prefix so the UI can show a hint without a stored `fromUserId`.
 * See `adminSendInAppNotification` `scope: "user"` with caller === target.
 */
export function isInAppPostItNoteToSelf(row: { dedupeKey: string }): boolean {
  return row.dedupeKey.startsWith("admin:self:");
}
