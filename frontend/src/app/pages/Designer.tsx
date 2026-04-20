import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api, authHeaders } from '../../lib/api';
import { Design, FurnitureItem, RoomSpec } from '../../types/design';
import Canvas2D from '../components/Canvas2D';
import Canvas3D from '../components/Canvas3DWrapper';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Loader2,
  Undo,
  Redo,
  Armchair,
  Sofa as SofaIcon,
  Bed as BedIcon,
  Box,
  Table2,
  Circle,
  Download,
  Maximize2,
  Grid3X3,
  Magnet,
  Layers,
  Ruler,
  Sun,
  Moon
} from 'lucide-react';
import { toast } from 'sonner';

const FURNITURE_TEMPLATES = [
  { type: 'chair' as const, name: 'Chair', width: 0.6, height: 0.6, color: '#8B4513', icon: Armchair },
  { type: 'dining-table' as const, name: 'Dining Table', width: 2.0, height: 1.0, color: '#654321', icon: Table2 },
  { type: 'side-table' as const, name: 'Side Table', width: 0.5, height: 0.5, color: '#DEB887', icon: Circle },
  { type: 'coffee-table' as const, name: 'Coffee Table', width: 1.1, height: 0.6, color: '#CBAA7A', icon: Circle },
  { type: 'desk' as const, name: 'Desk', width: 1.5, height: 0.7, color: '#6B4E3D', icon: Table2 },
  { type: 'sofa' as const, name: 'Sofa', width: 2.2, height: 0.9, color: '#4A5568', icon: SofaIcon },
  { type: 'bed' as const, name: 'Bed', width: 2.0, height: 1.8, color: '#F3F4F6', icon: BedIcon },
  { type: 'cabinet' as const, name: 'Cabinet', width: 1.0, height: 0.5, color: '#8B7355', icon: Box },
  { type: 'wardrobe' as const, name: 'Wardrobe', width: 1.2, height: 0.6, color: '#CBD5E1', icon: Layers },
  { type: 'bookshelf' as const, name: 'Bookshelf', width: 1.0, height: 0.35, color: '#8C735B', icon: Layers },
  { type: 'tv-stand' as const, name: 'TV Stand', width: 1.6, height: 0.45, color: '#3A3F4B', icon: Box },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// --- Rotation-aware clamp helpers (keeps furniture inside room + out of L-shape notch) ---
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

  if (rc.some(p => pointInAARect(p.x, p.y, rx1, ry1, rx2, ry2))) return true;
  if (rect.some(p => pointInRotatedRect(p.x, p.y, cx, cy, w, h, rot))) return true;

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
  const rx1 = roomW - notchW;
  const ry1 = 0;
  const rx2 = roomW;
  const ry2 = notchH;
  const hit = rotatedRectIntersectsAARect(cx, cy, w, h, rot, rx1, ry1, rx2, ry2);
  if (!hit) return { cx, cy };

  const corners = rotatedCorners(cx, cy, w, h, rot);
  const minY = Math.min(...corners.map(p => p.y));
  const maxX = Math.max(...corners.map(p => p.x));
  const pushLeft = maxX - (roomW - notchW) + 0.001;
  const pushDown = notchH - minY + 0.001;
  if (pushLeft <= pushDown) return { cx: cx - pushLeft, cy };
  return { cx, cy: cy + pushDown };
}

function clampFurnitureToRoom(items: FurnitureItem[], room: RoomSpec) {
  return items.map((it) => {
    const w = it.width * it.scale;
    const h = it.height * it.scale;
    const rot = it.rotation || 0;
    let cx = it.x + w / 2;
    let cy = it.y + h / 2;

    ({ cx, cy } = clampRotatedToBounds(cx, cy, w, h, rot, room.width, room.height));

    if (room.shape === 'l-shaped') {
      const nw = clamp(room.notchWidth ?? 2, 0.5, room.width - 0.5);
      const nh = clamp(room.notchHeight ?? 2, 0.5, room.height - 0.5);
      ({ cx, cy } = clampRotatedOutOfNotch(cx, cy, w, h, rot, room.width, nw, nh));
      ({ cx, cy } = clampRotatedToBounds(cx, cy, w, h, rot, room.width, room.height));
    }

    return { ...it, x: cx - w / 2, y: cy - h / 2 };
  });
}

// --- Undo/Redo history ---
type HistState = { items: FurnitureItem[]; stack: FurnitureItem[][]; idx: number };

type HistAction =
  | { type: 'RESET'; items: FurnitureItem[] }
  | { type: 'SET'; items: FurnitureItem[] }
  | { type: 'COMMIT'; items: FurnitureItem[] }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function histReducer(state: HistState, action: HistAction): HistState {
  const LIMIT = 60;
  switch (action.type) {
    case 'RESET': {
      const items = action.items;
      return { items, stack: [items], idx: 0 };
    }
    case 'SET':
      return { ...state, items: action.items };
    case 'COMMIT': {
      const base = state.stack.slice(0, state.idx + 1);
      base.push(action.items);
      const stack = base.length > LIMIT ? base.slice(base.length - LIMIT) : base;
      const idx = stack.length - 1;
      return { items: action.items, stack, idx };
    }
    case 'UNDO': {
      const idx = Math.max(0, state.idx - 1);
      return { ...state, idx, items: state.stack[idx] || [] };
    }
    case 'REDO': {
      const idx = Math.min(state.stack.length - 1, state.idx + 1);
      return { ...state, idx, items: state.stack[idx] || state.items };
    }
    default:
      return state;
  }
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function Designer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, token } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presentation, setPresentation] = useState(false);

  const [designName, setDesignName] = useState('Untitled Design');
  const [designNotes, setDesignNotes] = useState('');
  const [roomSpec, setRoomSpec] = useState<RoomSpec>({
    width: 6,
    height: 6,
    shape: 'rectangular',
    notchWidth: 2,
    notchHeight: 2,
    wallColor: '#B2BEB5',
    floorColor: '#A8B0B7',
    globalShadow: true,
    globalShadowIntensity: 0.3,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  // Grid/Snap
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridStep, setGridStep] = useState(0.25); // meters

  const [hist, dispatchHist] = useReducer(histReducer, { items: [], stack: [[]], idx: 0 });
  const furniture = hist.items;

  // Unsaved changes (baseline snapshot)
  const baselineRef = useRef<string>('');
  const readyDirtyRef = useRef(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const export2DCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const export3DRef = useRef<(() => string) | null>(null);

  const selectedItem = useMemo(() => furniture.find(f => f.id === selectedId) || null, [furniture, selectedId]);

  const snapshot = useCallback((name = designName, notes = designNotes, room = roomSpec, items = furniture) => {
    return JSON.stringify({ name, notes, room, items });
  }, [designName, designNotes, roomSpec, furniture]);

  const setBaseline = useCallback((name = designName, notes = designNotes, room = roomSpec, items = furniture) => {
    baselineRef.current = JSON.stringify({ name, notes, room, items });
    setHasUnsavedChanges(false);
    readyDirtyRef.current = true;
  }, [designName, designNotes, roomSpec, furniture]);

  useEffect(() => {
    if (!readyDirtyRef.current) return;
    setHasUnsavedChanges(snapshot() !== baselineRef.current);
  }, [snapshot]);

  // Warn before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatchHist({ type: 'UNDO' });
        toast.success('Undone');
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatchHist({ type: 'REDO' });
        toast.success('Redone');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        const next = furniture.filter(i => i.id !== selectedId);
        dispatchHist({ type: 'COMMIT', items: next });
        setSelectedId(null);
      } else if (e.key === 'F11') {
        // keep browser fullscreen behavior; we still provide a presentation toggle
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [furniture, selectedId]);

  // Load design
  useEffect(() => {
    async function loadDesign() {
      if (!currentUser) {
        navigate('/');
        return;
      }

      if (id === 'new') {
        const freshItems: FurnitureItem[] = [];
        dispatchHist({ type: 'RESET', items: freshItems });
        setDesignName('Untitled Design');
        setDesignNotes('');
        setRoomSpec((r) => ({ ...r }));
        setSelectedId(null);
        setViewMode('2d');
        setBaseline('Untitled Design', '', roomSpec, freshItems);
        setLoading(false);
        return;
      }

      try {
        const data = await api<{ design: Design }>(`/api/designs/${id}`, {
          headers: authHeaders(token),
        });
        const d = data.design;
        setDesignName(d.name);
        setDesignNotes(d.notes ?? '');
        setRoomSpec({
          ...d.roomSpec,
          notchWidth: d.roomSpec.notchWidth ?? 2,
          notchHeight: d.roomSpec.notchHeight ?? 2,
        });
        dispatchHist({ type: 'RESET', items: d.furniture || [] });
        setSelectedId(null);
        setViewMode('2d');
        setBaseline(d.name, d.notes ?? '', d.roomSpec, d.furniture || []);
      } catch (e: any) {
        toast.error(e?.error || 'Failed to load design');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    }

    loadDesign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentUser]);

  // When room spec changes, clamp furniture back inside (error prevention)
  useEffect(() => {
    const clamped = clampFurnitureToRoom(furniture, roomSpec);
    if (JSON.stringify(clamped) !== JSON.stringify(furniture)) {
      dispatchHist({ type: 'SET', items: clamped });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomSpec.width, roomSpec.height, roomSpec.shape, roomSpec.notchWidth, roomSpec.notchHeight]);

  async function handleSave() {
    if (!currentUser) return;

    try {
      setSaving(true);
      const payload = { name: designName, notes: designNotes, roomSpec, furniture };

      if (id === 'new') {
        const data = await api<{ design: Design }>('/api/designs', {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(payload),
        });
        toast.success('Design created successfully!');
        navigate(`/designer/${data.design.id}`);
        setBaseline(designName, designNotes, roomSpec, furniture);
      } else {
        await api<{ design: Design }>(`/api/designs/${id}`, {
          method: 'PUT',
          headers: authHeaders(token),
          body: JSON.stringify(payload),
        });
        toast.success('Design saved successfully!');
        setBaseline(designName, designNotes, roomSpec, furniture);
      }
    } catch (e: any) {
      toast.error(e?.error || 'Failed to save design');
    } finally {
      setSaving(false);
    }
  }

  function addFurniture(template: typeof FURNITURE_TEMPLATES[number]) {
    const item: FurnitureItem = {
      id: `${template.type}-${Date.now()}`,
      type: template.type,
      name: template.name,
      x: Math.max(0, roomSpec.width / 2 - template.width / 2),
      y: Math.max(0, roomSpec.height / 2 - template.height / 2),
      width: template.width,
      height: template.height,
      rotation: 0,
      color: template.color,
      scale: 1,
      shadow: false,
      shadowIntensity: 0.5,
      zHeight: undefined,
    };
    const next = clampFurnitureToRoom([...furniture, item], roomSpec);
    dispatchHist({ type: 'COMMIT', items: next });
    setSelectedId(item.id);
    toast.success(`${template.name} added`);
  }

  function updateSelected(updates: Partial<FurnitureItem>, commit = true) {
    if (!selectedItem) return;
    const next = furniture.map(f => f.id === selectedItem.id ? { ...f, ...updates } : f);
    const clamped = clampFurnitureToRoom(next, roomSpec);
    dispatchHist({ type: commit ? 'COMMIT' : 'SET', items: clamped });
  }

  function applyToAll(updates: Partial<FurnitureItem>) {
    const next = furniture.map(f => ({ ...f, ...updates }));
    dispatchHist({ type: 'COMMIT', items: clampFurnitureToRoom(next, roomSpec) });
    toast.success('Applied to all items');
  }

  const [applyAllColor, setApplyAllColor] = useState('#3B82F6');

  function handleExport() {
    const base = (designName || 'design').replace(/[^a-z0-9_-]+/gi, '_');

    if (viewMode === '2d') {
      const c = export2DCanvasRef.current;
      if (!c) return toast.error('2D export not ready');
      downloadDataUrl(`${base}-2D.png`, c.toDataURL('image/png'));
      toast.success('Exported 2D snapshot');
    } else {
      const fn = export3DRef.current;
      if (!fn) return toast.error('3D export not ready');
      downloadDataUrl(`${base}-3D.png`, fn());
      toast.success('Exported 3D snapshot');
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0B1120]">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`designer-shell h-screen w-screen overflow-hidden text-slate-300 flex flex-col font-sans ${theme === 'light' ? 'light-page' : ''}`}>
      {/* Top App Bar */}
      <header className="designer-toolbar h-14 border-b border-slate-800/90 flex items-center justify-between px-4 shrink-0">
        {/* Left: Back + Project Name */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 -ml-2"
            title="Back to dashboard"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Input
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            className="bg-slate-800/90 border-slate-700 text-slate-100 h-9 w-64 focus-visible:ring-blue-500 focus-visible:ring-1"
            placeholder="Design name"
          />
        </div>

        {/* Center: Unsaved indicator */}
        <div className="flex-1 flex justify-center">
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-500 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 p-1 shadow-lg backdrop-blur mr-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPresentation((p) => !p)}
            className="size-9 text-slate-300 hover:bg-slate-800/80 hover:text-white"
            title="Presentation mode"
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExport}
            className="size-9 text-slate-300 hover:bg-slate-800/80 hover:text-white"
            title="Export PNG of current view"
          >
            <Download className="size-4" />
          </Button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-700/70 bg-slate-800/55 p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="text-slate-300 hover:text-white hover:bg-slate-700"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="size-4" strokeWidth={2.6} /> : <Moon className="size-4" strokeWidth={2.6} />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatchHist({ type: 'UNDO' })}
              disabled={hist.idx <= 0}
              className="text-slate-300 hover:text-white hover:bg-slate-700 disabled:text-slate-500 disabled:opacity-60"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="size-4" strokeWidth={2.6} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatchHist({ type: 'REDO' })}
              disabled={hist.idx >= hist.stack.length - 1}
              className="text-slate-300 hover:text-white hover:bg-slate-700 disabled:text-slate-500 disabled:opacity-60"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="size-4" strokeWidth={2.6} />
            </Button>
          </div>
          <div className="w-px h-5 bg-slate-800 mx-1" />
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 text-white h-9 px-4 font-medium transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Saving
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Tool Panel */}
        {!presentation && (
          <aside className="designer-panel w-72 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/80">
              <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
                <Plus className="size-4" /> Add Furniture
              </h2>
            </div>

            <div className="px-4 py-3 border-b border-slate-800/80 space-y-3 bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Grid3X3 className="size-4" /> Grid
                </div>
                <Switch checked={showGrid} onCheckedChange={setShowGrid} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Magnet className="size-4" /> Snap
                </div>
                <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Ruler className="size-4" /> Grid step
                  </div>
                  <span className="text-xs text-slate-500">{gridStep.toFixed(2)}m</span>
                </div>
                <Slider value={[gridStep]} onValueChange={([v]) => setGridStep(v)} min={0.1} max={1} step={0.05} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {FURNITURE_TEMPLATES.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.type}
                    onClick={() => addFurniture(template)}
                    className="group mx-2 my-1.5 flex items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-sm w-[calc(100%-1rem)] text-left transition-all hover:border-slate-600 hover:bg-slate-800/75"
                  >
                    <div className="flex size-8 items-center justify-center rounded-md border border-slate-700 bg-slate-800/70">
                      <Icon className="size-4.5 text-slate-400 shrink-0" />
                    </div>
                    <span className="text-slate-300">{template.name}</span>
                    <Plus className="size-4 ml-auto text-slate-600 transition-colors group-hover:text-slate-300" />
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* Center Panel - Canvas */}
        <main className="flex-1 relative bg-[#0F172A] overflow-hidden">
          {/* Floating Controls - Top Center (2D/3D Toggle) */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-xl border border-slate-700/80 bg-slate-900/85 p-1 flex gap-1 shadow-xl backdrop-blur z-10">
            <button
              onClick={() => setViewMode('2d')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === '2d'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
              }`}
            >
              2D View
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === '3d'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
              }`}
            >
              3D View
            </button>
          </div>

          {/* Canvas Engine */}
          <div className="h-full w-full p-4">
            <div className="designer-canvas-shell h-full w-full overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/35">
            {viewMode === '2d' ? (
              <Canvas2D
                roomWidth={roomSpec.width}
                roomHeight={roomSpec.height}
                roomShape={roomSpec.shape}
                notchWidth={roomSpec.notchWidth}
                notchHeight={roomSpec.notchHeight}
                furniture={furniture}
                onFurnitureUpdate={(items) => dispatchHist({ type: 'SET', items })}
                onFurnitureCommit={(items) => dispatchHist({ type: 'COMMIT', items })}
                selectedId={selectedId}
                onSelectFurniture={setSelectedId}
                wallColor={roomSpec.wallColor}
                floorColor={roomSpec.floorColor}
                globalShadow={roomSpec.globalShadow}
                globalShadowIntensity={roomSpec.globalShadowIntensity}
                showGrid={showGrid}
                snapToGrid={snapToGrid}
                gridStep={gridStep}
                onCanvasReady={(c) => (export2DCanvasRef.current = c)}
              />
            ) : (
              <Canvas3D
                roomSpec={roomSpec}
                furniture={furniture}
                selectedId={selectedId}
                onExportReady={(fn) => (export3DRef.current = fn)}
              />
            )}
            </div>
          </div>
        </main>

        {/* Right Panel - Properties Inspector */}
        {!presentation && (
          <aside className="designer-panel w-80 border-l border-slate-700 flex flex-col shrink-0 overflow-hidden">
            <div className="p-4 border-b border-slate-700/90 bg-slate-800/80">
              <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                {selectedItem ? `${selectedItem.name} Properties` : 'Room Specifications'}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
              {selectedItem ? (
                <>
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-slate-400">Color</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full h-10 rounded-md border border-slate-700 hover:border-slate-600 transition-colors flex items-center gap-3 px-3">
                          <div className="size-6 rounded border border-slate-600" style={{ backgroundColor: selectedItem.color }} />
                          <span className="text-sm text-slate-300">{selectedItem.color}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3 bg-slate-800 border-slate-700">
                        <HexColorPicker color={selectedItem.color} onChange={(color) => updateSelected({ color })} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-slate-400">Measurements (meters)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-500">Width</Label>
                        <Input
                          type="number"
                          value={selectedItem.width}
                          min={0.25}
                          step={0.05}
                          onChange={(e) => {
                            const v = clamp(
                              parseFloat(e.target.value) || selectedItem.width,
                              0.25,
                              Math.max(0.25, roomSpec.width / Math.max(0.1, selectedItem.scale))
                            );
                            updateSelected({ width: v }, false);
                          }}
                          onBlur={(e) => {
                            const v = clamp(
                              parseFloat(e.currentTarget.value) || selectedItem.width,
                              0.25,
                              Math.max(0.25, roomSpec.width / Math.max(0.1, selectedItem.scale))
                            );
                            updateSelected({ width: v }, true);
                          }}
                          className="bg-slate-900 border-slate-700 text-slate-50 h-10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-500">Depth</Label>
                        <Input
                          type="number"
                          value={selectedItem.height}
                          min={0.25}
                          step={0.05}
                          onChange={(e) => {
                            const v = clamp(
                              parseFloat(e.target.value) || selectedItem.height,
                              0.25,
                              Math.max(0.25, roomSpec.height / Math.max(0.1, selectedItem.scale))
                            );
                            updateSelected({ height: v }, false);
                          }}
                          onBlur={(e) => {
                            const v = clamp(
                              parseFloat(e.currentTarget.value) || selectedItem.height,
                              0.25,
                              Math.max(0.25, roomSpec.height / Math.max(0.1, selectedItem.scale))
                            );
                            updateSelected({ height: v }, true);
                          }}
                          className="bg-slate-900 border-slate-700 text-slate-50 h-10"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-slate-500">
                      Footprint with scale: {(selectedItem.width * selectedItem.scale).toFixed(2)}m × {(selectedItem.height * selectedItem.scale).toFixed(2)}m
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Tip: You can also resize by dragging the blue handles in 2D.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-xs uppercase tracking-wider text-slate-400">Scale</Label>
                      <span className="text-xs text-slate-500">{selectedItem.scale.toFixed(2)}x</span>
                    </div>
                    <Slider value={[selectedItem.scale]} onValueChange={([scale]) => updateSelected({ scale }, false)} onValueCommit={([scale]) => updateSelected({ scale }, true)} min={0.5} max={2} step={0.05} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-xs uppercase tracking-wider text-slate-400">Rotation</Label>
                      <span className="text-xs text-slate-500">{Math.round(selectedItem.rotation)}°</span>
                    </div>
                    <Slider value={[selectedItem.rotation]} onValueChange={([rotation]) => updateSelected({ rotation }, false)} onValueCommit={([rotation]) => updateSelected({ rotation }, true)} min={-180} max={180} step={5} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-xs uppercase tracking-wider text-slate-400">3D Height</Label>
                      <span className="text-xs text-slate-500">{(selectedItem.zHeight ?? 0).toFixed(2)}m</span>
                    </div>
                    <Slider value={[selectedItem.zHeight ?? 0]} onValueChange={([zHeight]) => updateSelected({ zHeight }, false)} onValueCommit={([zHeight]) => updateSelected({ zHeight }, true)} min={0} max={2.5} step={0.05} />
                    <p className="text-xs text-slate-500">0 = auto by furniture type</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase tracking-wider text-slate-400">Shading</Label>
                      <Switch checked={selectedItem.shadow ?? false} onCheckedChange={(shadow) => updateSelected({ shadow })} />
                    </div>
                    {(selectedItem.shadow ?? false) && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label className="text-xs text-slate-500">Intensity</Label>
                          <span className="text-xs text-slate-500">{(selectedItem.shadowIntensity ?? 0.5).toFixed(2)}</span>
                        </div>
                        <Slider value={[selectedItem.shadowIntensity ?? 0.5]} onValueChange={([shadowIntensity]) => updateSelected({ shadowIntensity }, false)} onValueCommit={([shadowIntensity]) => updateSelected({ shadowIntensity }, true)} min={0} max={1} step={0.05} />
                      </div>
                    )}
                  </div>

                  <Button variant="destructive" onClick={() => {
                    if (!selectedItem) return;
                    const next = furniture.filter(i => i.id !== selectedItem.id);
                    dispatchHist({ type: 'COMMIT', items: next });
                    setSelectedId(null);
                    toast.success('Furniture removed');
                  }} className="w-full">
                    <Trash2 className="size-4 mr-2" /> Delete
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-slate-400">Width (meters)</Label>
                    <Input type="number" value={roomSpec.width} onChange={(e) => setRoomSpec((r) => ({ ...r, width: clamp(parseFloat(e.target.value) || 6, 2, 50) }))} min={2} max={50} className="bg-slate-900 border-slate-700 text-slate-50 h-10" />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-slate-400">Height (meters)</Label>
                    <Input type="number" value={roomSpec.height} onChange={(e) => setRoomSpec((r) => ({ ...r, height: clamp(parseFloat(e.target.value) || 6, 2, 50) }))} min={2} max={50} className="bg-slate-900 border-slate-700 text-slate-50 h-10" />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-slate-400">Shape</Label>
                    <Select value={roomSpec.shape} onValueChange={(shape: any) => setRoomSpec((r) => ({ ...r, shape }))}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-50 h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="rectangular">Rectangular</SelectItem>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="l-shaped">L-Shaped</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {roomSpec.shape === 'l-shaped' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-slate-400">Notch W</Label>
                        <Input type="number" value={roomSpec.notchWidth ?? 2} onChange={(e) => setRoomSpec((r) => ({ ...r, notchWidth: clamp(parseFloat(e.target.value) || 2, 0.5, r.width - 0.5) }))} className="bg-slate-900 border-slate-700 text-slate-50 h-10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-slate-400">Notch H</Label>
                        <Input type="number" value={roomSpec.notchHeight ?? 2} onChange={(e) => setRoomSpec((r) => ({ ...r, notchHeight: clamp(parseFloat(e.target.value) || 2, 0.5, r.height - 0.5) }))} className="bg-slate-900 border-slate-700 text-slate-50 h-10" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-slate-400">Wall Color</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full h-10 rounded-md border border-slate-700 hover:border-slate-600 transition-colors flex items-center gap-3 px-3">
                          <div className="size-6 rounded border border-slate-600" style={{ backgroundColor: roomSpec.wallColor }} />
                          <span className="text-sm text-slate-300">{roomSpec.wallColor}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3 bg-slate-800 border-slate-700">
                        <HexColorPicker color={roomSpec.wallColor} onChange={(wallColor) => setRoomSpec((r) => ({ ...r, wallColor }))} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-slate-400">Floor Color</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full h-10 rounded-md border border-slate-700 hover:border-slate-600 transition-colors flex items-center gap-3 px-3">
                          <div className="size-6 rounded border border-slate-600" style={{ backgroundColor: roomSpec.floorColor }} />
                          <span className="text-sm text-slate-300">{roomSpec.floorColor}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3 bg-slate-800 border-slate-700">
                        <HexColorPicker color={roomSpec.floorColor} onChange={(floorColor) => setRoomSpec((r) => ({ ...r, floorColor }))} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase tracking-wider text-slate-400">Global Shading</Label>
                      <Switch checked={roomSpec.globalShadow ?? false} onCheckedChange={(globalShadow) => setRoomSpec((r) => ({ ...r, globalShadow }))} />
                    </div>
                    {(roomSpec.globalShadow ?? false) && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label className="text-xs text-slate-500">Intensity</Label>
                          <span className="text-xs text-slate-500">{(roomSpec.globalShadowIntensity ?? 0.3).toFixed(2)}</span>
                        </div>
                        <Slider value={[roomSpec.globalShadowIntensity ?? 0.3]} onValueChange={([globalShadowIntensity]) => setRoomSpec((r) => ({ ...r, globalShadowIntensity }))} min={0} max={1} step={0.05} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-slate-400">Project Notes</Label>
                    <Textarea
                      value={designNotes}
                      onChange={(e) => setDesignNotes(e.target.value.slice(0, 2000))}
                      placeholder="Add project notes, requirements, measurements, or reminders..."
                      className="min-h-28 resize-y bg-slate-900 border-slate-700 text-slate-100"
                    />
                    <p className="text-xs text-slate-500">{designNotes.length}/2000</p>
                  </div>
                </>
              )}

              {/* Bulk actions always available */}
              <div className="pt-4 border-t border-slate-700 space-y-4">
                <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Bulk Actions</h3>
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wider text-slate-400">Color for ALL</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={applyAllColor}
                      onChange={(e) => setApplyAllColor(e.target.value)}
                      className="h-10 w-12 rounded border border-slate-700 bg-slate-900"
                      aria-label="Pick color for all furniture"
                    />
                    <Button variant="secondary" className="flex-1" onClick={() => applyToAll({ color: applyAllColor })}>
                      Apply Color
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => applyToAll({ shadow: true })}>Shading ON</Button>
                  <Button variant="secondary" onClick={() => applyToAll({ shadow: false })}>Shading OFF</Button>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Tips: Drag/resize/rotate directly in 2D. Use Delete key to remove selected.
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
