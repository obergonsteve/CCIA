const STORAGE_KEY = "ccia-notif-positions-v2";

export type NotifPositionMap = Record<string, { x: number; y: number }>;

export function notifStorageKey(userId: string) {
  return `${STORAGE_KEY}:${userId}`;
}

export function loadNotifPositions(userId: string): NotifPositionMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(notifStorageKey(userId));
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as NotifPositionMap;
  } catch {
    return {};
  }
}

export function saveNotifPositions(userId: string, map: NotifPositionMap) {
  try {
    localStorage.setItem(notifStorageKey(userId), JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

export function removeNotifPosition(userId: string, notifId: string) {
  const m = loadNotifPositions(userId);
  if (m[notifId] == null) {
    return;
  }
  const next = { ...m };
  delete next[notifId];
  saveNotifPositions(userId, next);
}

const NOTE_W = 256;
/** Tight to viewport so notes sit in the top-right corner. */
const EDGE = 6;

export function defaultNotifPosition(
  index: number,
  vw: number,
  vh: number,
): { x: number; y: number } {
  const x = Math.max(EDGE, vw - NOTE_W - EDGE - index * 8);
  const y = Math.max(
    EDGE,
    Math.min(EDGE + index * 12, vh - 100),
  );
  return { x, y };
}

export function clampNotifPosition(
  x: number,
  y: number,
  vw: number,
  vh: number,
  cardWidth: number,
  cardHeight: number,
) {
  return {
    x: Math.min(Math.max(EDGE, x), Math.max(EDGE, vw - cardWidth - EDGE)),
    y: Math.min(Math.max(EDGE, y), Math.max(EDGE, vh - cardHeight - EDGE)),
  };
}
