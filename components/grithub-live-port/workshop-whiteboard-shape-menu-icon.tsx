/**
 * Small shape glyphs for the whiteboard shapes menu — geometry matches
 * `drawShapeMsg` in workshop-whiteboard-shape-draw.ts (same s / sx / trapezoid / arrows).
 */
import type { WorkshopShapeKind } from "@/components/grithub-live-port/workshop-whiteboard-shape-kinds";
import { regularPolygonPoints } from "@/components/grithub-live-port/workshop-whiteboard-shape-kinds";

const VB = 40;
const cx = VB / 2;
const cy = VB / 2;
const s = 9.5;
const sx = s * 1.2;
const sw = 2;

function arrowPath(shape: "arrowUp" | "arrowDown" | "arrowLeft" | "arrowRight") {
  const shaft = s * 0.55;
  const stemW = s * 0.65;
  const headLen = s * 0.65;
  const headW = s * 1.5;
  if (shape === "arrowUp")
    return `M ${cx},${cy - s} L ${cx + headW / 2},${cy - s + headLen} L ${cx + stemW / 2},${cy - s + headLen} L ${cx + stemW / 2},${cy + shaft} L ${cx - stemW / 2},${cy + shaft} L ${cx - stemW / 2},${cy - s + headLen} L ${cx - headW / 2},${cy - s + headLen} Z`;
  if (shape === "arrowDown")
    return `M ${cx},${cy + s} L ${cx + headW / 2},${cy + s - headLen} L ${cx + stemW / 2},${cy + s - headLen} L ${cx + stemW / 2},${cy - shaft} L ${cx - stemW / 2},${cy - shaft} L ${cx - stemW / 2},${cy + s - headLen} L ${cx - headW / 2},${cy + s - headLen} Z`;
  if (shape === "arrowLeft")
    return `M ${cx - s},${cy} L ${cx - s + headLen},${cy - headW / 2} L ${cx - s + headLen},${cy - stemW / 2} L ${cx + shaft},${cy - stemW / 2} L ${cx + shaft},${cy + stemW / 2} L ${cx - s + headLen},${cy + stemW / 2} L ${cx - s + headLen},${cy + headW / 2} Z`;
  return `M ${cx + s},${cy} L ${cx + s - headLen},${cy - headW / 2} L ${cx + s - headLen},${cy - stemW / 2} L ${cx - shaft},${cy - stemW / 2} L ${cx - shaft},${cy + stemW / 2} L ${cx + s - headLen},${cy + stemW / 2} L ${cx + s - headLen},${cy + headW / 2} Z`;
}

type IconKind = WorkshopShapeKind | "freehand";

export function WorkshopShapeMenuIcon({
  kind,
  className,
}: {
  kind: IconKind;
  className?: string;
}) {
  const common = {
    viewBox: `0 0 ${VB} ${VB}`,
    className,
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "freehand") {
    return (
      <svg {...common} aria-hidden>
        <path d="M 8 26 Q 14 10 22 20 T 34 14" />
      </svg>
    );
  }

  if (kind === "circle") {
    return (
      <svg {...common} aria-hidden>
        <circle cx={cx} cy={cy} r={s} />
      </svg>
    );
  }
  if (kind === "oval") {
    return (
      <svg {...common} aria-hidden>
        <ellipse cx={cx} cy={cy} rx={sx} ry={s} />
      </svg>
    );
  }
  if (kind === "square") {
    return (
      <svg {...common} aria-hidden>
        <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} />
      </svg>
    );
  }
  if (kind === "rectangle") {
    return (
      <svg {...common} aria-hidden>
        <rect x={cx - sx} y={cy - s} width={sx * 2} height={s * 2} />
      </svg>
    );
  }
  if (kind === "triangle") {
    const side = 2 * s;
    const hAlt = (side * Math.sqrt(3)) / 2;
    const yBase = cy + hAlt / 3;
    const yApex = cy - (2 * hAlt) / 3;
    const pts = `${cx},${yApex} ${cx - s},${yBase} ${cx + s},${yBase}`;
    return (
      <svg {...common} aria-hidden>
        <polygon points={pts} />
      </svg>
    );
  }
  if (kind === "hexagon") {
    return (
      <svg {...common} aria-hidden>
        <polygon points={regularPolygonPoints(cx, cy, s, 6)} />
      </svg>
    );
  }
  if (kind === "pentagon") {
    return (
      <svg {...common} aria-hidden>
        <polygon points={regularPolygonPoints(cx, cy, s, 5)} />
      </svg>
    );
  }
  if (kind === "trapezoid") {
    const topW = s * 0.6;
    const pts = `${cx - topW},${cy - s} ${cx + topW},${cy - s} ${cx + s},${cy + s} ${cx - s},${cy + s}`;
    return (
      <svg {...common} aria-hidden>
        <polygon points={pts} />
      </svg>
    );
  }
  if (kind === "line") {
    return (
      <svg {...common} aria-hidden>
        <line
          x1={cx - sx * 0.95}
          y1={cy + s * 0.35}
          x2={cx + sx * 0.95}
          y2={cy - s * 0.35}
        />
      </svg>
    );
  }
  if (
    kind === "arrowUp" ||
    kind === "arrowDown" ||
    kind === "arrowLeft" ||
    kind === "arrowRight"
  ) {
    return (
      <svg {...common} aria-hidden>
        <path d={arrowPath(kind)} />
      </svg>
    );
  }
  if (kind === "polyline") {
    return (
      <svg {...common} aria-hidden>
        <path d="M 9 28 L 16 12 L 24 22 L 32 10" />
      </svg>
    );
  }
  if (kind === "polygon") {
    return (
      <svg {...common} aria-hidden>
        <polygon points="12,12 30,14 26,30 8,26" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <circle cx={cx} cy={cy} r={s} />
    </svg>
  );
}
