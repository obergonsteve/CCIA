import type { Doc } from "../_generated/dataModel";

export type CertificationTier = "bronze" | "silver" | "gold";

/** Legacy rows omit `certificationTier` — default to bronze. */
export function effectiveCertificationTier(
  level: Pick<Doc<"certificationLevels">, "certificationTier">,
): CertificationTier {
  return level.certificationTier ?? "bronze";
}

export const CERT_TIER_ORDER: CertificationTier[] = [
  "bronze",
  "silver",
  "gold",
];

export function certificationTierLabel(tier: CertificationTier): string {
  switch (tier) {
    case "bronze":
      return "Bronze";
    case "silver":
      return "Silver";
    case "gold":
      return "Gold";
    default: {
      const _x: never = tier;
      return _x;
    }
  }
}
