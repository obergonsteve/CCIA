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
/** Matches `notification-stack` / `clampNotifPosition` card height. */
const NOTE_H = 100;
/** Tight to viewport; horizontal padding from right edge. */
const EDGE = 6;
/**
 * Assumed main header height when the DOM id isn’t available (SSR / first paint).
 * Used only for vertical centering in the default fallback.
 */
const ASSUMED_HEADER_H = 72;

/**
 * Nudge the default post-it a few px **down** from strict header center so it
 * doesn’t read as high/cut at the top edge of the “slot.”
 */
const DEFAULT_NOTIF_Y_NUDGE_PX = 24;

/** Same id as `app-shell` `<header id="…">` — post-its default centered on this bar. */
export const CCIA_APP_HEADER_ID = "ccia-app-header" as const;

/**
 * `fixed` post-it positions must stay **fully in the viewport**. Never allow a
 * negative `translateY` — a previous `minY` of `-50` put almost the whole card above
 * the fold, which is what looked “off the screen.”
 */
function clampYToViewport(
  y: number,
  vh: number,
  cardHeight: number,
): number {
  const yMax = Math.max(EDGE, vh - cardHeight - EDGE);
  return Math.min(Math.max(EDGE, y), yMax);
}

/**
 * Default: **one shared spot** — horiz + vert **centre of** `#ccia-app-header` for the
 * 256×100 notional card. Every note uses the same `(x,y)`; which card shows on top is
 * **z-index**, not position. (Second `index` arg kept for callers, ignored.)
 */
export function defaultNotifPosition(
  _index: number,
  vw: number,
  vh: number,
): { x: number; y: number } {
  if (typeof document !== "undefined") {
    const header = document.getElementById(CCIA_APP_HEADER_ID);
    if (header != null) {
      const r = header.getBoundingClientRect();
      const centerX = r.left + r.width / 2;
      const centerY = r.top + r.height / 2;
      const idealX = centerX - NOTE_W / 2;
      const x = Math.min(
        Math.max(EDGE, idealX),
        Math.max(EDGE, vw - NOTE_W - EDGE),
      );
      const idealY = centerY - NOTE_H / 2 + DEFAULT_NOTIF_Y_NUDGE_PX;
      const y = clampYToViewport(idealY, vh, NOTE_H);
      return { x, y };
    }
  }
  const topEdge = 0;
  const headerCenterY = topEdge + ASSUMED_HEADER_H / 2;
  return {
    x: Math.min(
      Math.max(EDGE, (vw - NOTE_W) / 2),
      Math.max(EDGE, vw - NOTE_W - EDGE),
    ),
    y: clampYToViewport(
      headerCenterY - NOTE_H / 2 + DEFAULT_NOTIF_Y_NUDGE_PX,
      vh,
      NOTE_H,
    ),
  };
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
    y: clampYToViewport(y, vh, cardHeight),
  };
}
