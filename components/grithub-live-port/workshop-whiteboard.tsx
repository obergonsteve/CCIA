"use client";

/**
 * Workshop whiteboard — GritHub brainstorm pattern: strokes in Convex only
 * (`useQuery` + mutations). Renders outside `LiveKitRoom`; AV stays in LiveKit.
 */

import {
  drawShapeMsg,
  type ShapeMsg,
} from "@/components/grithub-live-port/workshop-whiteboard-shape-draw";
import {
  type WorkshopShapeKind,
  WORKSHOP_SHAPES,
} from "@/components/grithub-live-port/workshop-whiteboard-shape-kinds";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ChevronDown,
  Eraser,
  Hand,
  Loader2,
  Pencil,
  Redo2,
  RotateCcw,
  Shapes,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import type { CSSProperties } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Toolbar accent — matches GritHub brainstorm constants. */
const TOOLBAR_COLOR = "#7c3aed";

/** Same as the 16:9 stage; chip row aligns with the board. */
const WHITEBOARD_STAGE_MAX_W =
  "min(100%, 1100px, calc(min(50vh, 560px) * 16 / 9))";

/**
 * Convex often completes in one frame; React can batch +1/-1 so the chip never
 * paints. Hold the “Syncing…” state at least this long (GritHub-style feedback).
 */
const MIN_WHITEBOARD_SAVE_CHIP_MS = 320;

/**
 * Segmented toolbar chrome: clip fills, clean dividers, amber ring when `active`.
 * `clipOverflow={false}` for controls that anchor a portaled dropdown (otherwise
 * `overflow-hidden` clips menus; `overflow-x-auto` on the toolbar row also forces
 * vertical clipping per CSS overflow rules).
 */
function toolbarPillClass(
  active: boolean,
  blackboard: boolean,
  clipOverflow = true,
) {
  return cn(
    "flex h-8 shrink-0 items-stretch rounded-md border shadow-sm",
    clipOverflow ? "overflow-hidden" : "overflow-visible",
    blackboard
      ? "border-neutral-600 bg-neutral-900"
      : "border-neutral-300/90 bg-white",
    active && "z-[1] ring-2 ring-amber-500 ring-offset-0",
  );
}

const toolbarSegBtn =
  "relative inline-flex h-full min-h-0 shrink-0 items-center justify-center border-0 px-0 text-sm font-medium outline-none transition-colors focus-visible:z-[2] focus-visible:ring-2 focus-visible:ring-amber-500/80 focus-visible:ring-offset-1";

function toolbarDivideClass(blackboard: boolean) {
  return cn(
    "divide-x",
    blackboard ? "divide-neutral-700" : "divide-neutral-200/95",
  );
}

/** 12 pen / text colours (picker + default identity tint). */
const PEN_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
  "#be123c",
  "#0f172a",
  "#78716c",
] as const;

type LineThickness = "thin" | "med" | "thick";
const STROKE_WIDTH_BY_THICKNESS: Record<LineThickness, number> = {
  thin: 0.0015,
  med: 0.0045,
  thick: 0.008,
};

type TextSize = "small" | "med" | "large";

type LineMsg = {
  v: 1;
  t: "L";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  /** Ink colour (ignored when `er` is true — each client uses their own canvas bg). */
  c: string;
  /** Eraser segment: render with viewer’s background so light/dark theme stays consistent. */
  er?: true;
};

type ClearMsg = { v: 1; t: "C" };

type TextMsg = {
  v: 1;
  t: "TXT";
  x: number;
  y: number;
  text: string;
  fz: number;
  c: string;
};

type EmojiMsg = {
  v: 1;
  t: "E";
  x: number;
  y: number;
  e: string;
  c: string;
};

type WbPayload = LineMsg | ClearMsg | TextMsg | EmojiMsg | ShapeMsg;
type WbElement = LineMsg | TextMsg | EmojiMsg | ShapeMsg;

function isWbPayload(x: unknown): x is WbPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as { v?: unknown; t?: unknown };
  if (o.v !== 1 || typeof o.t !== "string") return false;
  if (o.t === "C") return true;
  if (o.t === "L") {
    const L = x as LineMsg;
    return (
      [L.x0, L.y0, L.x1, L.y1, L.w].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      ) &&
      typeof L.c === "string" &&
      L.c.length < 40 &&
      (L.er === true || L.c.length > 0)
    );
  }
  if (o.t === "TXT") {
    const T = x as TextMsg;
    return (
      typeof T.x === "number" &&
      typeof T.y === "number" &&
      typeof T.text === "string" &&
      T.text.length > 0 &&
      T.text.length < 2000 &&
      typeof T.fz === "number" &&
      typeof T.c === "string"
    );
  }
  if (o.t === "E") {
    const E = x as EmojiMsg;
    return (
      typeof E.x === "number" &&
      typeof E.y === "number" &&
      typeof E.e === "string" &&
      E.e.length > 0 &&
      E.e.length < 16 &&
      typeof E.c === "string"
    );
  }
  if (o.t === "S") {
    const S = x as ShapeMsg;
    if (!WORKSHOP_SHAPES.some((k) => k.id === S.shape)) return false;
    if (
      ![S.x, S.y, S.w].every((n) => typeof n === "number" && Number.isFinite(n)) ||
      S.x < 0 ||
      S.x > 1 ||
      S.y < 0 ||
      S.y > 1 ||
      S.w <= 0 ||
      S.w > 0.05 ||
      typeof S.c !== "string" ||
      S.c.length === 0 ||
      S.c.length >= 40
    ) {
      return false;
    }
    if (S.shape === "line") {
      return (
        typeof S.x2 === "number" &&
        typeof S.y2 === "number" &&
        Number.isFinite(S.x2) &&
        Number.isFinite(S.y2) &&
        S.x2 >= 0 &&
        S.x2 <= 1 &&
        S.y2 >= 0 &&
        S.y2 <= 1
      );
    }
    if (S.shape === "polyline" || S.shape === "polygon") {
      if (!Array.isArray(S.pts) || S.pts.length < 2 || S.pts.length > 80) {
        return false;
      }
      return S.pts.every(
        (p) =>
          p &&
          typeof p.x === "number" &&
          typeof p.y === "number" &&
          p.x >= 0 &&
          p.x <= 1 &&
          p.y >= 0 &&
          p.y <= 1,
      );
    }
    if (S.sc !== undefined) {
      if (
        typeof S.sc !== "number" ||
        !Number.isFinite(S.sc) ||
        S.sc <= 0 ||
        S.sc > 24
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function isWbElement(x: unknown): x is WbElement {
  return isWbPayload(x) && (x as { t: string }).t !== "C";
}

function canvasBackground(theme: "whiteboard" | "blackboard"): string {
  return theme === "blackboard" ? "#171717" : "#f8fafc";
}

function drawLineSegment(
  ctx: CanvasRenderingContext2D,
  line: LineMsg,
  w: number,
  h: number,
  canvasBg: string,
) {
  const lw = Math.max(1, line.w * h);
  ctx.strokeStyle = line.er ? canvasBg : line.c;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(line.x0 * w, line.y0 * h);
  ctx.lineTo(line.x1 * w, line.y1 * h);
  ctx.stroke();
}

/** Matches canvas `fillText` sizing for `TextMsg.fz` (must stay in sync with `drawText`). */
function textRenderPx(fz: number, logicalH: number): number {
  return Math.max(10, Math.min(48, (fz / 480) * logicalH));
}

function drawText(
  ctx: CanvasRenderingContext2D,
  t: TextMsg,
  w: number,
  h: number,
) {
  const px = textRenderPx(t.fz, h);
  ctx.font = `${px}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = t.c;
  const lines = t.text.split(/\r?\n/);
  let y = t.y * h + px * 0.85;
  const lh = px * 1.2;
  for (const line of lines) {
    ctx.fillText(line, t.x * w, y);
    y += lh;
  }
}

function drawEmoji(
  ctx: CanvasRenderingContext2D,
  e: EmojiMsg,
  w: number,
  h: number,
) {
  const px = Math.max(18, Math.min(56, h * 0.08));
  ctx.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = e.c;
  ctx.fillText(e.e, e.x * w, e.y * h);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function redraw(
  canvas: HTMLCanvasElement,
  elements: WbElement[],
  bg: string,
  logicalW: number,
  logicalH: number,
  overlay?: {
    pendingLines?: LineMsg[];
    preview?: WbElement | null;
  },
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, logicalW, logicalH);
  for (const el of elements) {
    if (el.t === "L") drawLineSegment(ctx, el, logicalW, logicalH, bg);
    else if (el.t === "TXT") drawText(ctx, el, logicalW, logicalH);
    else if (el.t === "E") drawEmoji(ctx, el, logicalW, logicalH);
    else if (el.t === "S") drawShapeMsg(ctx, el, logicalW, logicalH);
  }
  const pending = overlay?.pendingLines;
  if (pending) {
    for (const line of pending) {
      drawLineSegment(ctx, line, logicalW, logicalH, bg);
    }
  }
  const preview = overlay?.preview;
  if (preview) {
    if (preview.t === "L") drawLineSegment(ctx, preview, logicalW, logicalH, bg);
    else if (preview.t === "TXT") drawText(ctx, preview, logicalW, logicalH);
    else if (preview.t === "E") drawEmoji(ctx, preview, logicalW, logicalH);
    else if (preview.t === "S") drawShapeMsg(ctx, preview, logicalW, logicalH);
  }
}

function shapeMsgFromDrag(
  shape: WorkshopShapeKind,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cw: number,
  ch: number,
  w: number,
  c: string,
): ShapeMsg | null {
  const dx = (x1 - x0) * cw;
  const dy = (y1 - y0) * ch;
  const dist = Math.hypot(dx, dy);
  const base = 0.08 * Math.min(cw, ch);
  if (shape === "line") {
    if (dist < 1.5) return null;
    return { v: 1, t: "S", shape: "line", x: x0, y: y0, x2: x1, y2: y1, w, c };
  }
  if (shape === "polyline" || shape === "polygon") return null;
  const sc = Math.max(0.2, Math.min(18, dist / (2 * base)));
  return { v: 1, t: "S", shape, x: x0, y: y0, w, c, sc };
}

function previewShapeDragMsg(
  shape: WorkshopShapeKind,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cw: number,
  ch: number,
  w: number,
  c: string,
): ShapeMsg {
  const msg = shapeMsgFromDrag(shape, x0, y0, x1, y1, cw, ch, w, c);
  if (msg) return msg;
  if (shape === "line") {
    return { v: 1, t: "S", shape: "line", x: x0, y: y0, x2: x1, y2: y1, w, c };
  }
  return { v: 1, t: "S", shape, x: x0, y: y0, w, c, sc: 0.25 };
}

function hashIdentity(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export type WorkshopWhiteboardProps = {
  workshopSessionId: Id<"workshopSessions">;
  /** GritHub-style: only host can clear the board for everyone. */
  canClearForEveryone?: boolean;
};

export function WorkshopWhiteboard({
  workshopSessionId,
  canClearForEveryone = false,
}: WorkshopWhiteboardProps) {
  const strokes = useQuery(api.workshopWhiteboard.listWorkshopWhiteboardStrokes, {
    workshopSessionId,
  });
  const addStrokeMut = useMutation(
    api.workshopWhiteboard.addWorkshopWhiteboardStroke,
  );
  const addStrokesBatchMut = useMutation(
    api.workshopWhiteboard.addWorkshopWhiteboardStrokesBatch,
  );
  const clearStrokesMut = useMutation(
    api.workshopWhiteboard.clearWorkshopWhiteboardStrokes,
  );
  const undoStrokeMut = useMutation(
    api.workshopWhiteboard.undoMyLastWorkshopWhiteboardStroke,
  );
  const me = useQuery(api.users.me, {});

  const elements = useMemo(() => {
    if (!strokes) return [];
    const out: WbElement[] = [];
    for (const row of strokes) {
      if (isWbElement(row.strokeData)) out.push(row.strokeData);
    }
    return out;
  }, [strokes]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastNormRef = useRef<{ x: number; y: number } | null>(null);
  const logicalSizeRef = useRef({ w: 320, h: 180 });
  /** Line segments for the current pointer stroke; flushed in one Convex batch on pointer-up. */
  const lineBufferRef = useRef<LineMsg[]>([]);
  /** Last flushed segments kept on-canvas until `strokes` includes those rows (avoids save flicker). */
  const flushOverlayRef = useRef<LineMsg[]>([]);
  /** Row-count target: clear overlay when `strokes.length >= base + n`. */
  const flushAwaitRef = useRef<{ base: number; n: number } | null>(null);
  const paintRafRef = useRef<number | null>(null);
  const paintRef = useRef<() => void>(() => {});
  /** False until after mount; avoids rAF/toast updates before the client tree is committed. */
  const mountedRef = useRef(false);

  const toolbarColor = TOOLBAR_COLOR;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const [mode, setMode] = useState<"draw" | "write" | "pan">("draw");
  const [inkKind, setInkKind] = useState<"draw" | "erase">("draw");
  const [lineThickness, setLineThickness] = useState<LineThickness>("med");
  const [textSize, setTextSize] = useState<TextSize>("med");
  const [drawingTool, setDrawingTool] = useState<
    "freehand" | WorkshopShapeKind
  >("freehand");
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const shapePickerRef = useRef<HTMLDivElement>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const colorMenuPortalRef = useRef<HTMLDivElement>(null);
  const [colorMenuFixed, setColorMenuFixed] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const shapeMenuPortalRef = useRef<HTMLDivElement>(null);
  const [shapeMenuFixed, setShapeMenuFixed] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [polyDraftPts, setPolyDraftPts] = useState<{ x: number; y: number }[]>(
    [],
  );
  const activeShapeDragRef = useRef<{
    shape: WorkshopShapeKind;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);

  const [textInputAt, setTextInputAt] = useState<{
    normX: number;
    normY: number;
  } | null>(null);
  const [textDraft, setTextDraft] = useState("");
  /** CSS pixel size of the canvas (for inline text composer placement). */
  const [canvasCssSize, setCanvasCssSize] = useState({ w: 0, h: 0 });
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);

  /** Convex ink mutations in flight (batch + single strokes). */
  const [convexSaveDepth, setConvexSaveDepth] = useState(0);

  const defaultPenColor = useMemo(() => {
    const id = me?._id != null ? String(me._id) : "anon";
    return PEN_COLORS[hashIdentity(id) % PEN_COLORS.length]!;
  }, [me?._id]);
  const [penColorOverride, setPenColorOverride] = useState<string | null>(null);
  const penColor = penColorOverride ?? defaultPenColor;

  const persistStroke = useCallback(
    async (strokeData: WbElement) => {
      setConvexSaveDepth((d) => d + 1);
      const t0 = Date.now();
      try {
        await addStrokeMut({ workshopSessionId, strokeData });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not save to the whiteboard.",
        );
      } finally {
        const elapsed = Date.now() - t0;
        if (elapsed < MIN_WHITEBOARD_SAVE_CHIP_MS) {
          await new Promise<void>((r) =>
            setTimeout(r, MIN_WHITEBOARD_SAVE_CHIP_MS - elapsed),
          );
        }
        setConvexSaveDepth((d) => Math.max(0, d - 1));
      }
    },
    [addStrokeMut, workshopSessionId],
  );

  const strokeWidthNorm = STROKE_WIDTH_BY_THICKNESS[lineThickness];

  const schedulePaint = useCallback(() => {
    if (paintRafRef.current != null) return;
    paintRafRef.current = requestAnimationFrame(() => {
      paintRafRef.current = null;
      if (!mountedRef.current) return;
      paintRef.current();
    });
  }, []);

  const flushLineBuffer = useCallback(async () => {
    const buf = lineBufferRef.current;
    if (buf.length === 0) return;
    const baseAtFlush = strokes?.length ?? 0;
    lineBufferRef.current = [];
    flushOverlayRef.current = buf;
    flushAwaitRef.current = { base: baseAtFlush, n: buf.length };
    paintRef.current();
    setConvexSaveDepth((d) => d + 1);
    const t0 = Date.now();
    try {
      await addStrokesBatchMut({ workshopSessionId, strokes: buf });
    } catch (e) {
      flushOverlayRef.current = [];
      flushAwaitRef.current = null;
      lineBufferRef.current = [...buf, ...lineBufferRef.current];
      if (mountedRef.current) {
        paintRef.current();
        toast.error(
          e instanceof Error ? e.message : "Could not save brush strokes.",
        );
      }
    } finally {
      const elapsed = Date.now() - t0;
      if (elapsed < MIN_WHITEBOARD_SAVE_CHIP_MS) {
        await new Promise<void>((r) =>
          setTimeout(r, MIN_WHITEBOARD_SAVE_CHIP_MS - elapsed),
        );
      }
      setConvexSaveDepth((d) => Math.max(0, d - 1));
    }
  }, [addStrokesBatchMut, workshopSessionId, strokes]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      if (paintRafRef.current != null) {
        cancelAnimationFrame(paintRafRef.current);
        paintRafRef.current = null;
      }
      flushOverlayRef.current = [];
      flushAwaitRef.current = null;
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    paintRef.current = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { w, h } = logicalSizeRef.current;
      const bg = canvasBackground("whiteboard");
      const sync = flushAwaitRef.current;
      const fo = flushOverlayRef.current;
      if (
        sync &&
        fo.length > 0 &&
        strokes !== undefined &&
        strokes.length >= sync.base + sync.n
      ) {
        flushOverlayRef.current = [];
        flushAwaitRef.current = null;
      }
      const foNow = flushOverlayRef.current;
      const live = lineBufferRef.current;
      const pendingForDraw =
        foNow.length === 0
          ? live
          : live.length === 0
            ? foNow
            : [...live, ...foNow];
      let preview: WbElement | null = null;
      const drag = activeShapeDragRef.current;
      if (drag) {
        preview = previewShapeDragMsg(
          drag.shape,
          drag.x0,
          drag.y0,
          drag.x1,
          drag.y1,
          w,
          h,
          strokeWidthNorm,
          penColor,
        );
      } else if (
        (drawingTool === "polyline" || drawingTool === "polygon") &&
        polyDraftPts.length >= 2
      ) {
        preview = {
          v: 1,
          t: "S",
          shape: drawingTool,
          x: polyDraftPts[0]!.x,
          y: polyDraftPts[0]!.y,
          w: strokeWidthNorm,
          c: penColor,
          pts: polyDraftPts,
        };
      }
      redraw(canvas, elements, bg, w, h, {
        pendingLines: pendingForDraw,
        preview,
      });
    };
    paintRef.current();
  }, [
    elements,
    strokes,
    drawingTool,
    polyDraftPts,
    strokeWidthNorm,
    penColor,
  ]);

  useLayoutEffect(() => {
    if (!textInputAt) return;
    const el = composerTextareaRef.current;
    if (!el) return;
    el.focus();
  }, [textInputAt]);

  const syncCanvasSize = useCallback(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = viewport.getBoundingClientRect();
    const cssW = Math.max(120, Math.floor(rect.width));
    const cssH = Math.max(120, Math.floor(rect.height));
    logicalSizeRef.current = { w: cssW, h: cssH };
    setCanvasCssSize({ w: cssW, h: cssH });
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    paintRef.current();
  }, []);

  useLayoutEffect(() => {
    syncCanvasSize();
    const ro = new ResizeObserver(() => syncCanvasSize());
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [syncCanvasSize]);

  useLayoutEffect(() => {
    if (!shapePickerOpen) {
      setShapeMenuFixed(null);
      return;
    }
    const el = shapePickerRef.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      setShapeMenuFixed({ top: r.bottom + 4, left: r.left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [shapePickerOpen]);

  useLayoutEffect(() => {
    if (!colorPickerOpen) {
      setColorMenuFixed(null);
      return;
    }
    const el = colorPickerRef.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      setColorMenuFixed({ top: r.bottom + 4, left: r.left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [colorPickerOpen]);

  useEffect(() => {
    if (!shapePickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (shapePickerRef.current?.contains(t)) return;
      if (shapeMenuPortalRef.current?.contains(t)) return;
      setShapePickerOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [shapePickerOpen]);

  useEffect(() => {
    if (!colorPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (colorPickerRef.current?.contains(t)) return;
      if (colorMenuPortalRef.current?.contains(t)) return;
      setColorPickerOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [colorPickerOpen]);

  useEffect(() => {
    if (inkKind === "erase") setDrawingTool("freehand");
  }, [inkKind]);

  useEffect(() => {
    if (drawingTool !== "polyline" && drawingTool !== "polygon") {
      setPolyDraftPts([]);
    }
  }, [drawingTool]);

  useLayoutEffect(() => {
    if (mode !== "draw") {
      activeShapeDragRef.current = null;
      paintRef.current();
    }
  }, [mode]);

  useEffect(() => {
    if (zoom <= 1 && mode === "pan") setMode("draw");
  }, [zoom, mode]);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: PointerEvent) => {
      const start = panStartRef.current;
      if (!start) return;
      setPan({
        x: start.panX + e.clientX - start.clientX,
        y: start.panY + e.clientY - start.clientY,
      });
    };
    const onUp = () => {
      panStartRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isPanning]);

  const normFromClient = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }, []);

  const appendLineSegment = useCallback(
    (x0: number, y0: number, x1: number, y1: number) => {
      const line: LineMsg = {
        v: 1,
        t: "L",
        x0,
        y0,
        x1,
        y1,
        w: strokeWidthNorm,
        c: penColor,
        ...(inkKind === "erase" ? ({ er: true as const } as const) : {}),
      };
      lineBufferRef.current.push(line);
      schedulePaint();
    },
    [inkKind, penColor, strokeWidthNorm, schedulePaint],
  );

  const fontPxForTextSize = useCallback((size: TextSize, h: number) => {
    const base = size === "small" ? 14 : size === "med" ? 20 : 28;
    return Math.round((base / 480) * h);
  }, []);

  const commitTextAt = useCallback(
    (normX: number, normY: number, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { h } = logicalSizeRef.current;
      const fz = fontPxForTextSize(textSize, h);
      const msg: TextMsg = {
        v: 1,
        t: "TXT",
        x: normX,
        y: normY,
        text: trimmed,
        fz,
        c: penColor,
      };
      void persistStroke(msg);
    },
    [persistStroke, textSize, fontPxForTextSize, penColor],
  );

  const finalizeShapeDrag = useCallback(() => {
    const d = activeShapeDragRef.current;
    if (!d) return;
    activeShapeDragRef.current = null;
    schedulePaint();
    const { w, h } = logicalSizeRef.current;
    const msg = shapeMsgFromDrag(
      d.shape,
      d.x0,
      d.y0,
      d.x1,
      d.y1,
      w,
      h,
      strokeWidthNorm,
      penColor,
    );
    if (msg) void persistStroke(msg);
  }, [persistStroke, strokeWidthNorm, penColor, schedulePaint]);

  const cancelShapeDrag = useCallback(() => {
    activeShapeDragRef.current = null;
    schedulePaint();
  }, [schedulePaint]);

  const finishPolyDraft = useCallback(() => {
    if (drawingTool !== "polyline" && drawingTool !== "polygon") return;
    if (polyDraftPts.length < 2) return;
    const msg: ShapeMsg = {
      v: 1,
      t: "S",
      shape: drawingTool,
      x: polyDraftPts[0]!.x,
      y: polyDraftPts[0]!.y,
      w: strokeWidthNorm,
      c: penColor,
      pts: [...polyDraftPts],
    };
    void persistStroke(msg);
    setPolyDraftPts([]);
  }, [drawingTool, polyDraftPts, persistStroke, strokeWidthNorm, penColor]);

  const undoOne = useCallback(async () => {
    try {
      await undoStrokeMut({ workshopSessionId });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not undo the last stroke.",
      );
    }
  }, [undoStrokeMut, workshopSessionId]);

  useEffect(() => {
    if (drawingTool !== "polyline" && drawingTool !== "polygon") return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setPolyDraftPts([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawingTool]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (mode === "pan") {
        e.preventDefault();
        panStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          panX: pan.x,
          panY: pan.y,
        };
        setIsPanning(true);
        return;
      }
      const p = normFromClient(e.clientX, e.clientY);
      if (!p) return;
      if (mode === "write") {
        e.preventDefault();
        if (textInputAt && textDraft.trim()) {
          void commitTextAt(textInputAt.normX, textInputAt.normY, textDraft);
        }
        setTextInputAt({ normX: p.x, normY: p.y });
        setTextDraft("");
        return;
      }
      if (
        mode === "draw" &&
        inkKind === "draw" &&
        (drawingTool === "polyline" || drawingTool === "polygon")
      ) {
        e.preventDefault();
        setPolyDraftPts((prev) => [...prev, p]);
        return;
      }
      if (
        mode === "draw" &&
        inkKind === "draw" &&
        drawingTool !== "freehand" &&
        drawingTool !== "polyline" &&
        drawingTool !== "polygon"
      ) {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        activeShapeDragRef.current = {
          shape: drawingTool,
          x0: p.x,
          y0: p.y,
          x1: p.x,
          y1: p.y,
        };
        schedulePaint();
        return;
      }
      if (lineBufferRef.current.length > 0) {
        void flushLineBuffer();
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastNormRef.current = p;
    },
    [
      mode,
      normFromClient,
      pan.x,
      pan.y,
      inkKind,
      drawingTool,
      schedulePaint,
      flushLineBuffer,
      textInputAt,
      textDraft,
      commitTextAt,
    ],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const d = activeShapeDragRef.current;
      if (d) {
        const p = normFromClient(e.clientX, e.clientY);
        if (!p) return;
        d.x1 = p.x;
        d.y1 = p.y;
        schedulePaint();
        return;
      }
      if (mode !== "draw") return;
      if (!drawingRef.current || !lastNormRef.current) return;
      const p = normFromClient(e.clientX, e.clientY);
      if (!p) return;
      const prev = lastNormRef.current;
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      if (dx * dx + dy * dy < 0.000004) return;
      appendLineSegment(prev.x, prev.y, p.x, p.y);
      lastNormRef.current = p;
    },
    [mode, normFromClient, appendLineSegment, schedulePaint],
  );

  const endStroke = useCallback(() => {
    drawingRef.current = false;
    lastNormRef.current = null;
  }, []);

  const onPointerUpCanvas = useCallback(() => {
    finalizeShapeDrag();
    void flushLineBuffer();
    endStroke();
  }, [finalizeShapeDrag, flushLineBuffer, endStroke]);

  const clearAll = useCallback(async () => {
    if (!canClearForEveryone) return;
    try {
      await clearStrokesMut({ workshopSessionId });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not clear the whiteboard.",
      );
    }
  }, [canClearForEveryone, clearStrokesMut, workshopSessionId]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(3, z + 0.25));
  }, []);
  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(1, z - 0.25));
  }, []);
  const zoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (mode === "pan") setMode("draw");
  }, [mode]);

  const transformStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "center center",
    width: "100%",
    height: "100%",
  };

  const inlineTextLayout = useMemo(() => {
    if (!textInputAt || canvasCssSize.h <= 0) return null;
    const { w: cw, h: ch } = canvasCssSize;
    const fzStored = fontPxForTextSize(textSize, ch);
    const px = textRenderPx(fzStored, ch);
    const leftPx = textInputAt.normX * cw;
    const baselineY = textInputAt.normY * ch + px * 0.85;
    const topPx = baselineY - px * 0.78;
    return {
      leftPx,
      topPx,
      widthPx: Math.max(140, cw - leftPx - 6),
      fontPx: px,
    };
  }, [textInputAt, canvasCssSize, textSize, fontPxForTextSize]);

  return (
    <div className="flex min-h-0 shrink-0 flex-col min-w-0">
      {/* GritHub-style: horizontal scroll so the full toolbar stays reachable on narrow layouts */}
      <div className="w-full min-w-0 shrink-0 overflow-x-auto overflow-y-visible">
        <div className="relative z-20 flex min-h-[2.75rem] w-max min-w-full flex-wrap items-center justify-center gap-1 border-b border-slate-400/55 bg-gradient-to-b from-slate-200/95 via-sky-50/70 to-slate-200/95 px-2 py-1.5 dark:border-slate-600/70 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-900">
        <div className={toolbarPillClass(false, false)}>
          <div
            className={cn(
              "flex h-full min-h-0 flex-1",
              toolbarDivideClass(false),
            )}
          >
            <button
              type="button"
              title="Zoom out (minimum 100%)"
              aria-label="Zoom out"
              disabled={zoom <= 1}
              onClick={zoomOut}
              className={cn(
                toolbarSegBtn,
                "w-8",
                false
                  ? "text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
                  : "text-neutral-700 hover:bg-neutral-100 disabled:opacity-40",
              )}
              style={{ color: toolbarColor }}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={`Reset zoom to 100% and center (current: ${Math.round(zoom * 100)}%)`}
              aria-label="Reset zoom"
              onClick={zoomReset}
              className={cn(
                toolbarSegBtn,
                "min-w-[2.75rem] gap-1 px-2 text-xs font-medium tabular-nums",
                false
                  ? "text-neutral-200 hover:bg-neutral-800"
                  : "text-neutral-700 hover:bg-neutral-100",
              )}
              style={{ color: toolbarColor }}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              title="Zoom in (maximum 300%)"
              aria-label="Zoom in"
              disabled={zoom >= 3}
              onClick={zoomIn}
              className={cn(
                toolbarSegBtn,
                "w-8",
                false
                  ? "text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
                  : "text-neutral-700 hover:bg-neutral-100 disabled:opacity-40",
              )}
              style={{ color: toolbarColor }}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={colorPickerRef}
          className={cn(
            "relative",
            toolbarPillClass(colorPickerOpen, false, false),
          )}
        >
          <button
            type="button"
            title="Pen and text colour"
            aria-expanded={colorPickerOpen}
            aria-haspopup="listbox"
            onClick={() => {
              setShapePickerOpen(false);
              setColorPickerOpen((o) => !o);
            }}
            className={cn(
              toolbarSegBtn,
              "gap-1 px-2",
              colorPickerOpen
                ? "bg-violet-600 text-white"
                : "text-neutral-700 hover:bg-neutral-100",
            )}
            style={colorPickerOpen ? undefined : { color: toolbarColor }}
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-black/20 shadow-sm ring-1 ring-black/10 dark:border-white/25 dark:ring-white/15"
              style={{ backgroundColor: penColor }}
              aria-hidden
            />
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          </button>
        </div>

        <div
          className={toolbarPillClass(
            mode === "pan" && zoom > 1,
            false,
          )}
          title={
            zoom <= 1
              ? "Pan available when zoomed in (above 100%)"
              : mode === "pan"
                ? "Pan mode on — drag canvas to move"
                : "Pan mode off — click to turn on when zoomed in"
          }
        >
          <button
            type="button"
            role="switch"
            aria-checked={mode === "pan"}
            aria-disabled={zoom <= 1}
            disabled={zoom <= 1}
            onClick={() => zoom > 1 && setMode((m) => (m === "pan" ? "draw" : "pan"))}
            className={cn(
              toolbarSegBtn,
              "min-w-[2.25rem] px-2",
              mode === "pan" && zoom > 1
                ? "bg-violet-600 text-white"
                : false
                  ? "text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
                  : "text-neutral-700 hover:bg-neutral-100 disabled:opacity-50",
            )}
            style={
              mode === "pan" && zoom > 1 ? undefined : { color: toolbarColor }
            }
            aria-label={zoom <= 1 ? "Pan (zoom in to enable)" : "Pan"}
          >
            <Hand className="h-4 w-4" />
          </button>
        </div>

        <div
          className={toolbarPillClass(
            mode === "draw",
            false,
          )}
        >
          <div
            className={cn(
              "flex h-full min-h-0 flex-1",
              toolbarDivideClass(false),
            )}
          >
            <button
              type="button"
              title="Draw ink"
              aria-pressed={
                mode === "draw" &&
                inkKind === "draw" &&
                drawingTool === "freehand"
              }
              onClick={() => {
                setMode("draw");
                setInkKind("draw");
                setDrawingTool("freehand");
              }}
              className={cn(
                toolbarSegBtn,
                "w-8",
                mode === "draw" &&
                  inkKind === "draw" &&
                  drawingTool === "freehand"
                  ? "bg-violet-600 text-white"
                  : false
                    ? "text-neutral-200 hover:bg-neutral-800"
                    : "text-neutral-700 hover:bg-neutral-100",
              )}
              style={
                mode === "draw" &&
                inkKind === "draw" &&
                drawingTool === "freehand"
                  ? undefined
                  : { color: toolbarColor }
              }
            >
              <Pencil className="h-4 w-4" />
            </button>
            {(["thin", "med", "thick"] as const).map((t) => (
              <button
                key={t}
                type="button"
                title={
                  t === "thin"
                    ? "Thin stroke"
                    : t === "med"
                      ? "Medium stroke"
                      : "Thick stroke"
                }
                onClick={() => {
                  setLineThickness(t);
                  setMode("draw");
                  setInkKind("draw");
                  setDrawingTool("freehand");
                }}
                className={cn(
                  toolbarSegBtn,
                  "w-8",
                  lineThickness === t &&
                    mode === "draw" &&
                    inkKind === "draw" &&
                    drawingTool === "freehand"
                    ? "bg-violet-600 text-white"
                    : false
                      ? "text-neutral-200 hover:bg-neutral-800"
                      : "text-neutral-700 hover:bg-neutral-100",
                )}
                style={
                  lineThickness === t &&
                  mode === "draw" &&
                  inkKind === "draw" &&
                  drawingTool === "freehand"
                    ? undefined
                    : { color: toolbarColor }
                }
              >
                <span
                  className="shrink-0 border-t border-current"
                  style={{
                    width: 20,
                    borderWidth: t === "thin" ? 1.5 : t === "med" ? 2.5 : 4,
                  }}
                />
              </button>
            ))}
            <button
              type="button"
              title="Eraser (local background colour)"
              aria-pressed={mode === "draw" && inkKind === "erase"}
              onClick={() => {
                setMode("draw");
                setInkKind("erase");
              }}
              className={cn(
                toolbarSegBtn,
                "w-8",
                mode === "draw" && inkKind === "erase"
                  ? "bg-violet-600 text-white"
                  : false
                    ? "text-neutral-200 hover:bg-neutral-800"
                    : "text-neutral-700 hover:bg-neutral-100",
              )}
              style={
                mode === "draw" && inkKind === "erase"
                  ? undefined
                  : { color: toolbarColor }
              }
            >
              <Eraser className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={shapePickerRef}
          className={cn(
            "relative",
            toolbarPillClass(
              Boolean(
                shapePickerOpen ||
                  (mode === "draw" &&
                    inkKind === "draw" &&
                    drawingTool !== "freehand"),
              ),
              false,
              false,
            ),
          )}
        >
          <div className="flex h-full min-h-0 flex-1">
            <button
              type="button"
              title="Shapes and lines"
              aria-expanded={shapePickerOpen}
              onClick={() => {
                setColorPickerOpen(false);
                setShapePickerOpen((o) => !o);
              }}
              className={cn(
                toolbarSegBtn,
                "gap-0.5 px-2 text-xs",
                shapePickerOpen ||
                  (mode === "draw" &&
                    inkKind === "draw" &&
                    drawingTool !== "freehand")
                  ? "bg-violet-600 text-white"
                  : false
                    ? "text-neutral-200 hover:bg-neutral-800"
                    : "text-neutral-700 hover:bg-neutral-100",
              )}
              style={
                shapePickerOpen ||
                (mode === "draw" &&
                  inkKind === "draw" &&
                  drawingTool !== "freehand")
                  ? undefined
                  : { color: toolbarColor }
              }
            >
              <Shapes className="h-4 w-4 shrink-0" />
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" />
            </button>
          </div>
        </div>

        {(drawingTool === "polyline" || drawingTool === "polygon") && (
          <div
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-md border px-1.5 shadow-sm",
              false
                ? "border-neutral-600 bg-neutral-900"
                : "border-neutral-300/90 bg-white",
            )}
          >
            <span
              className={`max-w-[140px] truncate px-1 text-[10px] font-medium leading-tight sm:max-w-none sm:text-xs ${false ? "text-neutral-300" : "text-amber-900/90"}`}
            >
              Click to add points (Esc clears)
            </span>
            <button
              type="button"
              title="Commit shape"
              disabled={polyDraftPts.length < 2}
              onClick={() => finishPolyDraft()}
              className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide disabled:opacity-40 sm:text-xs ${false ? "bg-violet-600 text-white hover:bg-violet-500" : "bg-violet-600 text-white hover:bg-violet-700"}`}
            >
              Finish
            </button>
            <button
              type="button"
              title="Remove last point"
              disabled={polyDraftPts.length === 0}
              onClick={() => setPolyDraftPts((p) => p.slice(0, -1))}
              className={`shrink-0 rounded px-2 py-1 text-[10px] font-medium disabled:opacity-40 sm:text-xs ${false ? "text-neutral-200 hover:bg-neutral-700" : "text-amber-900 hover:bg-amber-50"}`}
            >
              Undo pt
            </button>
            <button
              type="button"
              title="Clear all points"
              disabled={polyDraftPts.length === 0}
              onClick={() => setPolyDraftPts([])}
              className={`shrink-0 rounded px-2 py-1 text-[10px] font-medium disabled:opacity-40 sm:text-xs ${false ? "text-neutral-200 hover:bg-neutral-700" : "text-amber-900 hover:bg-amber-50"}`}
            >
              Clear
            </button>
          </div>
        )}

        <div
          className={toolbarPillClass(
            mode === "write",
            false,
          )}
        >
          <div
            className={cn(
              "flex h-full min-h-0 flex-1",
              toolbarDivideClass(false),
            )}
          >
            <button
              type="button"
              title="Text: click on canvas"
              onClick={() => setMode("write")}
              className={cn(
                toolbarSegBtn,
                "w-8",
                mode === "write"
                  ? "bg-violet-600 text-white"
                  : false
                    ? "text-neutral-200 hover:bg-neutral-800"
                    : "text-neutral-700 hover:bg-neutral-100",
              )}
              style={mode === "write" ? undefined : { color: toolbarColor }}
            >
              <Type className="h-4 w-4" />
            </button>
            {(["small", "med", "large"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setTextSize(s);
                  setMode("write");
                }}
                className={cn(
                  toolbarSegBtn,
                  "w-8",
                  textSize === s && mode === "write"
                    ? "bg-violet-600 text-white"
                    : false
                      ? "text-neutral-200 hover:bg-neutral-800"
                      : "text-neutral-700 hover:bg-neutral-100",
                )}
                style={
                  textSize === s && mode === "write"
                    ? undefined
                    : { color: toolbarColor }
                }
                title={
                  s === "small"
                    ? "Small text"
                    : s === "med"
                      ? "Medium text"
                      : "Large text"
                }
              >
                <span
                  className="leading-none"
                  style={{
                    fontSize:
                      s === "small" ? "0.7em" : s === "med" ? "0.85em" : "1em",
                  }}
                >
                  A
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={toolbarPillClass(false, false)}>
          <button
            type="button"
            title={
              canClearForEveryone
                ? "Clear the whiteboard for everyone"
                : "Only the host can clear the board for everyone."
            }
            disabled={!canClearForEveryone}
            onClick={() => void clearAll()}
            className={cn(
              toolbarSegBtn,
              "min-w-[2.25rem] px-2",
              false
                ? "text-neutral-200 hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-40"
                : "text-neutral-700 hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-40",
            )}
            style={{ color: toolbarColor }}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
          </button>
        </div>

        <div className={toolbarPillClass(false, false)}>
          <div
            className={cn(
              "flex h-full min-h-0 flex-1",
              toolbarDivideClass(false),
            )}
          >
            <button
              type="button"
              title="Undo your last stroke"
              onClick={() => void undoOne()}
              className={cn(
                toolbarSegBtn,
                "px-2",
                false
                  ? "text-neutral-200 hover:bg-neutral-800"
                  : "text-neutral-700 hover:bg-neutral-100",
              )}
              style={{ color: toolbarColor }}
              aria-label="Undo"
            >
              <Undo2 className="h-4 w-4 shrink-0" />
            </button>
            <button
              type="button"
              title="Redo is not available on the workshop board (no redo stack yet)."
              disabled
              className={cn(
                toolbarSegBtn,
                "cursor-not-allowed px-2 opacity-35",
                false
                  ? "text-neutral-200 hover:bg-neutral-800"
                  : "text-neutral-700 hover:bg-neutral-100",
              )}
              style={{ color: toolbarColor }}
              aria-label="Redo unavailable"
            >
              <Redo2 className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col items-center bg-[#96a4b4] px-2 py-2 dark:bg-slate-900/90">
        <div
          ref={viewportRef}
          className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-md border border-slate-600/55 bg-slate-100 shadow-inner dark:border-slate-600 dark:bg-slate-950"
          style={{ maxWidth: WHITEBOARD_STAGE_MAX_W }}
        >
          <div style={transformStyle} className="relative h-full w-full">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 block h-full w-full touch-none select-none"
              style={{
                cursor:
                  mode === "pan"
                    ? isPanning
                      ? "grabbing"
                      : "grab"
                    : mode === "write"
                      ? "text"
                      : "crosshair",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUpCanvas}
              onPointerCancel={() => {
                cancelShapeDrag();
                lineBufferRef.current = [];
                flushOverlayRef.current = [];
                flushAwaitRef.current = null;
                schedulePaint();
                endStroke();
              }}
              onPointerLeave={() => {
                if (activeShapeDragRef.current) cancelShapeDrag();
                if (drawingRef.current) endStroke();
              }}
            />
            {inlineTextLayout && textInputAt ? (
              <textarea
                ref={composerTextareaRef}
                aria-label="Whiteboard text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="pointer-events-auto absolute z-20 m-0 min-h-[2.25em] touch-auto resize-none overflow-visible border-0 bg-transparent p-0 shadow-none outline-none ring-0 placeholder:text-slate-400/50"
                style={{
                  left: inlineTextLayout.leftPx,
                  top: inlineTextLayout.topPx,
                  width: inlineTextLayout.widthPx,
                  fontSize: inlineTextLayout.fontPx,
                  lineHeight: 1.2,
                  fontFamily:
                    'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
                  color: penColor,
                  caretColor: penColor,
                }}
                value={textDraft}
                placeholder="Type…"
                onChange={(e) => setTextDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitTextAt(
                      textInputAt.normX,
                      textInputAt.normY,
                      textDraft,
                    );
                    setTextInputAt(null);
                    setTextDraft("");
                    setMode("draw");
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setTextInputAt(null);
                    setTextDraft("");
                  }
                }}
              />
            ) : null}
          </div>
          {convexSaveDepth > 0 ? (
            <div className="pointer-events-none absolute bottom-px right-px z-10">
              <span
                role="status"
                aria-live="polite"
                className={`inline-flex items-center gap-px rounded-sm border px-0.5 py-0 text-[9px] font-medium leading-tight tabular-nums shadow-sm ring-1 ring-black/10 dark:ring-white/10 ${
                  false
                    ? "border-neutral-700 bg-neutral-900/95 text-neutral-200"
                    : "border-slate-400/70 bg-white/95 text-slate-700"
                }`}
              >
                <Loader2
                  className="h-2 w-2 shrink-0 animate-spin opacity-90"
                  aria-hidden
                />
                Syncing…
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {typeof document !== "undefined" &&
      colorPickerOpen &&
      colorMenuFixed
        ? createPortal(
            <div
              ref={colorMenuPortalRef}
              className="fixed z-[10000] flex max-w-[14.5rem] flex-wrap gap-2 rounded-lg border border-border bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
              role="listbox"
              aria-label="Ink colours"
              style={{
                top: colorMenuFixed.top,
                left: colorMenuFixed.left,
              }}
            >
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={c === penColor}
                  title={c}
                  onClick={() => {
                    setPenColorOverride(c);
                    setColorPickerOpen(false);
                  }}
                  className={cn(
                    "h-7 w-7 shrink-0 rounded-full border-2 border-white/90 shadow-sm ring-1 ring-black/20 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-800 dark:ring-white/10",
                    c === penColor &&
                      "ring-2 ring-amber-500 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>,
            document.body,
          )
        : null}
      {typeof document !== "undefined" &&
      shapePickerOpen &&
      shapeMenuFixed
        ? createPortal(
            <div
              ref={shapeMenuPortalRef}
              className="fixed z-[10000] max-h-64 w-56 overflow-y-auto rounded-lg border border-amber-200 bg-white py-1 shadow-lg dark:border-amber-900 dark:bg-neutral-900"
              style={{
                top: shapeMenuFixed.top,
                left: shapeMenuFixed.left,
              }}
            >
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-neutral-800"
                onClick={() => {
                  setDrawingTool("freehand");
                  setMode("draw");
                  setInkKind("draw");
                  setShapePickerOpen(false);
                }}
              >
                Freehand pen
              </button>
              {WORKSHOP_SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-neutral-800 ${drawingTool === s.id ? "bg-amber-100/80 font-medium dark:bg-neutral-800" : ""}`}
                  onClick={() => {
                    setDrawingTool(s.id);
                    setMode("draw");
                    setInkKind("draw");
                    setShapePickerOpen(false);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
