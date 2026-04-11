/** Soft-delete flag: omitted or `undefined` means the row is live in UI. */
export function isLive<T extends { deletedAt?: number }>(
  doc: T | null | undefined,
): doc is T {
  return doc != null && doc.deletedAt == null;
}

export function nowDeletedAt(): number {
  return Date.now();
}
