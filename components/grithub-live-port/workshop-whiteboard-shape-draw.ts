import type { WorkshopShapeKind } from "@/components/grithub-live-port/workshop-whiteboard-shape-kinds";
import { regularPolygonPoints } from "@/components/grithub-live-port/workshop-whiteboard-shape-kinds";

/** Normalized shape stroke (0–1 coordinates), persisted in Convex. */
export type ShapeMsg = {
  v: 1;
  t: "S";
  shape: WorkshopShapeKind;
  x: number;
  y: number;
  w: number;
  c: string;
  x2?: number;
  y2?: number;
  sc?: number;
  pts?: { x: number; y: number }[];
};

function baseRadius(ch: number, sc?: number): number {
  return Math.max(3, 0.08 * ch * (sc ?? 1));
}

export function drawShapeMsg(
  ctx: CanvasRenderingContext2D,
  m: ShapeMsg,
  cw: number,
  ch: number,
) {
  const cx = m.x * cw;
  const cy = m.y * ch;
  const strokePx = Math.max(1, m.w * ch);
  const s = baseRadius(ch, m.sc);
  const sx = s * 1.2;
  ctx.strokeStyle = m.c;
  ctx.lineWidth = strokePx;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.fillStyle = "transparent";

  const shape = m.shape;

  if (shape === "polyline" && m.pts && m.pts.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(m.pts[0]!.x * cw, m.pts[0]!.y * ch);
    for (let i = 1; i < m.pts.length; i++) {
      ctx.lineTo(m.pts[i]!.x * cw, m.pts[i]!.y * ch);
    }
    ctx.stroke();
    return;
  }
  if (shape === "polygon" && m.pts && m.pts.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(m.pts[0]!.x * cw, m.pts[0]!.y * ch);
    for (let i = 1; i < m.pts.length; i++) {
      ctx.lineTo(m.pts[i]!.x * cw, m.pts[i]!.y * ch);
    }
    ctx.closePath();
    ctx.stroke();
    return;
  }
  if (shape === "line" && m.x2 != null && m.y2 != null) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(m.x2 * cw, m.y2 * ch);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
      break;
    case "oval":
      ctx.ellipse(cx, cy, sx, s, 0, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(cx - s, cy - s, s * 2, s * 2);
      break;
    case "rectangle":
      ctx.rect(cx - sx, cy - s, sx * 2, s * 2);
      break;
    case "triangle": {
      const side = 2 * s;
      const hAlt = (side * Math.sqrt(3)) / 2;
      const yBase = cy + hAlt / 3;
      const yApex = cy - (2 * hAlt) / 3;
      ctx.moveTo(cx, yApex);
      ctx.lineTo(cx - s, yBase);
      ctx.lineTo(cx + s, yBase);
      ctx.closePath();
      break;
    }
    case "hexagon": {
      const pts = regularPolygonPoints(cx, cy, s, 6).split(" ");
      const p0 = pts[0]!.split(",");
      ctx.moveTo(Number(p0[0]), Number(p0[1]));
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i]!.split(",");
        ctx.lineTo(Number(px), Number(py));
      }
      ctx.closePath();
      break;
    }
    case "pentagon": {
      const pts = regularPolygonPoints(cx, cy, s, 5).split(" ");
      const p0 = pts[0]!.split(",");
      ctx.moveTo(Number(p0[0]), Number(p0[1]));
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i]!.split(",");
        ctx.lineTo(Number(px), Number(py));
      }
      ctx.closePath();
      break;
    }
    case "trapezoid": {
      const topW = s * 0.6;
      ctx.moveTo(cx - topW, cy - s);
      ctx.lineTo(cx + topW, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.lineTo(cx - s, cy + s);
      ctx.closePath();
      break;
    }
    case "arrowUp":
    case "arrowDown":
    case "arrowLeft":
    case "arrowRight": {
      const shaft = s * 0.55;
      const stemW = s * 0.65;
      const headLen = s * 0.65;
      const headW = s * 1.5;
      let d = "";
      if (shape === "arrowUp")
        d = `M ${cx},${cy - s} L ${cx + headW / 2},${cy - s + headLen} L ${cx + stemW / 2},${cy - s + headLen} L ${cx + stemW / 2},${cy + shaft} L ${cx - stemW / 2},${cy + shaft} L ${cx - stemW / 2},${cy - s + headLen} L ${cx - headW / 2},${cy - s + headLen} Z`;
      else if (shape === "arrowDown")
        d = `M ${cx},${cy + s} L ${cx + headW / 2},${cy + s - headLen} L ${cx + stemW / 2},${cy + s - headLen} L ${cx + stemW / 2},${cy - shaft} L ${cx - stemW / 2},${cy - shaft} L ${cx - stemW / 2},${cy + s - headLen} L ${cx - headW / 2},${cy + s - headLen} Z`;
      else if (shape === "arrowLeft")
        d = `M ${cx - s},${cy} L ${cx - s + headLen},${cy - headW / 2} L ${cx - s + headLen},${cy - stemW / 2} L ${cx + shaft},${cy - stemW / 2} L ${cx + shaft},${cy + stemW / 2} L ${cx - s + headLen},${cy + stemW / 2} L ${cx - s + headLen},${cy + headW / 2} Z`;
      else
        d = `M ${cx + s},${cy} L ${cx + s - headLen},${cy - headW / 2} L ${cx + s - headLen},${cy - stemW / 2} L ${cx - shaft},${cy - stemW / 2} L ${cx - shaft},${cy + stemW / 2} L ${cx + s - headLen},${cy + stemW / 2} L ${cx + s - headLen},${cy + headW / 2} Z`;
      const p = new Path2D(d);
      ctx.stroke(p);
      return;
    }
    default:
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
  }
  ctx.stroke();
}
