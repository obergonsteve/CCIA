/** Fired in-tab when the preference changes (e.g. from Settings), so the shell can sync. */
export const HIDE_SIDEBAR_ON_NAVIGATE_EVENT = "ccia-hide-sidebar-on-navigate-changed" as const;

const STORAGE_KEY = "ccia-hide-sidebar-on-navigate";

export function getHideSidebarOnNavigate(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setHideSidebarOnNavigate(value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(HIDE_SIDEBAR_ON_NAVIGATE_EVENT, { detail: { value } }),
  );
}
