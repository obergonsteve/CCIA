"use client";

import type { CertificationTierKey } from "@/lib/certificationTier";
import { cn } from "@/lib/utils";
import {
  forwardRef,
  useId,
  useMemo,
  type ComponentPropsWithoutRef,
} from "react";

/**
 * Large 5-point star centred in 24×24 (outer radius ~9) — metallic tier fill.
 */
const FANCY_STAR_D =
  "M12,3 L14.057,9.168 L20.56,9.219 L15.329,13.082 L17.29,19.281 L12,15.5 L6.71,19.281 L8.671,13.082 L3.44,9.219 L9.943,9.168 Z";

type TierFancyStarGlyphProps = Omit<
  ComponentPropsWithoutRef<"svg">,
  "children" | "viewBox" | "xmlns" | "fill" | "stroke"
> & {
  tierPaint: string;
  filter: string;
};

/** Slightly inset so strokes + emboss stay inside the 24×24 viewBox (avoids clipping in tight badges). */
const STAR_BODY_TRANSFORM = "translate(12 12) scale(1.12) translate(-12 -12)";

const TierFancyStarGlyph = forwardRef<SVGSVGElement, TierFancyStarGlyphProps>(
  function TierFancyStarGlyph(
    { className, tierPaint, filter: filterStack, style, ...props },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(className)}
        style={style ? { ...style, filter: filterStack } : { filter: filterStack }}
        {...props}
      >
        <g transform={STAR_BODY_TRANSFORM}>
          <g opacity={0.36} aria-hidden>
            <g transform="translate(12 12) scale(1.04) translate(-12 -12)">
              <path d={FANCY_STAR_D} fill={tierPaint} />
            </g>
          </g>
          <path
            transform="translate(0.55 0.72)"
            d={FANCY_STAR_D}
            fill="rgb(0 0 0 / 0.32)"
            aria-hidden
          />
          <path
            d={FANCY_STAR_D}
            fill={tierPaint}
            stroke="currentColor"
            strokeWidth={0.55}
            strokeLinejoin="round"
          />
          <path
            d={FANCY_STAR_D}
            fill="none"
            stroke="rgb(255 255 255 / 0.5)"
            strokeWidth={0.34}
            strokeLinejoin="round"
            transform="translate(-0.38 -0.42)"
            aria-hidden
          />
        </g>
      </svg>
    );
  },
);
TierFancyStarGlyph.displayName = "TierFancyStarGlyph";

function TierStarGradients({ idPrefix }: { idPrefix: string }) {
  const b = `${idPrefix}-bronze`;
  const s = `${idPrefix}-silver`;
  const g = `${idPrefix}-gold`;
  const emboss = `${idPrefix}-starEmboss`;
  return (
    <svg
      width="0"
      height="0"
      className="pointer-events-none absolute size-0 overflow-hidden"
      aria-hidden
    >
      <defs>
        <filter
          id={emboss}
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.9" result="sblur" />
          <feOffset in="sblur" dx="0.55" dy="1.05" result="soff" />
          <feFlood floodColor="#000000" floodOpacity="0.38" result="fl" />
          <feComposite in="fl" in2="soff" operator="in" result="shade" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.45" result="hblur" />
          <feSpecularLighting
            in="hblur"
            surfaceScale="2.8"
            specularConstant="1"
            specularExponent="28"
            lightingColor="#ffffff"
            result="spec"
          >
            <feDistantLight azimuth="235" elevation="50" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="shine" />
          <feMerge>
            <feMergeNode in="shade" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shine" />
          </feMerge>
        </filter>
        <linearGradient
          id={b}
          x1="2"
          y1="2"
          x2="22"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#fce8d8" />
          <stop offset="18%" stopColor="#e8a578" />
          <stop offset="38%" stopColor="#8b5a3c" />
          <stop offset="52%" stopColor="#cd7f32" />
          <stop offset="68%" stopColor="#daa06d" />
          <stop offset="85%" stopColor="#6b4423" />
          <stop offset="100%" stopColor="#3d2314" />
        </linearGradient>
        <linearGradient
          id={s}
          x1="2"
          y1="3"
          x2="22"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="20%" stopColor="#e8eef5" />
          <stop offset="42%" stopColor="#94a3b8" />
          <stop offset="55%" stopColor="#cbd5e1" />
          <stop offset="72%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient
          id={g}
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#fffef5" />
          <stop offset="15%" stopColor="#fde68a" />
          <stop offset="35%" stopColor="#ca8a04" />
          <stop offset="52%" stopColor="#eab308" />
          <stop offset="68%" stopColor="#fcd34d" />
          <stop offset="88%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#713f12" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const STAR_AMBIENT_SHADOW: Record<CertificationTierKey, string> = {
  bronze:
    "drop-shadow(0.5px 0.5px 0 rgb(255 248 240 / 0.28)) drop-shadow(1.1px 1.35px 1.85px rgb(0 0 0 / 0.36))",
  silver:
    "drop-shadow(0.5px 0.5px 0 rgb(255 255 255 / 0.4)) drop-shadow(1px 1.25px 1.7px rgb(0 0 0 / 0.32))",
  gold:
    "drop-shadow(0.5px 0.5px 0 rgb(255 252 220 / 0.35)) drop-shadow(1.05px 1.3px 1.9px rgb(45 25 0 / 0.4))",
};

/** Metallic tier star (bronze / silver / gold) for badges and filters. */
export function CertificationTierMedallion({
  tier,
  /** Default for tight badge rows; pass a larger `className` in context (e.g. `size-6` from `certificationTierBadgeMedallionClass`). */
  className = "size-4",
  "aria-hidden": ariaHidden = true,
}: {
  tier: CertificationTierKey;
  className?: string;
  "aria-hidden"?: boolean;
}) {
  const rawId = useId();
  const idPrefix = useMemo(
    () => `tier-star-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [rawId],
  );
  const tierPaint = useMemo(
    () => `url(#${idPrefix}-${tier})`,
    [idPrefix, tier],
  );
  const embossFilterUrl = useMemo(
    () => `url(#${idPrefix}-starEmboss)`,
    [idPrefix],
  );
  const filterStack = `${embossFilterUrl} ${STAR_AMBIENT_SHADOW[tier]}`;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      data-icon="inline-start"
    >
      <TierStarGradients idPrefix={idPrefix} />
      <TierFancyStarGlyph
        tierPaint={tierPaint}
        filter={filterStack}
        className="block size-full min-h-0 min-w-0 text-black/42 dark:text-white/36"
        aria-hidden={ariaHidden}
      />
    </span>
  );
}
