/**
 * Opaque colour bands for admin “training board” drawers (analytics + edit
 * sheets). Matches columns: certification (lime), unit (gold), content (sky).
 */
export type TrainingBoardDrawerKind =
  | "certification"
  | "unit"
  | "content";

export function trainingBoardDrawerChrome(
  kind: TrainingBoardDrawerKind | null | undefined,
): { sheet: string; header: string; body: string } {
  switch (kind) {
    case "certification":
      return {
        sheet:
          "border-l-4 border-l-brand-lime bg-[color-mix(in_oklab,var(--brand-lime)_18%,var(--popover))] dark:border-l-brand-lime dark:bg-[color-mix(in_oklab,var(--brand-lime)_24%,var(--popover))]",
        header:
          "border-b-2 border-b-brand-lime bg-[color-mix(in_oklab,var(--brand-lime)_32%,var(--muted))] dark:border-b-brand-lime dark:bg-[color-mix(in_oklab,var(--brand-lime)_38%,var(--muted))]",
        body: "bg-[color-mix(in_oklab,var(--brand-lime)_12%,var(--popover))] dark:bg-[color-mix(in_oklab,var(--brand-lime)_16%,var(--popover))]",
      };
    case "unit":
      return {
        sheet:
          "border-l-4 border-l-brand-gold bg-[color-mix(in_oklab,var(--brand-gold)_18%,var(--popover))] dark:border-l-brand-gold dark:bg-[color-mix(in_oklab,var(--brand-gold)_24%,var(--popover))]",
        header:
          "border-b-2 border-b-brand-gold bg-[color-mix(in_oklab,var(--brand-gold)_32%,var(--muted))] dark:border-b-brand-gold dark:bg-[color-mix(in_oklab,var(--brand-gold)_38%,var(--muted))]",
        body: "bg-[color-mix(in_oklab,var(--brand-gold)_12%,var(--popover))] dark:bg-[color-mix(in_oklab,var(--brand-gold)_16%,var(--popover))]",
      };
    case "content":
      return {
        sheet:
          "border-l-4 border-l-brand-sky bg-[color-mix(in_oklab,var(--brand-sky)_18%,var(--popover))] dark:border-l-brand-sky dark:bg-[color-mix(in_oklab,var(--brand-sky)_24%,var(--popover))]",
        header:
          "border-b-2 border-b-brand-sky bg-[color-mix(in_oklab,var(--brand-sky)_32%,var(--muted))] dark:border-b-brand-sky dark:bg-[color-mix(in_oklab,var(--brand-sky)_38%,var(--muted))]",
        body: "bg-[color-mix(in_oklab,var(--brand-sky)_12%,var(--popover))] dark:bg-[color-mix(in_oklab,var(--brand-sky)_16%,var(--popover))]",
      };
    default:
      return {
        sheet: "",
        header: "border-border bg-popover",
        body: "",
      };
  }
}
