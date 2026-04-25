const FALLBACK_ZONES = [
  "UTC",
  "Pacific/Auckland",
  "Australia/Sydney",
  "Australia/Perth",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const;

/** Sorted IANA zones from `Intl`, with a small fallback list if unavailable. */
export function listIanaTimeZones(): string[] {
  try {
    const intl = Intl as unknown as {
      supportedValuesOf?: (k: string) => string[];
    };
    if (typeof intl.supportedValuesOf === "function") {
      const zones = intl.supportedValuesOf("timeZone");
      if (zones?.length) {
        return [...zones].sort((a, b) => a.localeCompare(b));
      }
    }
  } catch {
    /* ignore */
  }
  return [...FALLBACK_ZONES].sort((a, b) => a.localeCompare(b));
}

export function isValidIanaTimeZone(tz: string): boolean {
  const s = tz.trim();
  if (!s) {
    return true;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: s });
    return true;
  } catch {
    return false;
  }
}

const AUSTRALIA_IANA_FALLBACK = [
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Broken_Hill",
  "Australia/Darwin",
  "Australia/Eucla",
  "Australia/Hobart",
  "Australia/Lindeman",
  "Australia/Lord_Howe",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
] as const;

/** IANA zones with the `Australia/` prefix (for org settings restricted to Australia). */
export function listAustraliaIanaTimeZones(): string[] {
  const fromIntl = listIanaTimeZones().filter((z) => z.startsWith("Australia/"));
  if (fromIntl.length > 0) {
    return fromIntl;
  }
  return [...AUSTRALIA_IANA_FALLBACK]
    .filter((z) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: z });
        return true;
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b));
}

/** Empty, or a valid IANA zone under `Australia/`. */
export function isValidAustraliaIanaTimeZone(tz: string): boolean {
  const s = tz.trim();
  if (!s) {
    return true;
  }
  if (!s.startsWith("Australia/")) {
    return false;
  }
  return isValidIanaTimeZone(s);
}
