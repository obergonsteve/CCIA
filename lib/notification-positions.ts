const STORAGE_KEY = "ccia-notif-positions-v1";

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
const NOTE_MIN_TOP = 56;

export function defaultNotifPosition(
  index: number,
  vw: number,
  vh: number,
): { x: number; y: number } {
  const margin = 12;
  const x = Math.max(margin, vw - NOTE_W - margin - index * 16);
  const y = Math.max(
    NOTE_MIN_TOP,
    Math.min(vh * 0.12 + index * 18, vh - 120),
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
  const m = 4;
  return {
    x: Math.min(Math.max(m, x), Math.max(m, vw - cardWidth - m)),
    y: Math.min(Math.max(m, y), Math.max(m, vh - cardHeight - m)),
  };
}
