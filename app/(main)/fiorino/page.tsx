"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { X, RotateCcw, Save, Upload, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useUserRole } from "@/lib/user-context";
import { getFiorinoPlans, addFiorinoPlan, deleteFiorinoPlan } from "@/lib/supabase-db";
import type { FiorinoPlan } from "@/lib/db";
import type { PlacedBox, BoxType, BoxOrientation } from "./viewer";
import { getBoxDimsM, CARGO, ARCH_LEFT, ARCH_RIGHT } from "./viewer";

const FiorinoViewer = dynamic(() => import("./viewer"), { ssr: false });

type Orientation = BoxOrientation;

const BOX_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#f97316", "#14b8a6",
  "#ec4899", "#84cc16", "#06b6d4", "#a78bfa",
];

const SIZE_LABELS: Record<BoxType, string> = {
  PA: "Peq A", MA: "Méd A", MB: "Méd B", G: "Grande",
};

// Available volume in m³ (operational height, minus wheel arches)
const ARCH_VOL =
  ARCH_LEFT.w  * Math.min(ARCH_LEFT.hMax,  CARGO.opHeight) * ARCH_LEFT.d +
  ARCH_RIGHT.w * Math.min(ARCH_RIGHT.hMax, CARGO.opHeight) * ARCH_RIGHT.d;
const TOTAL_VOLUME = CARGO.width * CARGO.opHeight * CARGO.length - ARCH_VOL;

let colorIndex = 0;
function nextColor() { return BOX_COLORS[colorIndex++ % BOX_COLORS.length]; }

// XZ-plane AABB overlap test
function overlapsXZ(
  ax: number, az: number, aw: number, ad: number,
  bx: number, bz: number, bw: number, bd: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && az < bz + bd && az + ad > bz;
}

// Lowest Y at which a box with the given XZ footprint can rest (stacks on arches + existing boxes)
function findStackY(x: number, z: number, w: number, d: number, boxes: PlacedBox[]): number {
  let y = 0;
  if (overlapsXZ(x, z, w, d, ARCH_LEFT.x,  ARCH_LEFT.z,  ARCH_LEFT.w,  ARCH_LEFT.d))
    y = Math.max(y, ARCH_LEFT.hMax);
  if (overlapsXZ(x, z, w, d, ARCH_RIGHT.x, ARCH_RIGHT.z, ARCH_RIGHT.w, ARCH_RIGHT.d))
    y = Math.max(y, ARCH_RIGHT.hMax);
  for (const box of boxes) {
    const { w: bw, h: bh, d: bd } = getBoxDimsM(box.size, box.orientation);
    if (overlapsXZ(x, z, w, d, box.x, box.z, bw, bd))
      y = Math.max(y, box.y + bh);
  }
  return y;
}

// Check compartment bounds + operational height limit
function canPlace(x: number, y: number, z: number, w: number, h: number, d: number): boolean {
  return x >= -0.001 && x + w <= CARGO.width  + 0.001
      && z >= -0.001 && z + d <= CARGO.length + 0.001
      && y + h <= CARGO.opHeight + 0.001;
}

// Snap to nearest wall/box edge, strongly preferring positions that don't
// overlap existing boxes in XZ (side-by-side > stacking).
function snapPosition(
  cx: number, cz: number,
  bw: number, bd: number,
  boxes: PlacedBox[],
): { x: number; z: number } {
  const clampX = (x: number) => Math.max(0, Math.min(CARGO.width  - bw, x));
  const clampZ = (z: number) => Math.max(0, Math.min(CARGO.length - bd, z));

  const nx = clampX(cx - bw / 2);
  const nz = clampZ(cz - bd / 2);

  const xSet = new Set<number>([0, CARGO.width - bw]);
  const zSet = new Set<number>([0, CARGO.length - bd]);

  // Arch edges as snap candidates
  xSet.add(ARCH_LEFT.x + ARCH_LEFT.w);       // borda direita do arco esq
  xSet.add(ARCH_RIGHT.x - bw);               // borda esquerda do arco dir
  zSet.add(ARCH_LEFT.z - bd);                // frente dos arcos
  zSet.add(ARCH_LEFT.z + ARCH_LEFT.d);       // atrás dos arcos

  for (const box of boxes) {
    const { w: ebw, d: ebd } = getBoxDimsM(box.size, box.orientation);
    xSet.add(box.x + ebw);
    xSet.add(box.x - bw);
    zSet.add(box.z + ebd);
    zSet.add(box.z - bd);
  }

  let bestX = nx, bestZ = nz, bestScore = Infinity;
  for (const rx of xSet) {
    const x = clampX(rx);
    for (const rz of zSet) {
      const z = clampZ(rz);
      const dist = Math.hypot(x - nx, z - nz);

      const overlapsBox = boxes.some(b => {
        const { w: ebw, d: ebd } = getBoxDimsM(b.size, b.orientation);
        return overlapsXZ(x, z, bw, bd, b.x, b.z, ebw, ebd);
      });
      const overlapsArch =
        overlapsXZ(x, z, bw, bd, ARCH_LEFT.x,  ARCH_LEFT.z,  ARCH_LEFT.w,  ARCH_LEFT.d) ||
        overlapsXZ(x, z, bw, bd, ARCH_RIGHT.x, ARCH_RIGHT.z, ARCH_RIGHT.w, ARCH_RIGHT.d);

      const score = dist + (overlapsBox ? 10 : 0) + (overlapsArch ? 10 : 0);
      if (score < bestScore) { bestScore = score; bestX = x; bestZ = z; }
    }
  }

  return { x: bestX, z: bestZ };
}

// ── 2-D top-down floor plan ──────────────────────────────────────────────────
function drawFloorPlan(
  canvas: HTMLCanvasElement,
  boxes: PlacedBox[],
  hover: { x: number; z: number } | null,
  selectedSize: BoxType,
  orientation: Orientation,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width === 0 || canvas.height === 0) return;

  const CW = canvas.width, CH = canvas.height;
  const PAD = 10;
  const aW = CW - PAD * 2;
  const aH = CH - PAD * 2;
  const sX = aW / CARGO.width;
  const sZ = aH / CARGO.length;

  const px = (m: number) => PAD + m * sX;
  const pz = (m: number) => PAD + m * sZ;

  ctx.clearRect(0, 0, CW, CH);

  // Compartment fill
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(PAD, PAD, aW, aH);

  // Wheel arches — cross-hatched
  for (const arch of [ARCH_LEFT, ARCH_RIGHT]) {
    const ax = px(arch.x), az = pz(arch.z);
    const aw = arch.w * sX, ad = arch.d * sZ;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(ax, az, aw, ad);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ax, az, aw, ad);
    ctx.clip();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let t = -ad; t < aw + ad; t += 6) {
      ctx.moveTo(ax + t,      az);
      ctx.lineTo(ax + t + ad, az + ad);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, az, aw, ad);
  }

  // Compartment outline
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 2;
  ctx.strokeRect(PAD, PAD, aW, aH);

  // Door indicator (rear = bottom)
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + aH);
  ctx.lineTo(PAD + aW, PAD + aH);
  ctx.stroke();

  // Direction labels
  ctx.fillStyle = "#475569";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CAB", CW / 2, PAD / 2 + 1);
  ctx.fillText("PORTA", CW / 2, CH - PAD / 2 - 1);

  // Placed boxes (XZ footprint)
  for (const box of boxes) {
    const { w: bw, d: bd } = getBoxDimsM(box.size, box.orientation);
    const bpx = px(box.x), bpz = pz(box.z), bpw = bw * sX, bph = bd * sZ;
    ctx.fillStyle = box.color + "cc";
    ctx.fillRect(bpx, bpz, bpw, bph);
    ctx.strokeStyle = box.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bpx, bpz, bpw, bph);
    if (bpw > 18 && bph > 10) {
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.min(10, Math.floor(bph * 0.42))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lbl = box.label.length > 9 ? box.label.slice(0, 8) + "…" : box.label;
      ctx.fillText(lbl, bpx + bpw / 2, bpz + bph / 2);
    }
  }

  // Hover ghost — shows snapped position
  if (hover) {
    const { w: bw, h: bh, d: bd } = getBoxDimsM(selectedSize, orientation);
    const { x: cx, z: cz } = snapPosition(hover.x, hover.z, bw, bd, boxes);
    const y  = findStackY(cx, cz, bw, bd, boxes);
    const ok = canPlace(cx, y, cz, bw, bh, bd);
    const gx = px(cx), gz = pz(cz), gw = bw * sX, gh = bd * sZ;
    ctx.fillStyle = ok ? "rgba(99,102,241,0.30)" : "rgba(239,68,68,0.30)";
    ctx.fillRect(gx, gz, gw, gh);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = ok ? "#818cf8" : "#f87171";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx, gz, gw, gh);
    ctx.setLineDash([]);
    if (ok && gh > 12 && gw > 24) {
      ctx.fillStyle = "#818cf8";
      ctx.font = "8px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(y > 0.01 ? `+${y.toFixed(2)}m` : "chão", gx + gw / 2, gz + gh / 2);
    }
  }
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{children}</p>;
}

function SelBtn({
  active, onClick, children, className,
}: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg text-sm font-medium border transition-colors",
        active
          ? "bg-indigo-600 border-indigo-500 text-white"
          : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function FiorinoPage() {
  const { isAdmin, hasFiorino, profileLoaded } = useUserRole();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => { colorIndex = 0; }, []);

  useEffect(() => {
    if (!profileLoaded) return;
    if (!isAdmin && !hasFiorino) router.replace("/orders");
  }, [profileLoaded, isAdmin, hasFiorino, router]);

  // ── Placement state ──
  const [boxes, setBoxes] = useState<PlacedBox[]>([]);
  const [selectedSize, setSelectedSize] = useState<BoxType>("PA");
  const [orientation, setOrientation] = useState<Orientation>("vertical");
  const [boxLabel, setBoxLabel] = useState("");
  const [hoverPos, setHoverPos] = useState<{ x: number; z: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Save plan state ──
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveDate, setSaveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saveType, setSaveType] = useState("entrega");
  const [saveCampaignCode, setSaveCampaignCode] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── History state ──
  const [plans, setPlans] = useState<FiorinoPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("posicionar");

  // Volume-based occupancy
  const usedVolume = useMemo(() =>
    boxes.reduce((sum, box) => {
      const { w, h, d } = getBoxDimsM(box.size, box.orientation);
      return sum + w * h * d;
    }, 0), [boxes]);
  const occupancyPct = Math.min(100, Math.round((usedVolume / TOTAL_VOLUME) * 100));

  // Derived dims for orientation label
  const { w: dimW, h: dimH, d: dimD } = useMemo(
    () => getBoxDimsM(selectedSize, orientation), [selectedSize, orientation]);

  // ── Canvas helpers ──
  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const PAD = 10;
    const aW = rect.width  - PAD * 2;
    const aH = rect.height - PAD * 2;
    return {
      x: ((clientX - rect.left - PAD) / aW) * CARGO.width,
      z: ((clientY - rect.top  - PAD) / aH) * CARGO.length,
    };
  }, []);

  const placeBox = useCallback((clientX: number, clientY: number) => {
    const pos = getCanvasPos(clientX, clientY);
    if (!pos) return;
    const { w: bw, h: bh, d: bd } = getBoxDimsM(selectedSize, orientation);
    const { x: cx, z: cz } = snapPosition(pos.x, pos.z, bw, bd, boxes);
    const y  = findStackY(cx, cz, bw, bd, boxes);
    if (!canPlace(cx, y, cz, bw, bh, bd)) return;
    setBoxes(prev => [...prev, {
      id: crypto.randomUUID(), size: selectedSize, orientation,
      label: boxLabel.trim() || `${SIZE_LABELS[selectedSize]} ${prev.length + 1}`,
      color: nextColor(), x: cx, y, z: cz,
    }]);
    setBoxLabel("");
  }, [selectedSize, orientation, boxes, boxLabel, getCanvasPos]);

  const handleCanvasMove  = useCallback((e: React.MouseEvent<HTMLCanvasElement>) =>
    setHoverPos(getCanvasPos(e.clientX, e.clientY)), [getCanvasPos]);
  const handleCanvasLeave = useCallback(() => setHoverPos(null), []);
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) =>
    placeBox(e.clientX, e.clientY), [placeBox]);
  const handleCanvasTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // evita ghost click sintetizado pelo browser após onTouchEnd
    const t = e.changedTouches[0];
    if (t) placeBox(t.clientX, t.clientY);
  }, [placeBox]);

  // Redraw canvas whenever any input changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width  !== w) canvas.width  = w;
      if (canvas.height !== h) canvas.height = h;
      drawFloorPlan(canvas, boxes, hoverPos, selectedSize, orientation);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [boxes, hoverPos, selectedSize, orientation]);

  const handleRemoveBox = useCallback((id: string) =>
    setBoxes(prev => prev.filter(b => b.id !== id)), []);

  const handleClear = useCallback(() => { setBoxes([]); colorIndex = 0; }, []);

  // ── History ──
  useEffect(() => {
    if (activeTab !== "historico") return;
    setPlansLoading(true);
    getFiorinoPlans()
      .then(setPlans)
      .catch(() => alert("Erro ao carregar histórico."))
      .finally(() => setPlansLoading(false));
  }, [activeTab]);

  const handleSavePlan = async () => {
    setSaving(true);
    try {
      await addFiorinoPlan({
        date: saveDate, campo: null,
        campaignCode: saveCampaignCode.trim() || null,
        type: saveType, notes: saveNotes.trim() || null,
        boxes, occupancyPct, boxCount: boxes.length,
      });
      setSaveOpen(false);
      setSaveCampaignCode("");
      setSaveNotes("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? JSON.stringify(err);
      alert("Erro ao salvar plano: " + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!await confirm("Excluir este plano?", {
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir", destructive: true,
    })) return;
    try {
      await deleteFiorinoPlan(id);
      setPlans(prev => prev.filter(p => p.id !== id));
    } catch {
      alert("Erro ao excluir plano.");
    }
  };

  const handleLoadPlan = (plan: FiorinoPlan) => {
    const validBoxes = (plan.boxes as PlacedBox[]).filter(b => typeof b.x === "number");
    setBoxes(validBoxes);
    colorIndex = validBoxes.length % BOX_COLORS.length;
    setActiveTab("posicionar");
  };

  if (!profileLoaded) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {confirmDialog}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Fiorino</h1>
          <p className="text-xs text-slate-500">1,90 × 1,50 × 1,34 m</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-white">
              {boxes.length} {boxes.length === 1 ? "caixa" : "caixas"}
            </p>
            <p className="text-xs text-slate-400">{occupancyPct}% ocupado</p>
          </div>
          <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{
              width: `${occupancyPct}%`,
              backgroundColor: occupancyPct > 80 ? "#ef4444" : occupancyPct > 50 ? "#f59e0b" : "#10b981",
            }} />
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => { setSaveDate(new Date().toISOString().slice(0, 10)); setSaveOpen(true); }}
            disabled={boxes.length === 0}
            className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200"
          >
            <Save className="w-4 h-4 mr-1.5" />
            Salvar
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col md:flex-row gap-3">

        {/* 3D Viewer */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/40
                        h-[50vw] min-h-[180px] max-h-[240px]
                        md:h-[600px] md:max-h-none md:flex-1">
          <FiorinoViewer boxes={boxes} />
        </div>

        {/* Controls panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden
                        md:w-[300px] md:h-[600px] md:flex md:flex-col md:shrink-0">

          <Tabs value={activeTab} onValueChange={setActiveTab}
            className="flex-1 min-h-0 gap-0 md:flex md:flex-col">

            <TabsList className="grid grid-cols-3 w-full rounded-none border-b border-slate-800 bg-transparent h-11 shrink-0">
              <TabsTrigger value="posicionar"
                className="rounded-none border-0 data-active:bg-slate-800/60 data-active:text-white text-slate-400 text-sm">
                Posicionar
              </TabsTrigger>
              <TabsTrigger value="caixas"
                className="rounded-none border-0 data-active:bg-slate-800/60 data-active:text-white text-slate-400 text-sm">
                Caixas ({boxes.length})
              </TabsTrigger>
              <TabsTrigger value="historico"
                className="rounded-none border-0 data-active:bg-slate-800/60 data-active:text-white text-slate-400 text-sm">
                Visualizar
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Posicionar ── */}
            <TabsContent value="posicionar" className="m-0 flex flex-col min-h-0 md:flex-1">
              <div className="flex flex-col gap-3 p-3 md:flex-1 md:min-h-0">

                {/* Box size selector */}
                <div className="shrink-0 flex flex-col gap-1.5">
                  <SectionLabel>Caixa</SectionLabel>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["PA", "MA", "MB", "G"] as BoxType[]).map(s => (
                      <SelBtn key={s} active={selectedSize === s}
                        onClick={() => setSelectedSize(s)} className="py-2 text-xs">
                        {SIZE_LABELS[s]}
                      </SelBtn>
                    ))}
                  </div>
                </div>

                {/* Direction selector */}
                <div className="shrink-0 flex flex-col gap-1.5">
                  <SectionLabel>
                    Direção
                    <span className="ml-2 normal-case font-normal text-slate-500 tracking-normal">
                      {dimW.toFixed(2)}×{dimH.toFixed(2)}×{dimD.toFixed(2)} m
                    </span>
                  </SectionLabel>
                  <div className="flex gap-1.5">
                    <SelBtn active={orientation === "vertical"}
                      onClick={() => setOrientation("vertical")} className="flex-1 py-2">
                      Frente-fundo
                    </SelBtn>
                    <SelBtn active={orientation === "horizontal"}
                      onClick={() => setOrientation("horizontal")} className="flex-1 py-2">
                      Lado-a-lado
                    </SelBtn>
                  </div>
                </div>

                {/* 2D floor plan — fills remaining space on desktop */}
                <div className="flex flex-col gap-1.5 md:flex-1 md:min-h-0">
                  <SectionLabel>Planta baixa — clique para posicionar</SectionLabel>
                  <canvas
                    ref={canvasRef}
                    className="w-full h-[200px] rounded-lg cursor-crosshair touch-none border border-slate-800 md:flex-1 md:h-auto"
                    onMouseMove={handleCanvasMove}
                    onMouseLeave={handleCanvasLeave}
                    onClick={handleCanvasClick}
                    onTouchEnd={handleCanvasTouchEnd}
                  />
                </div>

                {/* Optional label */}
                <Input
                  value={boxLabel}
                  onChange={e => setBoxLabel(e.target.value)}
                  placeholder="Rótulo da caixa (opcional)"
                  className="shrink-0 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
                  maxLength={40}
                />

              </div>
            </TabsContent>

            {/* ── Tab: Caixas ── */}
            <TabsContent value="caixas" className="m-0 flex flex-col min-h-0 md:overflow-y-auto">
              <div className="flex flex-col gap-2 p-3">
                {boxes.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center mt-8">Nenhuma caixa adicionada</p>
                ) : (
                  <>
                    {boxes.map(box => (
                      <div key={box.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2.5">
                        <div className="w-3.5 h-3.5 rounded shrink-0" style={{ backgroundColor: box.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{box.label}</p>
                          <p className="text-xs text-slate-400">
                            {SIZE_LABELS[box.size]} · {box.orientation === "vertical" ? "↑ Vert." : "↔ Horiz."}
                            {box.y > 0.01 ? ` · +${box.y.toFixed(2)}m` : " · chão"}
                          </p>
                        </div>
                        <button onClick={() => handleRemoveBox(box.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors shrink-0 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <Button variant="outline" onClick={handleClear}
                      className="w-full mt-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Limpar Carga
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>

            {/* ── Tab: Histórico ── */}
            <TabsContent value="historico" className="m-0 flex flex-col min-h-0 md:overflow-y-auto">
              <div className="flex flex-col gap-2 p-3">
                {plansLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : plans.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center mt-8">Nenhum plano salvo</p>
                ) : (
                  plans.map(plan => (
                    <div key={plan.id}
                      className="flex items-start gap-2 rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{plan.date} · {plan.type}</p>
                        <p className="text-xs text-slate-400">
                          {plan.boxCount} {plan.boxCount === 1 ? "caixa" : "caixas"} · {plan.occupancyPct}% ocupado
                          {plan.campaignCode ? ` · ${plan.campaignCode}` : ""}
                        </p>
                        {plan.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{plan.notes}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleLoadPlan(plan)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                          title="Carregar plano">
                          <Upload className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeletePlan(plan.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Excluir plano">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* ── Dialog: Salvar Plano ── */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Salvar Plano</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Data</label>
              <Input type="date" value={saveDate} onChange={e => setSaveDate(e.target.value)}
                className="bg-slate-800/60 border-slate-700 text-white" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Tipo</label>
              <div className="flex gap-2">
                {["entrega", "coleta", "outro"].map(t => (
                  <button key={t} onClick={() => setSaveType(t)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      saveType === t
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500"
                    )}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Código de Campanha (opcional)</label>
              <Input value={saveCampaignCode} onChange={e => setSaveCampaignCode(e.target.value)}
                placeholder="ex: 2025-1" maxLength={30}
                className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Observações (opcional)</label>
              <Textarea value={saveNotes} onChange={e => setSaveNotes(e.target.value)}
                placeholder="Anotações sobre este carregamento..." maxLength={200} rows={2}
                className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)} disabled={saving}
              className="text-slate-400 hover:text-white">
              Cancelar
            </Button>
            <Button onClick={handleSavePlan} disabled={saving || !saveDate}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
