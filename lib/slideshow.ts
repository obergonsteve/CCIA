/**
 * §5 — slideshow image sequence: store multiple URLs in `url` as JSON `["a","b"]`
 * or newline/`|` separated strings.
 */
export function parseSlideshowUrls(raw: string): string[] {
  const t = raw.trim();
  if (!t) {
    return [];
  }
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      /* fall through */
    }
  }
  return t
    .split(/\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
}
