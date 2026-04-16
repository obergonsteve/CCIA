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

/**
 * Applied on the scroll body of edit drawers so inputs sit on a slightly
 * lifted, lighter surface than the colour-mixed panel behind them.
 */
export const trainingBoardEditDrawerFieldChrome = [
  "[&_[data-slot=input]]:border-border/50 [&_[data-slot=input]]:bg-background/90",
  "[&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:shadow-sm",
  "[&_[data-slot=input]]:dark:border-border/45 [&_[data-slot=input]]:dark:bg-background/50",
  "[&_[data-slot=textarea]]:border-border/50 [&_[data-slot=textarea]]:bg-background/90",
  "[&_[data-slot=textarea]]:text-foreground [&_[data-slot=textarea]]:shadow-sm",
  "[&_[data-slot=textarea]]:dark:border-border/45 [&_[data-slot=textarea]]:dark:bg-background/50",
  "[&_[data-slot=select-trigger]]:border-border/50 [&_[data-slot=select-trigger]]:bg-background/90",
  "[&_[data-slot=select-trigger]]:text-foreground [&_[data-slot=select-trigger]]:shadow-sm",
  "[&_[data-slot=select-trigger]]:dark:border-border/45 [&_[data-slot=select-trigger]]:dark:bg-background/50",
  "[&_[data-slot=select-trigger]]:dark:hover:bg-background/60",
].join(" ");
