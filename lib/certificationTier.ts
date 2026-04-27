export type CertificationTierKey = "bronze" | "silver" | "gold";

export const CERTIFICATION_TIER_ORDER: CertificationTierKey[] = [
  "bronze",
  "silver",
  "gold",
];

export function effectiveCertificationTier(
  level: { certificationTier?: CertificationTierKey | null },
): CertificationTierKey {
  return level.certificationTier ?? "bronze";
}

export function certificationTierLabel(tier: CertificationTierKey): string {
  switch (tier) {
    case "bronze":
      return "Bronze";
    case "silver":
      return "Silver";
    case "gold":
      return "Gold";
    default: {
      const _e: never = tier;
      return _e;
    }
  }
}

export function certificationTierSectionTitle(tier: CertificationTierKey): string {
  switch (tier) {
    case "bronze":
      return "Bronze — mandatory baseline";
    case "silver":
      return "Silver — optional skills";
    case "gold":
      return "Gold — optional professional development";
    default: {
      const _e: never = tier;
      return _e;
    }
  }
}

/** Shell for compact tier star badges (card headers, admin tree, level hero). */
export const certificationTierBadgeShellClass =
  "h-9 min-h-9 gap-1 px-3 text-sm font-bold uppercase tracking-wide";

/** Star size inside {@link certificationTierBadgeShellClass} rows. */
export const certificationTierBadgeMedallionClass = "size-8";

export function certificationTierBadgeClass(tier: CertificationTierKey): string {
  switch (tier) {
    case "bronze":
      return "border-0 bg-brand-lime/20 text-brand-charcoal dark:text-foreground";
    case "silver":
      return "border-0 bg-brand-sky/20 text-brand-charcoal dark:text-foreground";
    case "gold":
      return "border-0 bg-brand-gold/25 text-brand-charcoal dark:text-foreground";
    default: {
      const _e: never = tier;
      return _e;
    }
  }
}
