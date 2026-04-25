/**
 * Webinar start times: always format in a “wall clock” IANA zone.
 * Microsoft Graph and some flows store `timeZone` as **UTC** while `startsAt` is the
 * true instant; formatting with UTC then shows 1:00 AM instead of 11:00 AM Sydney.
 */

const APP_DEFAULT_TIME_ZONE = "Australia/Sydney";

const UTC_LIKE_ZONES = new Set(
  [
    "utc",
    "etc/utc",
    "etc/gmt",
    "gmt",
    "greenwich",
    "universal",
    "zulu",
  ].map((s) => s.toLowerCase()),
);

/**
 * IANA `Etc/GMT*`: sign is inverted vs “GMT offset”; avoid for simple display copy.
 */
function isShakyGmtStyleZone(tz: string): boolean {
  return tz.toLowerCase().startsWith("etc/gmt");
}

/** Picks a zone for showing session start; never use plain UTC for human copy. */
export function resolveWorkshopTimeZoneForDisplay(
  timeZone: string | undefined | null,
): string {
  const raw = timeZone?.trim();
  if (!raw) {
    return APP_DEFAULT_TIME_ZONE;
  }
  const lower = raw.toLowerCase();
  if (UTC_LIKE_ZONES.has(lower)) {
    return APP_DEFAULT_TIME_ZONE;
  }
  if (isShakyGmtStyleZone(raw)) {
    return APP_DEFAULT_TIME_ZONE;
  }
  return raw;
}

/** Format `startsAt` (UTC ms) for in-app text (Sydney or session zone when set & sane). */
export function formatWorkshopSessionStartForDisplay(
  startsAt: number,
  timeZone: string | undefined | null,
): string {
  const zone = resolveWorkshopTimeZoneForDisplay(timeZone);
  try {
    return new Date(startsAt).toLocaleString("en-AU", {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return new Date(startsAt).toLocaleString("en-AU", {
      timeZone: APP_DEFAULT_TIME_ZONE,
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
}
