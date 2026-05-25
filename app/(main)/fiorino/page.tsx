"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import type { PlacedBox } from "./viewer";
import { getBoxConfig } from "./viewer";

const FiorinoViewer = dynamic(() => import("./viewer"), { ssr: false });

type BoxSize = PlacedBox["size"];
type Orientation = PlacedBox["orientation"];

const COLS = 4;
const ROWS = 6;
const LEVELS = 4;
const TOTAL_CELLS = COLS * ROWS * LEVELS;
const COL_LABELS = ["A", "B", "C", "D"];

const BOX_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#f97316", "#14b8a6",
  "#ec4899", "#84cc16", "#06b6d4", "#a78bfa",
];

const SIZE_LABELS: Record<BoxSize, string> = { P: "Pequeno", M: "Médio", G: "Grande" };

let colorIndex = 0;
function nextColor() {
  const c = BOX_COLORS[colorIndex % BOX_COLORS.length];
  colorIndex++;
  return c;
}

function cellKey(col: number, row: number, level: number) { return `${col},${row},${level}`; }

function buildOccupation(boxes: PlacedBox[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const box of boxes) {
    const cfg = getBoxConfig(box.size, box.orientation);
    for (let dc = 0; dc < cfg.cols; dc++)
      for (let dr = 0; dr < cfg.rows; dr++)
        for (let dl = 0; dl < cfg.levels; dl++)
          map[cellKey(box.col + dc, box.row + dr, box.level + dl)] = box.id;
  }
  return map;
}

function isOutOfBounds(col: number, row: number, size: BoxSize, orientation: Orientation) {
  const cfg = getBoxConfig(size, orientation);
  return col + cfg.cols > COLS || row + cfg.rows > ROWS;
}

function getAutoLevel(
  col: number, row: number, size: BoxSize, orientation: Orientation,
  occupation: Record<string, string>
): number | null {
  const cfg = getBoxConfig(size, orientation);
  for (let startLevel = 0; startLevel <= LEVELS - cfg.levels; startLevel++) {
    let ok = true;
    outer: for (let dc = 0; dc < cfg.cols; dc++)
      for (let dr = 0; dr < cfg.rows; dr++)
        for (let dl = 0; dl < cfg.levels; dl++)
          if (occupation[cellKey(col + dc, row + dr, startLevel + dl)]) { ok = false; break outer; }
    if (ok) return startLevel;
  }
  return null;
}

function boxColorAt(
  col: number, row: number, level: number,
  occupation: Record<string, string>, boxes: PlacedBox[]
) {
  const id = occupation[cellKey(col, row, level)];
  return id ? (boxes.find(b => b.id === id)?.color ?? null) : null;
}

export default function FiorinoPage() {
  const { isAdmin, hasFiorino, profileLoaded } = useUserRole();
  const router = useRouter();

  // ── Route guard ──
  useEffect(() => {
    if (!profileLoaded) return;
    if (!isAdmin && !hasFiorino) router.replace("/orders");
  }, [profileLoaded, isAdmin, hasFiorino, router]);

  // ── Posicionador ──
  const [boxes, setBoxes] = useState<PlacedBox[]>([]);
  const [selectedSize, setSelectedSize] = useState<BoxSize>("P");
  const [orientation, setOrientation] = useState<Orientation>("vertical");
  const [viewLevel, setViewLevel] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{ col: number; row: number } | null>(null);
  const [boxLabel, setBoxLabel] = useState("");

  // ── Salvar plano ──
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveDate, setSaveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saveType, setSaveType] = useState("entrega");
  const [saveCampaignCode, setSaveCampaignCode] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Histórico ──
  const [plans, setPlans] = useState<FiorinoPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("posicionar");

  const occupation = useMemo(() => buildOccupation(boxes), [boxes]);
  const occupancyPct = Math.round((Object.keys(occupation).length / TOTAL_CELLS) * 100);

  const autoLevel = useMemo(() => {
    if (!selectedCell) return null;
    if (isOutOfBounds(selectedCell.col, selectedCell.row, selectedSize, orientation)) return null;
    return getAutoLevel(selectedCell.col, selectedCell.row, selectedSize, orientation, occupation);
  }, [selectedCell, selectedSize, orientation, occupation]);

  const previewKeys = useMemo(() => {
    if (!selectedCell || autoLevel === null) return new Set<string>();
    const cfg = getBoxConfig(selectedSize, orientation);
    const keys = new Set<string>();
    for (let dc = 0; dc < cfg.cols; dc++)
      for (let dr = 0; dr < cfg.rows; dr++)
        for (let dl = 0; dl < cfg.levels; dl++)
          if (autoLevel + dl === viewLevel)
            keys.add(cellKey(selectedCell.col + dc, selectedCell.row + dr, viewLevel));
    return keys;
  }, [selectedCell, selectedSize, orientation, autoLevel, viewLevel]);

  const handleCellClick = useCallback((col: number, row: number) => {
    if (isOutOfBounds(col, row, selectedSize, orientation)) return;
    setSelectedCell(prev => prev?.col === col && prev?.row === row ? null : { col, row });
  }, [selectedSize, orientation]);

  const handleSizeChange = useCallback((size: BoxSize) => {
    setSelectedSize(size); setSelectedCell(null);
  }, []);

  const handleOrientationChange = useCallback((o: Orientation) => {
    setOrientation(o); setSelectedCell(null);
  }, []);

  const handleAddBox = useCallback(() => {
    if (!selectedCell || autoLevel === null) return;
    setBoxes(prev => [...prev, {
      id: crypto.randomUUID(), size: selectedSize, orientation,
      label: boxLabel.trim() || `${SIZE_LABELS[selectedSize]} ${prev.length + 1}`,
      color: nextColor(), col: selectedCell.col, row: selectedCell.row, level: autoLevel,
    }]);
    setSelectedCell(null);
    setBoxLabel("");
  }, [selectedCell, autoLevel, selectedSize, orientation, boxLabel]);

  const handleRemoveBox = useCallback((id: string) =>
    setBoxes(prev => prev.filter(b => b.id !== id)), []);

  const handleClear = useCallback(() => {
    setBoxes([]); setSelectedCell(null); colorIndex = 0;
  }, []);

  // ── Carregar histórico ao entrar na aba ──
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
        date: saveDate,
        campo: null,
        campaignCode: saveCampaignCode.trim() || null,
        type: saveType,
        notes: saveNotes.trim() || null,
        boxes,
        occupancyPct,
        boxCount: boxes.length,
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
    if (!confirm("Excluir este plano?")) return;
    try {
      await deleteFiorinoPlan(id);
      setPlans(prev => prev.filter(p => p.id !== id));
    } catch {
      alert("Erro ao excluir plano.");
    }
  };

  const handleLoadPlan = (plan: FiorinoPlan) => {
    setBoxes(plan.boxes);
    setSelectedCell(null);
    colorIndex = plan.boxes.length % BOX_COLORS.length;
    setActiveTab("posicionar");
  };

  const activeCfg = getBoxConfig(selectedSize, orientation);

  // Reutilizável: label de seção
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{children}</p>
  );

  // Botão de seleção genérico
  const SelBtn = ({
    active, onClick, children, className,
  }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) => (
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

  if (!profileLoaded) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Fiorino</h1>
          <p className="text-xs text-slate-500">1,85 × 1,32 × 1,36 m</p>
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
            size="sm"
            variant="outline"
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
                        h-[58vw] min-h-[210px] max-h-[320px]
                        md:h-[600px] md:max-h-none md:flex-1">
          <FiorinoViewer boxes={boxes} />
        </div>

        {/* ── Painel de controles ──
            Desktop: 600px fixo, flex-col, sem scroll externo
            Mobile:  altura natural, página scrollável                    */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden
                        md:w-[300px] md:h-[600px] md:flex md:flex-col md:shrink-0">

          {/* Tabs — gap-0 remove o espaço padrão entre list e content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 gap-0 md:flex md:flex-col">

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

            {/* ── Tab: Posicionar ──
                Desktop: flex-col, flex-1, sem scroll — grade se expande para preencher
                Mobile:  altura natural                                             */}
            <TabsContent value="posicionar"
              className="m-0 flex flex-col min-h-0 md:flex-1">
              <div className="flex flex-col gap-3 p-3 md:flex-1 md:min-h-0">

                {/* Tamanho */}
                <div className="shrink-0 flex flex-col gap-1.5">
                  <SectionLabel>Tamanho</SectionLabel>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["P", "M", "G"] as BoxSize[]).map(s => (
                      <SelBtn key={s} active={selectedSize === s} onClick={() => handleSizeChange(s)}
                        className="py-2">
                        {SIZE_LABELS[s]}
                      </SelBtn>
                    ))}
                  </div>
                </div>

                {/* Orientação */}
                <div className="shrink-0 flex flex-col gap-1.5">
                  <SectionLabel>
                    Orientação
                    <span className="ml-2 normal-case font-normal text-slate-500 tracking-normal">
                      {activeCfg.cols}×{activeCfg.rows}×{activeCfg.levels}
                    </span>
                  </SectionLabel>
                  <div className="flex gap-1.5">
                    {(["vertical", "horizontal"] as Orientation[]).map(o => (
                      <SelBtn key={o} active={orientation === o}
                        onClick={() => handleOrientationChange(o)} className="flex-1 py-2">
                        {o === "vertical" ? "↑ Vertical" : "↔ Horizontal"}
                      </SelBtn>
                    ))}
                  </div>
                </div>

                {/* Nível */}
                <div className="shrink-0 flex flex-col gap-1.5">
                  <SectionLabel>
                    Nível
                    <span className="ml-2 normal-case font-normal text-slate-500 tracking-normal">
                      {viewLevel === 0 ? "Chão" : `Nível ${viewLevel + 1}`}
                    </span>
                  </SectionLabel>
                  <div className="flex gap-1.5">
                    {Array.from({ length: LEVELS }, (_, i) => (
                      <SelBtn key={i} active={viewLevel === i}
                        onClick={() => setViewLevel(i)} className="flex-1 py-1.5 text-xs">
                        {i === 0 ? "Chão" : `Nív ${i + 1}`}
                      </SelBtn>
                    ))}
                  </div>
                </div>

                {/* ── Grade 2D — flex-1: preenche o espaço restante no desktop ── */}
                <div className="flex flex-col gap-1 md:flex-1 md:min-h-0">
                  {/* Label vira feedback quando há célula selecionada — sem alterar o height */}
                  {selectedCell && autoLevel !== null ? (
                    <p className="shrink-0 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                      {SIZE_LABELS[selectedSize]} {orientation === "vertical" ? "↑" : "↔"} ·{" "}
                      {COL_LABELS[selectedCell.col]}{selectedCell.row + 1} ·{" "}
                      {autoLevel === 0 ? "Chão" : `Nível ${autoLevel + 1}`}
                    </p>
                  ) : selectedCell && autoLevel === null ? (
                    <p className="shrink-0 text-xs font-semibold text-red-400 uppercase tracking-wider">
                      Posição inválida
                    </p>
                  ) : (
                    <SectionLabel>Grade</SectionLabel>
                  )}

                  {/* Cabeçalho de colunas */}
                  <div className="grid grid-cols-4 gap-1 shrink-0">
                    {COL_LABELS.map(l => (
                      <div key={l} className="text-center text-xs font-semibold text-slate-500">{l}</div>
                    ))}
                  </div>

                  {/* Linhas — cada linha usa flex-1 para distribuir o espaço vertical */}
                  <div className="flex flex-col gap-1 md:flex-1 md:min-h-0">
                    {Array.from({ length: ROWS }, (_, row) => (
                      <div key={row} className="grid grid-cols-4 gap-1 md:flex-1">
                        {Array.from({ length: COLS }, (_, col) => {
                          const key = cellKey(col, row, viewLevel);
                          const occupiedColor = boxColorAt(col, row, viewLevel, occupation, boxes);
                          const isSelected = selectedCell?.col === col && selectedCell?.row === row;
                          const isPreview = previewKeys.has(key);
                          const oob = isOutOfBounds(col, row, selectedSize, orientation);

                          let bg = "bg-emerald-900/60 border-emerald-700/40 hover:border-emerald-500 hover:bg-emerald-900/80";
                          if (oob)          bg = "bg-slate-800/40 border-slate-700/30 cursor-default opacity-40";
                          if (occupiedColor) bg = "border-slate-600/50 cursor-default";
                          if (isPreview)    bg = "bg-orange-500/30 border-orange-500/60";
                          if (isSelected)   bg = "bg-orange-500/50 border-orange-400 ring-1 ring-orange-400/50";

                          return (
                            <button key={col}
                              onClick={() => handleCellClick(col, row)}
                              disabled={!!occupiedColor || oob}
                              // Mobile: h-9 fixo. Desktop: h-full (flex-1 da row)
                              className={cn(
                                "h-9 md:h-full rounded border text-xs font-semibold transition-all",
                                bg
                              )}
                              style={occupiedColor
                                ? { backgroundColor: occupiedColor + "55", borderColor: occupiedColor }
                                : undefined}
                              title={`${COL_LABELS[col]}${row + 1}`}>
                              {occupiedColor ? "" : isSelected ? "✓" : `${COL_LABELS[col]}${row + 1}`}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>


                <Input
                  value={boxLabel}
                  onChange={e => setBoxLabel(e.target.value)}
                  placeholder="Descrição da caixa (opcional)"
                  className="shrink-0 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
                  maxLength={40}
                  onKeyDown={e => { if (e.key === "Enter") handleAddBox(); }}
                />

                <Button
                  onClick={handleAddBox}
                  disabled={!selectedCell || autoLevel === null}
                  className="shrink-0 w-full"
                >
                  Adicionar Caixa
                </Button>

              </div>
            </TabsContent>

            {/* ── Tab: Caixas ── */}
            <TabsContent value="caixas"
              className="m-0 flex flex-col min-h-0 md:overflow-y-auto">
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
                            {SIZE_LABELS[box.size]} · {box.orientation === "vertical" ? "↑" : "↔"} ·{" "}
                            {COL_LABELS[box.col]}{box.row + 1} · {box.level === 0 ? "Chão" : `Nív ${box.level + 1}`}
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
            <TabsContent value="historico"
              className="m-0 flex flex-col min-h-0 md:overflow-y-auto">
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
