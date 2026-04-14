/** Aligned with GritHub brainstorm `ShapeKind` (read-only reference). */
export type WorkshopShapeKind =
  | "circle"
  | "oval"
  | "square"
  | "rectangle"
  | "triangle"
  | "hexagon"
  | "pentagon"
  | "trapezoid"
  | "line"
  | "arrowUp"
  | "arrowDown"
  | "arrowLeft"
  | "arrowRight"
  | "polyline"
  | "polygon";

export const WORKSHOP_SHAPES: { id: WorkshopShapeKind; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "oval", label: "Oval" },
  { id: "square", label: "Square" },
  { id: "rectangle", label: "Rectangle" },
  { id: "triangle", label: "Triangle" },
  { id: "hexagon", label: "Hexagon" },
  { id: "pentagon", label: "Pentagon" },
  { id: "trapezoid", label: "Trapezoid" },
  { id: "line", label: "Line" },
  { id: "arrowUp", label: "Arrow up" },
  { id: "arrowDown", label: "Arrow down" },
  { id: "arrowLeft", label: "Arrow left" },
  { id: "arrowRight", label: "Arrow right" },
  { id: "polyline", label: "Open polygon" },
  { id: "polygon", label: "Closed polygon" },
];

export function isWorkshopShapeKind(s: string): s is WorkshopShapeKind {
  return WORKSHOP_SHAPES.some((x) => x.id === s);
}

export function regularPolygonPoints(
  cx: number,
  cy: number,
  s: number,
  n: number,
): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push(`${cx + s * Math.cos(a)},${cy + s * Math.sin(a)}`);
  }
  return pts.join(" ");
}
