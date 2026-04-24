/** DOM id of the header “Pinned” drop target (pointer-based pin, not HTML5 DnD). */
export const PINNED_IN_APP_DROP_ID = "ccia-pinned-in-app-drop" as const;

export const CCIA_PINNED_HOVER_EVENT = "ccia-pinned-hover" as const;
export const CCIA_PINNED_SAVED_EVENT = "ccia-pinned-saved" as const;

/**
 * Whether (clientX, clientY) lies over the Pinned control.
 *
 * We use geometry on the real DOM rect — **not** `elementFromPoint` — because
 * in-flight post-its use a very high `z-index` and always sit *above* the
 * header; hit-testing the topmost element would only ever return the post-it.
 */
export function isPointOverPinnedInAppDrop(
  clientX: number,
  clientY: number,
): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const el = document.getElementById(PINNED_IN_APP_DROP_ID);
  if (el == null) {
    return false;
  }
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) {
    return false;
  }
  const pad = 12;
  return (
    clientX >= r.left - pad &&
    clientX <= r.right + pad &&
    clientY >= r.top - pad &&
    clientY <= r.bottom + pad
  );
}

export function setPinnedInAppDropHover(over: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(CCIA_PINNED_HOVER_EVENT, {
      detail: { over } as { over: boolean },
    }),
  );
}
