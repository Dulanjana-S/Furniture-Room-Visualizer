import React, { useRef, useEffect, useState } from 'react';
import { FurnitureItem } from '../../types/design';

interface Canvas2DProps {
  roomWidth: number;
  roomHeight: number;
  roomShape?: 'rectangular' | 'square' | 'l-shaped';
  notchWidth?: number;
  notchHeight?: number;
  furniture: FurnitureItem[];
  onFurnitureUpdate: (furniture: FurnitureItem[]) => void;
  onFurnitureCommit?: (furniture: FurnitureItem[]) => void;
  selectedId: string | null;
  onSelectFurniture: (id: string | null) => void;
  wallColor: string;
  floorColor: string;
  globalShadow?: boolean;
  globalShadowIntensity?: number;
  showGrid?: boolean;
  snapToGrid?: boolean;
  gridStep?: number; // meters
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

const SCALE = 110; // pixels per meter (bigger = less whitespace + easier editing)

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHexColor(hex: string) {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
  }
  // Fallback for non-hex colors
  return { r: 120, g: 120, b: 120 };
}

function shade(hex: string, amount: number) {
  const { r, g, b } = parseHexColor(hex);
  const nr = clamp255(r + 255 * amount);
  const ng = clamp255(g + 255 * amount);
  const nb = clamp255(b + 255 * amount);
  return `rgb(${nr}, ${ng}, ${nb})`;
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  // Prefer the modern roundRect API when available.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyCtx: any = ctx as any;
  if (typeof anyCtx.roundRect === 'function') {
    anyCtx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function bestTextColor(bg: string) {
  const { r, g, b } = parseHexColor(bg);
  // perceived luminance
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? '#0B1120' : '#F8FAFC';
}

function roundToStep(n: number, step: number) {
  return Math.round(n / step) * step;
}

function overlapsNotch(
  x: number,
  y: number,
  w: number,
  h: number,
  roomW: number,
  notchW: number,
  notchH: number
) {
  const nx1 = roomW - notchW;
  const ny1 = 0;
  const nx2 = roomW;
  const ny2 = notchH;
  const ix1 = Math.max(x, nx1);
  const iy1 = Math.max(y, ny1);
  const ix2 = Math.min(x + w, nx2);
  const iy2 = Math.min(y + h, ny2);
  return ix2 > ix1 && iy2 > iy1;
}

function resolveNotch(
  x: number,
  y: number,
  w: number,
  h: number,
  roomW: number,
  notchW: number,
  notchH: number
) {
  if (!overlapsNotch(x, y, w, h, roomW, notchW, notchH)) return { x, y };
  // Two simple resolutions: push LEFT of notch or push DOWN below notch.
  const pushLeftX = Math.max(0, roomW - notchW - w);
  const pushDownY = notchH;
  const dx = Math.abs(x - pushLeftX);
  const dy = Math.abs(y - pushDownY);
  if (dx <= dy) return { x: pushLeftX, y };
  return { x, y: pushDownY };
}

function pointInRotatedRect(px: number, py: number, cx: number, cy: number, w: number, h: number, rotationDeg: number) {
  const a = (-rotationDeg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(rx) <= w / 2 && Math.abs(ry) <= h / 2;
}

function rotatedCorners(cx: number, cy: number, w: number, h: number, rotationDeg: number) {
  const a = (rotationDeg * Math.PI) / 180;
  const hw = w / 2;
  const hh = h / 2;
  const pts = [
    [-hw, -hh],
    [ hw, -hh],
    [ hw,  hh],
    [-hw,  hh],
  ] as const;
  return pts.map(([dx, dy]) => {
    const rx = dx * Math.cos(a) - dy * Math.sin(a);
    const ry = dx * Math.sin(a) + dy * Math.cos(a);
    return { x: cx + rx, y: cy + ry };
  });
}

function pointInAARect(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  return px >= x1 && px <= x2 && py >= y1 && py <= y2;
}

function segIntersect(a: {x:number;y:number}, b: {x:number;y:number}, c: {x:number;y:number}, d: {x:number;y:number}) {
  // Robust segment intersection (including collinear overlap)
  const orient = (p: any, q: any, r: any) => {
    const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(v) < 1e-9) return 0;
    return v > 0 ? 1 : 2;
  };
  const onSeg = (p: any, q: any, r: any) =>
    Math.min(p.x, r.x) - 1e-9 <= q.x && q.x <= Math.max(p.x, r.x) + 1e-9 &&
    Math.min(p.y, r.y) - 1e-9 <= q.y && q.y <= Math.max(p.y, r.y) + 1e-9;

  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSeg(a, c, b)) return true;
  if (o2 === 0 && onSeg(a, d, b)) return true;
  if (o3 === 0 && onSeg(c, a, d)) return true;
  if (o4 === 0 && onSeg(c, b, d)) return true;
  return false;
}

function rotatedRectIntersectsAARect(cx: number, cy: number, w: number, h: number, rot: number, rx1: number, ry1: number, rx2: number, ry2: number) {
  const rc = rotatedCorners(cx, cy, w, h, rot);
  const [p0, p1, p2, p3] = rc;
  const rect = [
    { x: rx1, y: ry1 },
    { x: rx2, y: ry1 },
    { x: rx2, y: ry2 },
    { x: rx1, y: ry2 },
  ];

  // 1) Any rotated-rect corner inside axis-aligned rect
  if (rc.some(p => pointInAARect(p.x, p.y, rx1, ry1, rx2, ry2))) return true;

  // 2) Any axis-aligned rect corner inside rotated rectangle
  const w0 = w; const h0 = h;
  if (rect.some(p => pointInRotatedRect(p.x, p.y, cx, cy, w0, h0, rot))) return true;

  // 3) Edge intersections
  const edgesR = [[p0,p1],[p1,p2],[p2,p3],[p3,p0]] as const;
  const edgesA = [[rect[0],rect[1]],[rect[1],rect[2]],[rect[2],rect[3]],[rect[3],rect[0]]] as const;
  for (const [a,b] of edgesR) {
    for (const [c,d] of edgesA) {
      if (segIntersect(a,b,c,d)) return true;
    }
  }
  return false;
}

function clampRotatedToBounds(cx: number, cy: number, w: number, h: number, rot: number, roomW: number, roomH: number) {
  // Keep rotated bounding box within the outer rectangle bounds.
  const corners = rotatedCorners(cx, cy, w, h, rot);
  const minX = Math.min(...corners.map(p => p.x));
  const maxX = Math.max(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y));
  const maxY = Math.max(...corners.map(p => p.y));
  let dx = 0;
  let dy = 0;
  if (minX < 0) dx += -minX;
  if (maxX > roomW) dx += roomW - maxX;
  if (minY < 0) dy += -minY;
  if (maxY > roomH) dy += roomH - maxY;
  return { cx: cx + dx, cy: cy + dy };
}

function clampRotatedOutOfNotch(cx: number, cy: number, w: number, h: number, rot: number, roomW: number, notchW: number, notchH: number) {
  // Notch is top-right: x in [roomW-notchW, roomW] and y in [0, notchH]
  const rx1 = roomW - notchW;
  const ry1 = 0;
  const rx2 = roomW;
  const ry2 = notchH;
  // IMPORTANT: corners-only checks can miss intersections (edge crosses notch).
  const inNotch = rotatedRectIntersectsAARect(cx, cy, w, h, rot, rx1, ry1, rx2, ry2);
  if (!inNotch) return { cx, cy };
  // Push left or down based on which requires less movement (using bounding box)
  const corners = rotatedCorners(cx, cy, w, h, rot);
  const minY = Math.min(...corners.map(p => p.y));
  const maxX = Math.max(...corners.map(p => p.x));
  const pushLeft = maxX - (roomW - notchW) + 0.001;
  const pushDown = notchH - minY + 0.001;
  if (pushLeft <= pushDown) return { cx: cx - pushLeft, cy };
  return { cx, cy: cy + pushDown };
}

export default function Canvas2D({
  roomWidth,
  roomHeight,
  roomShape = 'rectangular',
  notchWidth = 2,
  notchHeight = 2,
  furniture,
  onFurnitureUpdate,
  onFurnitureCommit,
  selectedId,
  onSelectFurniture,
  wallColor,
  floorColor,
  globalShadow = false,
  globalShadowIntensity = 0.5,
  showGrid = true,
  snapToGrid = false,
  gridStep = 0.25,
  onCanvasReady
}: Canvas2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  type Mode = 'idle' | 'drag' | 'resize';
  type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

  const [mode, setMode] = useState<Mode>('idle');
  const [activeHandle, setActiveHandle] = useState<Handle | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const resizeStartRef = useRef<{
    id: string;
    cx: number;
    cy: number;
    w: number;
    h: number;
    rot: number;
    scale: number;
    handle: Handle;
    fixedLocal: { x: number; y: number };
  } | null>(null);
  const furnitureRef = useRef<FurnitureItem[]>(furniture);

  useEffect(() => {
    furnitureRef.current = furniture;
  }, [furniture]);

  useEffect(() => {
    onCanvasReady?.(canvasRef.current);
  }, [onCanvasReady]);

  useEffect(() => {
    draw();
  }, [
    furniture,
    selectedId,
    roomWidth,
    roomHeight,
    roomShape,
    notchWidth,
    notchHeight,
    wallColor,
    floorColor,
    globalShadow,
    globalShadowIntensity,
    showGrid,
    gridStep,
  ]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Build room path (supports L-shape)
    ctx.save();
    ctx.beginPath();
    if (roomShape === 'l-shaped') {
      const nw = Math.min(Math.max(0.5, notchWidth), roomWidth - 0.5);
      const nh = Math.min(Math.max(0.5, notchHeight), roomHeight - 0.5);
      ctx.moveTo(0, 0);
      ctx.lineTo((roomWidth - nw) * SCALE, 0);
      ctx.lineTo((roomWidth - nw) * SCALE, nh * SCALE);
      ctx.lineTo(roomWidth * SCALE, nh * SCALE);
      ctx.lineTo(roomWidth * SCALE, roomHeight * SCALE);
      ctx.lineTo(0, roomHeight * SCALE);
      ctx.closePath();
    } else {
      ctx.rect(0, 0, roomWidth * SCALE, roomHeight * SCALE);
    }

    // Floor fill (map legacy dark default to ash for clearer 2D workspace)
    const effectiveFloorColor = floorColor.toLowerCase() === '#0f172a' ? '#A8B0B7' : floorColor;
    ctx.fillStyle = effectiveFloorColor;
    ctx.fill();

    // Clip for grid lines (keeps grid inside L-shape)
    if (showGrid) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.10)';
      ctx.lineWidth = 1;
      const stepPx = Math.max(0.25, gridStep) * SCALE;
      for (let x = 0; x <= roomWidth * SCALE + 1; x += stepPx) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, roomHeight * SCALE);
        ctx.stroke();
      }
      for (let y = 0; y <= roomHeight * SCALE + 1; y += stepPx) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(roomWidth * SCALE, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Wall outline
    ctx.strokeStyle = wallColor;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    // Draw furniture (rotate only the furniture body; keep labels/handles in screen-space)
    furniture.forEach((item) => {
      const itemW = item.width * item.scale;
      const itemH = item.height * item.scale;
      const xPx = item.x * SCALE;
      const yPx = item.y * SCALE;
      const wPx = itemW * SCALE;
      const hPx = itemH * SCALE;
      const centerX = xPx + wPx / 2;
      const centerY = yPx + hPx / 2;
      const rotationRad = (item.rotation * Math.PI) / 180;
      const isSelected = selectedId === item.id;

      // 1) Furniture body (rotated)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationRad);
      ctx.translate(-centerX, -centerY);

      // Shadow (individual or global)
      const itemShadow = item.shadow ?? false;
      const itemShadowIntensity = item.shadowIntensity ?? 0.5;
      const shadowEnabled = itemShadow || globalShadow;
      const shadowIntensity = itemShadow ? itemShadowIntensity : globalShadowIntensity;

      if (shadowEnabled) {
        ctx.shadowColor = `rgba(0, 0, 0, ${shadowIntensity})`;
        ctx.shadowBlur = 18 * shadowIntensity;
        ctx.shadowOffsetX = 6 * shadowIntensity;
        ctx.shadowOffsetY = 6 * shadowIntensity;
      }

      // Subtle gradient fill for depth
      const grad = ctx.createLinearGradient(xPx, yPx, xPx + wPx, yPx + hPx);
      grad.addColorStop(0, shade(item.color, 0.08));
      grad.addColorStop(1, shade(item.color, -0.10));
      ctx.fillStyle = grad;

      const radius = Math.min(18, wPx * 0.14, hPx * 0.14);
      roundedRectPath(ctx, xPx, yPx, wPx, hPx, radius);
      ctx.fill();

      // Reset shadow for strokes/details
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Border
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.strokeStyle = isSelected ? '#3b82f6' : 'rgba(15, 23, 42, 0.55)';
      roundedRectPath(ctx, xPx, yPx, wPx, hPx, radius);
      ctx.stroke();

      // Inner highlight
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
      roundedRectPath(ctx, xPx + 1, yPx + 1, wPx - 2, hPx - 2, Math.max(0, radius - 1));
      ctx.stroke();

      // Type-specific top-down details (still rotated with the item)
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';

      const inset = Math.min(10, Math.min(wPx, hPx) * 0.18);
      if (item.type === 'sofa') {
        // Cushion lines
        const cols = wPx > 140 ? 3 : 2;
        for (let i = 1; i < cols; i++) {
          const x = xPx + (wPx * i) / cols;
          ctx.beginPath();
          ctx.moveTo(x, yPx + inset);
          ctx.lineTo(x, yPx + hPx - inset);
          ctx.stroke();
        }
        // Back line
        ctx.beginPath();
        ctx.moveTo(xPx + inset, yPx + inset);
        ctx.lineTo(xPx + wPx - inset, yPx + inset);
        ctx.stroke();
        // Arm hints
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.moveTo(xPx + inset, yPx + inset);
        ctx.lineTo(xPx + inset, yPx + hPx - inset);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(xPx + wPx - inset, yPx + inset);
        ctx.lineTo(xPx + wPx - inset, yPx + hPx - inset);
        ctx.stroke();
      } else if (item.type === 'bed') {
        // Pillows
        ctx.globalAlpha = 0.18;
        const pw = (wPx - inset * 3) / 2;
        const ph = Math.min(26, hPx * 0.22);
        roundedRectPath(ctx, xPx + inset, yPx + inset, pw, ph, 8);
        ctx.stroke();
        roundedRectPath(ctx, xPx + inset * 2 + pw, yPx + inset, pw, ph, 8);
        ctx.stroke();
        // Mattress seam
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(xPx + wPx / 2, yPx + inset);
        ctx.lineTo(xPx + wPx / 2, yPx + hPx - inset);
        ctx.stroke();
      } else if (item.type.includes('table') || item.type === 'desk' || item.type === 'tv-stand') {
        // Table inset
        ctx.globalAlpha = 0.20;
        roundedRectPath(ctx, xPx + inset, yPx + inset, wPx - inset * 2, hPx - inset * 2, Math.max(6, radius - 6));
        ctx.stroke();
        if (item.type === 'desk') {
          ctx.globalAlpha = 0.22;
          const drawerY = yPx + hPx * 0.32;
          ctx.beginPath();
          ctx.moveTo(xPx + inset, drawerY);
          ctx.lineTo(xPx + wPx - inset, drawerY);
          ctx.stroke();
          const knobY = drawerY + 6;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
          ctx.beginPath();
          ctx.arc(xPx + wPx * 0.35, knobY, 2, 0, Math.PI * 2);
          ctx.arc(xPx + wPx * 0.65, knobY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (item.type === 'tv-stand') {
          ctx.globalAlpha = 0.2;
          const split1 = xPx + wPx / 3;
          const split2 = xPx + (wPx * 2) / 3;
          ctx.beginPath();
          ctx.moveTo(split1, yPx + inset);
          ctx.lineTo(split1, yPx + hPx - inset);
          ctx.moveTo(split2, yPx + inset);
          ctx.lineTo(split2, yPx + hPx - inset);
          ctx.stroke();
        }
      } else if (item.type === 'wardrobe' || item.type === 'cabinet' || item.type === 'bookshelf') {
        if (item.type === 'bookshelf') {
          ctx.globalAlpha = 0.2;
          const shelfCount = 4;
          for (let i = 1; i <= shelfCount; i++) {
            const y = yPx + (hPx / (shelfCount + 1)) * i;
            ctx.beginPath();
            ctx.moveTo(xPx + inset, y);
            ctx.lineTo(xPx + wPx - inset, y);
            ctx.stroke();
          }
        } else {
          // Door split
          ctx.globalAlpha = 0.20;
          ctx.beginPath();
          ctx.moveTo(xPx + wPx / 2, yPx + inset);
          ctx.lineTo(xPx + wPx / 2, yPx + hPx - inset);
          ctx.stroke();
        }
      } else if (item.type === 'chair') {
        // Seat + back hint
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(xPx + inset, yPx + hPx * 0.35);
        ctx.lineTo(xPx + wPx - inset, yPx + hPx * 0.35);
        ctx.stroke();
        ctx.globalAlpha = 0.17;
        ctx.beginPath();
        ctx.arc(xPx + inset, yPx + hPx - inset, 2, 0, Math.PI * 2);
        ctx.arc(xPx + wPx - inset, yPx + hPx - inset, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fill();
      }
      ctx.restore();

      ctx.restore();

      // 2) Handles + label (NOT rotated) — fixes handle/label misalignment
      if (isSelected) {
        const handles = getHandlePositions(item);
        const size = 10;
        Object.values(handles).forEach((p) => {
          const px = p.x * SCALE;
          const py = p.y * SCALE;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.rect(px - size / 2, py - size / 2, size, size);
          ctx.fill();
          ctx.stroke();
        });
      }

      ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = bestTextColor(item.color);
      if (isSelected) {
        ctx.fillText(item.name, centerX, centerY - 7);
        ctx.font = '11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        const dims = `${(item.width * item.scale).toFixed(2)}×${(item.height * item.scale).toFixed(2)}m`;
        ctx.fillText(dims, centerX, centerY + 8);
      } else {
        ctx.fillText(item.name, centerX, centerY);
      }
    });
  }

  function getHandlePositions(item: FurnitureItem) {
    const w = item.width * item.scale;
    const h = item.height * item.scale;
    const cx = item.x + w / 2;
    const cy = item.y + h / 2;
    const corners = rotatedCorners(cx, cy, w, h, item.rotation);
    const [nw, ne, se, sw] = corners;
    const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    return {
      nw,
      n: mid(nw, ne),
      ne,
      e: mid(ne, se),
      se,
      s: mid(sw, se),
      sw,
      w: mid(nw, sw),
    } as const;
  }

  function getMousePosPx(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Account for CSS scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handleAtPointerPx(px: number, py: number, item: FurnitureItem): Handle | null {
    const handles = getHandlePositions(item);
    const hit = 10; // px
    for (const [k, p] of Object.entries(handles)) {
      const hx = p.x * SCALE;
      const hy = p.y * SCALE;
      if (Math.abs(px - hx) <= hit && Math.abs(py - hy) <= hit) return k as Handle;
    }
    return null;
  }

  function cursorForHandle(h: Handle | null) {
    if (!h) return null;
    if (h === 'n' || h === 's') return 'ns-resize';
    if (h === 'e' || h === 'w') return 'ew-resize';
    if (h === 'nw' || h === 'se') return 'nwse-resize';
    if (h === 'ne' || h === 'sw') return 'nesw-resize';
    return null;
  }

  function getMousePos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    // Account for CSS scaling (responsive canvas)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: ((e.clientX - rect.left) * scaleX) / SCALE,
      y: ((e.clientY - rect.top) * scaleY) / SCALE
    };
  }

  function findFurnitureAtPos(x: number, y: number): FurnitureItem | null {
    for (let i = furniture.length - 1; i >= 0; i--) {
      const item = furniture[i];
      const w = item.width * item.scale;
      const h = item.height * item.scale;
      const cx = item.x + w / 2;
      const cy = item.y + h / 2;
      if (pointInRotatedRect(x, y, cx, cy, w, h, item.rotation)) return item;
    }
    return null;
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getMousePos(e);
    const item = findFurnitureAtPos(pos.x, pos.y);

    // If clicking a resize handle of the currently selected item, start resize.
    if (item && selectedId === item.id) {
      const ppx = getMousePosPx(e);
      const h = handleAtPointerPx(ppx.x, ppx.y, item);
      if (h) {
        const w0 = item.width * item.scale;
        const h0 = item.height * item.scale;
        const cx0 = item.x + w0 / 2;
        const cy0 = item.y + h0 / 2;

        // Opposite fixed point in LOCAL coords (relative to center)
        const fx = (h === 'nw' || h === 'w' || h === 'sw') ? (w0 / 2) : (h === 'ne' || h === 'e' || h === 'se') ? (-w0 / 2) : 0;
        const fy = (h === 'nw' || h === 'n' || h === 'ne') ? (h0 / 2) : (h === 'sw' || h === 's' || h === 'se') ? (-h0 / 2) : 0;

        resizeStartRef.current = {
          id: item.id,
          cx: cx0,
          cy: cy0,
          w: w0,
          h: h0,
          rot: item.rotation,
          scale: item.scale,
          handle: h,
          fixedLocal: { x: fx, y: fy },
        };
        setMode('resize');
        setActiveHandle(h);
        setIsDragging(false);
        return;
      }
    }

    if (item) {
      onSelectFurniture(item.id);
      setMode('drag');
      setIsDragging(true);
      const w = item.width * item.scale;
      const h = item.height * item.scale;
      const cx = item.x + w / 2;
      const cy = item.y + h / 2;
      setDragOffset({
        x: pos.x - cx,
        y: pos.y - cy
      });
    } else {
      onSelectFurniture(null);
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cursor feedback when idle
    if (mode === 'idle') {
      const posM = getMousePos(e);
      const hovered = findFurnitureAtPos(posM.x, posM.y);
      let cur: string = hovered ? 'move' : 'crosshair';
      if (selectedId) {
        const sel = furniture.find(f => f.id === selectedId);
        if (sel) {
          const ppx = getMousePosPx(e);
          const h = handleAtPointerPx(ppx.x, ppx.y, sel);
          cur = cursorForHandle(h) || (hovered ? 'move' : 'crosshair');
        }
      }
      canvas.style.cursor = cur;
    }

    if (mode === 'resize') {
      const start = resizeStartRef.current;
      if (!start) return;
      const pos = getMousePos(e);

      const minSize = 0.25; // meters
      const a = (start.rot * Math.PI) / 180;
      const dx = pos.x - start.cx;
      const dy = pos.y - start.cy;
      // Convert mouse to LOCAL coords (relative to old center)
      const mx = dx * Math.cos(a) + dy * Math.sin(a);
      const my = -dx * Math.sin(a) + dy * Math.cos(a);

      let hx = mx;
      let hy = my;

      // Constrain edge handles
      if (start.handle === 'n' || start.handle === 's') hx = 0;
      if (start.handle === 'e' || start.handle === 'w') hy = 0;

      const fx = start.fixedLocal.x;
      const fy = start.fixedLocal.y;
      const isLeft = start.handle === 'nw' || start.handle === 'w' || start.handle === 'sw';
      const isRight = start.handle === 'ne' || start.handle === 'e' || start.handle === 'se';
      const isTop = start.handle === 'nw' || start.handle === 'n' || start.handle === 'ne';
      const isBottom = start.handle === 'sw' || start.handle === 's' || start.handle === 'se';
      if (isLeft) hx = Math.min(hx, fx - minSize);
      if (isRight) hx = Math.max(hx, fx + minSize);
      if (isTop) hy = Math.min(hy, fy - minSize);
      if (isBottom) hy = Math.max(hy, fy + minSize);

      let newW = start.w;
      let newH = start.h;
      if (start.handle === 'e' || start.handle === 'w') {
        newW = Math.abs(hx - fx);
      } else if (start.handle === 'n' || start.handle === 's') {
        newH = Math.abs(hy - fy);
      } else {
        newW = Math.abs(hx - fx);
        newH = Math.abs(hy - fy);
      }
      newW = Math.max(minSize, newW);
      newH = Math.max(minSize, newH);

      if (snapToGrid) {
        const step = Math.max(0.1, gridStep);
        newW = roundToStep(newW, step);
        newH = roundToStep(newH, step);
      }

      // New center in LOCAL space = midpoint between fixed and dragged
      const cxLocal = (fx + hx) / 2;
      const cyLocal = (fy + hy) / 2;

      // Convert center shift to WORLD
      const shiftX = cxLocal * Math.cos(a) - cyLocal * Math.sin(a);
      const shiftY = cxLocal * Math.sin(a) + cyLocal * Math.cos(a);
      let cx = start.cx + shiftX;
      let cy = start.cy + shiftY;

      ({ cx, cy } = clampRotatedToBounds(cx, cy, newW, newH, start.rot, roomWidth, roomHeight));
      if (roomShape === 'l-shaped') {
        const nw = Math.min(Math.max(0.5, notchWidth), roomWidth - 0.5);
        const nh = Math.min(Math.max(0.5, notchHeight), roomHeight - 0.5);
        ({ cx, cy } = clampRotatedOutOfNotch(cx, cy, newW, newH, start.rot, roomWidth, nw, nh));
        ({ cx, cy } = clampRotatedToBounds(cx, cy, newW, newH, start.rot, roomWidth, roomHeight));
      }

      let x = cx - newW / 2;
      let y = cy - newH / 2;
      if (snapToGrid) {
        const step = Math.max(0.1, gridStep);
        x = roundToStep(x, step);
        y = roundToStep(y, step);
        cx = x + newW / 2;
        cy = y + newH / 2;
        ({ cx, cy } = clampRotatedToBounds(cx, cy, newW, newH, start.rot, roomWidth, roomHeight));
        x = cx - newW / 2;
        y = cy - newH / 2;
      }

      const updatedFurniture = furniture.map((it) => {
        if (it.id !== start.id) return it;
        return {
          ...it,
          x,
          y,
          width: newW / Math.max(0.01, start.scale),
          height: newH / Math.max(0.01, start.scale),
        };
      });
      furnitureRef.current = updatedFurniture;
      onFurnitureUpdate(updatedFurniture);
      return;
    }

    if (!isDragging || !selectedId) return;

    const pos = getMousePos(e);
    const updatedFurniture = furniture.map(item => {
      if (item.id === selectedId) {
        const w = item.width * item.scale;
        const h = item.height * item.scale;

        // Drag using the item's CENTER for stable behavior even when rotated.
        let cx = pos.x - dragOffset.x;
        let cy = pos.y - dragOffset.y;

        // Snap: snap the top-left to grid for predictable placement.
        if (snapToGrid) {
          const step = Math.max(0.1, gridStep);
          let newX = roundToStep(cx - w / 2, step);
          let newY = roundToStep(cy - h / 2, step);
          cx = newX + w / 2;
          cy = newY + h / 2;
        }

        // Keep rotated bounding box within room rectangle bounds.
        ({ cx, cy } = clampRotatedToBounds(cx, cy, w, h, item.rotation, roomWidth, roomHeight));

        // If L-shape, prevent overlap into the notch (top-right cut-out)
        if (roomShape === 'l-shaped') {
          const nw = Math.min(Math.max(0.5, notchWidth), roomWidth - 0.5);
          const nh = Math.min(Math.max(0.5, notchHeight), roomHeight - 0.5);
          ({ cx, cy } = clampRotatedOutOfNotch(cx, cy, w, h, item.rotation, roomWidth, nw, nh));
          ({ cx, cy } = clampRotatedToBounds(cx, cy, w, h, item.rotation, roomWidth, roomHeight));
        }

        const newX = cx - w / 2;
        const newY = cy - h / 2;
        return { ...item, x: newX, y: newY };
      }
      return item;
    });
    furnitureRef.current = updatedFurniture;
    onFurnitureUpdate(updatedFurniture);
  }

  function handleMouseUp() {
    if (mode === 'resize' || isDragging) {
      onFurnitureCommit?.(furnitureRef.current);
    }
    setIsDragging(false);
    setMode('idle');
    setActiveHandle(null);
    resizeStartRef.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={roomWidth * SCALE}
      height={roomHeight * SCALE}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="border border-gray-300 rounded-lg bg-white shadow-lg cursor-crosshair"
      style={{ maxWidth: '100%', height: 'auto' }}
      role="img"
      aria-label={`2D room design canvas showing ${roomWidth}m by ${roomHeight}m room with ${furniture.length} furniture items`}
      tabIndex={0}
    />
  );
}