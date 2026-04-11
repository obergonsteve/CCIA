/** Client-side suggestion aligned with `convex/lib/entityCodes.normalizeEntityCode` (ASCII). */
export function suggestEntityCodeFromLabel(label: string, max = 48): string {
  const ascii = label
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return ascii
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "")
    .slice(0, max);
}
