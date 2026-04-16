"use client";

import { CertificationTierMedallion } from "@/components/certification-tier-medallion";
import {
  CERTIFICATION_TIER_ORDER,
  type CertificationTierKey,
  certificationTierLabel,
  certificationTierSectionTitle,
} from "@/lib/certificationTier";
import { cn } from "@/lib/utils";

const LABEL_CLASS: Record<CertificationTierKey, string> = {
  bronze:
    "bg-gradient-to-b from-[#e8b896] via-[#a0522d] to-[#4a2812] bg-clip-text text-transparent",
  silver:
    "bg-gradient-to-b from-[#f1f5f9] via-[#64748b] to-[#1e293b] bg-clip-text text-transparent",
  gold: "bg-gradient-to-b from-[#fde047] via-[#ca8a04] to-[#713f12] bg-clip-text text-transparent",
};

export function CertificationTierIconPicker({
  value,
  onChange,
  "aria-labelledby": ariaLabelledBy,
  disabled,
}: {
  value: CertificationTierKey;
  onChange: (tier: CertificationTierKey) => void;
  "aria-labelledby"?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <div
        role="radiogroup"
        aria-labelledby={ariaLabelledBy}
        className="flex flex-wrap gap-2 sm:gap-3"
      >
        {CERTIFICATION_TIER_ORDER.map((tier) => {
          const selected = value === tier;
          return (
            <button
              key={tier}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              title={certificationTierSectionTitle(tier)}
              onClick={() => onChange(tier)}
              className={cn(
                "relative flex min-w-[3.25rem] flex-col items-center gap-1 overflow-hidden rounded-xl border-2 px-2 py-1.5 transition-[border-color,box-shadow,background-color] outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:pointer-events-none disabled:opacity-50",
                "before:pointer-events-none before:absolute before:inset-0 before:rounded-[10px] before:opacity-0 before:transition-opacity before:content-['']",
                selected
                  ? "border-black/15 bg-gradient-to-b from-muted/80 to-muted/40 shadow-md before:opacity-100 dark:border-white/12 dark:from-white/10 dark:to-white/5 dark:shadow-black/40"
                  : "border-transparent bg-muted/25 before:bg-gradient-to-br before:from-white/25 before:to-transparent hover:bg-muted/45 dark:hover:bg-muted/35",
                selected &&
                  tier === "bronze" &&
                  "before:bg-gradient-to-br before:from-[#f5d0c5]/35 before:via-transparent before:to-[#3d2314]/20",
                selected &&
                  tier === "silver" &&
                  "before:bg-gradient-to-br before:from-white/30 before:via-transparent before:to-[#1e293b]/25",
                selected &&
                  tier === "gold" &&
                  "before:bg-gradient-to-br before:from-[#fff8dc]/40 before:via-transparent before:to-[#713f12]/25",
              )}
            >
              <CertificationTierMedallion
                tier={tier}
                className="size-[2.88rem]"
                aria-hidden
              />
              <span
                className={cn(
                  "relative z-[1] text-[11px] font-semibold leading-none tracking-tight",
                  LABEL_CLASS[tier],
                )}
              >
                {certificationTierLabel(tier)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
