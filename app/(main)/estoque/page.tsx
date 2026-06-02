"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, X, ChevronDown, ChevronUp, FileSpreadsheet, CheckCircle2, Clock, Download, PlusCircle, List, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUserRole } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import {
  createInventorySession, getActiveInventorySession, getInventorySessions,
  getActiveFieldSessions, completeInventorySession, upsertInventoryCount, getSessionCounts,
  updateInventorySessionProgress,
  type InventorySessionRow, type InventoryCountRow,
} from "@/lib/supabase-db";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StockItem {
  group: string;
  code: string;
  name: string;
  saldo: number;
  custo: number;
}

// ─── XLS parser ──────────────────────────────────────────────────────────────

// Índices reais das colunas no relatório ACS (header: rows 8-9, merged cells)
const ACS_COL_CODE  = 0;   // Código do Produto
const ACS_COL_NAME  = 3;   // Produto
const ACS_COL_SALDO = 11;  // Saldo em Estoque
const ACS_COL_CUSTO = 14;  // Custo Unitário

function parseFloat2(s: string) {
  return parseFloat(s.replace(",", ".")) || 0;
}

function parseXLSFile(file: File): Promise<StockItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
        const rows = rawRows.map(r => (r as unknown[]).map(c => String(c ?? "").trim()));

        const items = new Map<string, StockItem>();
        let currentGroup = "";

        for (const row of rows) {
          const code  = row[ACS_COL_CODE]  ?? "";
          const saldoCell = row[ACS_COL_SALDO] ?? "";

          // Linha de produto: col 0 é código numérico puro
          if (/^\d+$/.test(code)) {
            const name  = row[ACS_COL_NAME]  || "";
            const saldo = parseFloat2(saldoCell);
            const custo = parseFloat2(row[ACS_COL_CUSTO] ?? "");
            if (!name) continue;
            if (items.has(code)) {
              items.get(code)!.saldo += saldo; // mesmo produto em múltiplos depósitos
            } else {
              items.set(code, { group: currentGroup, code, name, saldo, custo });
            }
            continue;
          }

          // Linha de grupo: col 0 tem texto, col saldo está vazia, não é cabeçalho
          if (code && saldoCell === "" && !/código|produto|saldo|custo|unidade|valor|data|sels|relatório/i.test(code)) {
            currentGroup = code;
          }
        }

        resolve(
          Array.from(items.values()).sort((a, b) =>
            a.group.localeCompare(b.group) || a.name.localeCompare(b.name)
          )
        );
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

interface SetupProps {
  displayName: string;
  onStart: (params: { counterName: string; location: string; items: StockItem[] }) => Promise<void>;
  onBack: () => void;
}

function SetupScreen({ displayName, onStart, onBack }: SetupProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importedFiles, setImportedFiles] = useState<{ name: string; items: StockItem[] }[]>([]);
  const [location, setLocation] = useState("");
  const [starting, setStarting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const allItems = useMemo(() => {
    const map = new Map<string, StockItem>();
    for (const { items } of importedFiles)
      for (const item of items) map.set(item.code, item);
    return Array.from(map.values()).sort((a, b) =>
      a.group.localeCompare(b.group) || a.name.localeCompare(b.name)
    );
  }, [importedFiles]);

  const handleFiles = async (files: FileList | File[]) => {
    setError("");
    const arr = Array.from(files).filter(f => /\.xlsx?$/i.test(f.name));
    if (arr.length === 0) { setError("Selecione arquivos .xls ou .xlsx do ACS."); return; }
    try {
      const results = await Promise.all(arr.map(async f => ({ name: f.name, items: await parseXLSFile(f) })));
      setImportedFiles(prev => {
        const names = new Set(prev.map(f => f.name));
        return [...prev, ...results.filter(r => !names.has(r.name))];
      });
    } catch { setError("Erro ao ler arquivo. Verifique o formato."); }
  };

  const StepDot = ({ n, label }: { n: number; label: string }) => (
    <div className={cn("flex-1 text-center py-2 text-xs border-b-2 transition-colors",
      step === n ? "border-indigo-500 text-indigo-400 font-semibold" :
      step > n  ? "border-emerald-500 text-emerald-400" :
                  "border-slate-700 text-slate-500")}>
      {label}
    </div>
  );

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 hover:text-white hover:border-slate-500 transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Contagem de Estoque</h1>
          <p className="text-sm text-slate-500">Importe o estoque do ACS e inicie uma nova sessão</p>
        </div>
      </div>

      <div className="flex rounded-xl overflow-hidden border border-slate-800">
        <StepDot n={1} label="1 Arquivo" />
        <StepDot n={2} label="2 Identificação" />
        <StepDot n={3} label="3 Confirmar" />
      </div>

      {/* Step 1 — Import XLS */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <button
              onClick={() => setTutorialOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
            >
              <span className="font-medium">Como exportar do ACS</span>
              {tutorialOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            {tutorialOpen && (
              <ol className="px-4 pb-4 text-xs text-slate-400 list-decimal list-inside space-y-1.5 border-t border-slate-800 pt-3">
                <li>Acesse o ACS → <strong className="text-slate-300">Relatórios</strong></li>
                <li>Selecione <strong className="text-slate-300">Relatório Levantamento de Inventário</strong></li>
                <li>Escolha o(s) grupo(s) comercial(is) desejado(s)</li>
                <li>Clique em <strong className="text-slate-300">Exportar → Excel (.xls)</strong></li>
              </ol>
            )}
          </div>
          <label
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={cn(
              "rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors block",
              dragOver ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700 hover:border-slate-500"
            )}
          >
            <FileSpreadsheet className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-300">Clique ou arraste arquivos ACS</p>
            <p className="text-xs text-slate-500 mt-1">Aceita .xls e .xlsx — pode importar vários</p>
            <input type="file" accept=".xls,.xlsx" multiple className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)} />
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {importedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1 text-xs text-emerald-300 truncate">{f.name}</span>
              <span className="text-xs text-emerald-400">{f.items.length} itens</span>
              <button onClick={() => setImportedFiles(p => p.filter((_, j) => j !== i))}
                className="text-slate-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}

          {allItems.length > 0 && (
            <p className="text-xs text-slate-500">{allItems.length} itens únicos carregados</p>
          )}

          <Button onClick={() => allItems.length > 0 && setStep(2)} disabled={allItems.length === 0}>
            Próximo →
          </Button>
        </div>
      )}

      {/* Step 2 — Identification */}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold shrink-0">
              {displayName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-slate-500">Contador desta sessão</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">Local da contagem (opcional)</label>
            <Input value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Ex: Estoque Externo UCOB, Estoque Externo MT"
              className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="w-24">← Voltar</Button>
            <Button onClick={() => setStep(3)} className="flex-1">Próximo →</Button>
          </div>
        </div>
      )}

      {/* Step 3 — Confirm */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Contador</span><span className="text-white font-medium">{displayName}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Local</span><span className="text-white">{location || "Não informado"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total de itens</span><span className="text-white">{allItems.filter(i => i.saldo > 0).length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Arquivos</span><span className="text-white text-right">{importedFiles.map(f => f.name).join(", ")}</span></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="w-24">← Voltar</Button>
            <Button
              onClick={async () => { setStarting(true); try { await onStart({ counterName: displayName, location, items: allItems }); } finally { setStarting(false); } }}
              disabled={starting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {starting ? "Iniciando..." : "✓ Iniciar contagem"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Count Modal ─────────────────────────────────────────────────────────────

function CountModal({ item, currentQty, onSave, onClose }: {
  item: StockItem | null;
  currentQty: number;
  onSave: (qty: number) => Promise<void>;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(currentQty);
  const [saving, setSaving] = useState(false);
  useEffect(() => setQty(currentQty), [currentQty]);

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    try { await onSave(qty); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!item} onOpenChange={open => !open && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="p-4 flex flex-col gap-1">
          <p className="text-xs text-slate-500">{item?.code} · {item?.group}</p>
          <p className="text-base font-semibold text-white leading-snug">{item?.name}</p>
          <div className="flex gap-4 text-xs text-slate-400 mt-0.5">
            <span>Saldo: <strong className="text-white">{item?.saldo}</strong></span>
            <span>Custo: <strong className="text-white">{fmtBRL(item?.custo ?? 0)}</strong></span>
          </div>
        </div>

        {/* Qty */}
        <div className="px-4 pb-4">
          <label className="text-xs text-slate-400 mb-2 block">Quantidade contada</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setQty(q => Math.max(0, q - 1))}
              className="shrink-0 w-11 h-11 rounded-xl border border-slate-700 bg-slate-800 text-white text-xl flex items-center justify-center hover:border-slate-500">−</button>
            <input
              type="number" min={0} value={qty}
              onChange={e => setQty(Math.max(0, Number(e.target.value)))}
              onFocus={e => e.target.select()}
              onKeyDown={e => e.key === "Enter" && handleConfirm()}
              className="w-0 flex-1 text-center text-2xl font-bold bg-slate-800 border-2 border-indigo-500 rounded-xl py-2 text-white outline-none"
            />
            <button onClick={() => setQty(q => q + 1)}
              className="shrink-0 w-11 h-11 rounded-xl border border-slate-700 bg-slate-800 text-white text-xl flex items-center justify-center hover:border-slate-500">+</button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={saving} className="text-slate-400">Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report ───────────────────────────────────────────────────────────────────

function ReportView({ items, counts, session }: { items: StockItem[]; counts: Record<string, number>; session: InventorySessionRow }) {
  const withCount = items.map(i => ({ ...i, counted: counts[i.code] ?? -1 })).filter(i => i.counted >= 0);
  const sobras  = withCount.filter(i => i.counted > i.saldo);
  const faltas  = withCount.filter(i => i.counted < i.saldo);
  const matches = withCount.filter(i => i.counted === i.saldo);
  const totalSistema = items.reduce((s, i) => s + i.saldo * i.custo, 0);
  const totalContado = withCount.reduce((s, i) => s + i.counted * i.custo, 0);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(withCount.map(i => ({
      Grupo: i.group, Código: i.code, Nome: i.name,
      "Saldo Sistema": i.saldo, Contado: i.counted,
      Diferença: i.counted - i.saldo,
      "Custo Unit.": i.custo,
      "Valor Sistema": +(i.saldo * i.custo).toFixed(2),
      "Valor Contado": +(i.counted * i.custo).toFixed(2),
      Situação: i.counted > i.saldo ? "Sobra" : i.counted < i.saldo ? "Falta" : "OK",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contagem");
    XLSX.writeFile(wb, `inventario_${session.counter_name.replace(/\s/g,"_")}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={exportExcel}
          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs">
          <Download className="w-3.5 h-3.5 mr-1.5" /> Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Itens contados", value: withCount.length, color: "text-white" },
              { label: "Sobras",         value: sobras.length,    color: "text-emerald-400" },
              { label: "Faltas",         value: faltas.length,    color: "text-red-400" },
              { label: "Conferidos",     value: matches.length,   color: "text-indigo-400" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Valor sistema</span><span className="text-white">{fmtBRL(totalSistema)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Valor contado</span><span className="text-white">{fmtBRL(totalContado)}</span></div>
            <div className="flex justify-between border-t border-slate-800 pt-1.5 mt-0.5">
              <span className="text-slate-400">Diferença</span>
              <span className={totalContado - totalSistema >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmtBRL(totalContado - totalSistema)}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs min-w-[520px]">
              <thead><tr className="border-b border-slate-800 bg-slate-900/70">
                {["Produto","Sistema","Contado","Dif.","Situação"].map(h => (
                  <th key={h} className={cn("px-3 py-2 text-slate-400 font-medium", h === "Produto" ? "text-left" : "text-right")}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {withCount.map(i => (
                  <tr key={i.code} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2">
                      <p className="text-white font-medium truncate max-w-[200px]">{i.name}</p>
                      <p className="text-slate-500">{i.group}</p>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">{i.saldo}</td>
                    <td className="px-3 py-2 text-right text-white font-medium">{i.counted}</td>
                    <td className={cn("px-3 py-2 text-right font-medium",
                      i.counted - i.saldo > 0 ? "text-emerald-400" : i.counted - i.saldo < 0 ? "text-red-400" : "text-slate-500")}>
                      {i.counted - i.saldo > 0 ? "+" : ""}{i.counted - i.saldo}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
                        i.counted > i.saldo ? "bg-emerald-500/20 text-emerald-400" :
                        i.counted < i.saldo ? "bg-red-500/20 text-red-400" :
                                              "bg-slate-700 text-slate-400")}>
                        {i.counted > i.saldo ? "Sobra" : i.counted < i.saldo ? "Falta" : "OK"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
    </div>
  );
}

// ─── Counting Screen ──────────────────────────────────────────────────────────

function CountingScreen({ session, items, counts, isOwner, onCount, onEnd, onBack }: {
  session: InventorySessionRow;
  items: StockItem[];
  counts: Record<string, number>;
  isOwner: boolean;
  onCount: (item: StockItem, qty: number) => Promise<void>;
  onEnd: (isOwner: boolean) => Promise<void>;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "counted">("all");
  const [activeItem, setActiveItem] = useState<StockItem | null>(null);
  const [activeTab, setActiveTab] = useState("contar");
  const [ending, setEnding] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const countedCount = Object.keys(counts).length;
  const progress = items.length > 0 ? Math.round((countedCount / items.length) * 100) : 0;

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(i => {
      const matchSearch = !q || i.name.toLowerCase().includes(q) || i.code.includes(q);
      const isCounted = counts[i.code] !== undefined;
      return matchSearch && (filterMode === "all" || (filterMode === "counted" && isCounted) || (filterMode === "pending" && !isCounted));
    });
  }, [items, search, filterMode, counts]);

  const grouped = useMemo(() => {
    const map = new Map<string, StockItem[]>();
    for (const item of filteredItems) {
      const g = item.group || "Sem grupo";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const toggleGroup = (g: string) => setExpandedGroups(prev => {
    const s = new Set(prev); s.has(g) ? s.delete(g) : s.add(g); return s;
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400 hover:text-white hover:border-slate-500 transition-colors shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 truncate">{session.counter_name}{session.location ? ` · ${session.location}` : ""}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-20 sm:w-32 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-slate-400">{countedCount}/{items.length} · {progress}%</span>
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={async () => {
          if (!confirm(isOwner ? "Encerrar e salvar esta sessão?" : "Sair desta sessão?")) return;
          setEnding(true); try { await onEnd(isOwner); } finally { setEnding(false); }
        }} disabled={ending}
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs shrink-0">
          {ending ? "..." : isOwner ? <><span className="hidden sm:inline">Encerrar sessão</span><span className="sm:hidden">Encerrar</span></> : <><span className="hidden sm:inline">Sair da sessão</span><span className="sm:hidden">Sair</span></>}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full bg-slate-900/50 border border-slate-800 h-10">
          <TabsTrigger value="contar"    className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">Contar</TabsTrigger>
          <TabsTrigger value="relatorio" className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">Relatório</TabsTrigger>
        </TabsList>

        {/* Contar */}
        <TabsContent value="contar" className="mt-3 flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nome, código ou EAN..."
              className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
          </div>
          <div className="flex gap-1.5">
            {(["all","pending","counted"] as const).map(f => (
              <button key={f} onClick={() => setFilterMode(f)}
                className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  filterMode === f ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500")}>
                {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : "Contados"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {grouped.map(([group, groupItems]) => {
              const isOpen = expandedGroups.has(group);
              const groupCounted = groupItems.filter(i => counts[i.code] !== undefined).length;
              return (
                <div key={group} className="rounded-xl border border-slate-800 overflow-hidden">
                  <button onClick={() => toggleGroup(group)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-900/50 hover:bg-slate-800/50 transition-colors">
                    <span className="flex-1 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{group}</span>
                    <span className="text-xs text-slate-500">{groupCounted}/{groupItems.length}</span>
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                  {isOpen && groupItems.map(item => {
                    const isCounted = counts[item.code] !== undefined;
                    return (
                      <button key={item.code} onClick={() => setActiveItem(item)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 border-t border-slate-800/50 hover:bg-slate-800/40 transition-colors text-left">
                        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", isCounted ? "bg-emerald-400" : "bg-slate-600")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.code} · saldo: {item.saldo}</p>
                        </div>
                        {isCounted && <span className="text-sm font-bold text-indigo-300 shrink-0">{counts[item.code]}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">Nenhum item encontrado</p>
            )}
          </div>
        </TabsContent>

        {/* Relatório */}
        <TabsContent value="relatorio" className="mt-3">
          <ReportView items={items} counts={counts} session={session} />
        </TabsContent>
      </Tabs>

      <CountModal
        key={activeItem?.code ?? "none"}
        item={activeItem}
        currentQty={activeItem ? (counts[activeItem.code] ?? 0) : 0}
        onSave={qty => activeItem ? onCount(activeItem, qty) : Promise.resolve()}
        onClose={() => setActiveItem(null)}
      />
    </div>
  );
}

// ─── Home Screen ─────────────────────────────────────────────────────────────

function HomeScreen({ activeSession, isAdmin, currentUserId, fieldSessions, onNewSession, onSessions, onResume, onJoin }: {
  activeSession: InventorySessionRow | null;
  isAdmin: boolean;
  currentUserId: string | null;
  fieldSessions: InventorySessionRow[];
  onNewSession: () => void;
  onSessions: () => void;
  onResume: () => void;
  onJoin: (session: InventorySessionRow) => Promise<void>;
}) {
  const cards = [
    { icon: PlusCircle, label: "Nova Contagem", desc: "Importar estoque e iniciar inventário", color: "text-indigo-400", border: "hover:border-indigo-500/40", onClick: onNewSession },
    { icon: List,       label: "Sessões",        desc: "Ver sessões, relatórios e histórico",   color: "text-slate-300",  border: "hover:border-slate-600",      onClick: onSessions  },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Estoque</h1>
        <p className="text-sm text-slate-500">Gestão de inventário físico</p>
      </div>

      {/* Sessão própria ativa — admin pode retomar */}
      {isAdmin && activeSession && (
        <button onClick={onResume}
          className="w-full flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 hover:bg-emerald-500/10 transition-colors text-left">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Minha sessão ativa — {activeSession.counter_name}</p>
            <p className="text-xs text-emerald-400/80">{activeSession.counted_items}/{activeSession.item_count} itens · Toque para continuar</p>
          </div>
        </button>
      )}

      {/* Sessões de outros do campo — qualquer um pode participar */}
      {fieldSessions.filter(s => s.user_id !== currentUserId).map(s => (
        <button key={s.id} onClick={() => onJoin(s)}
          className="w-full flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-4 py-3 hover:bg-indigo-500/10 transition-colors text-left">
          <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Sessão de {s.counter_name}</p>
            <p className="text-xs text-indigo-400/80">{s.counted_items}/{s.item_count} itens contados · Toque para participar</p>
          </div>
          <span className="text-xs text-indigo-400 font-medium shrink-0">Participar →</span>
        </button>
      ))}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map(c => (
          <button key={c.label} onClick={c.onClick}
            className={`flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-5 ${c.border} hover:bg-slate-800/60 hover:border-slate-700 transition-all text-left`}>
            <c.icon className={`w-6 h-6 shrink-0 ${c.color}`} />
            <div>
              <p className="text-sm font-semibold text-white">{c.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{c.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sessions View ────────────────────────────────────────────────────────────

function SessionsView({ onBack, onViewReport }: {
  onBack: () => void;
  onViewReport: (s: InventorySessionRow) => void;
}) {
  const [sessions, setSessions] = useState<InventorySessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInventorySessions().then(setSessions).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 hover:text-white transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold text-white">Sessões</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhuma sessão encontrada</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map(s => (
            <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3 flex items-start gap-3">
              <div className={cn("mt-0.5 shrink-0", s.status === "active" ? "text-emerald-400" : "text-slate-500")}>
                {s.status === "active" ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{s.counter_name}</p>
                <p className="text-xs text-slate-500">{s.location || "Sem local"} · {fmtDate(s.started_at)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.counted_items}/{s.item_count} itens{s.campo ? ` · ${s.campo}` : ""}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5",
                  s.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400")}>
                  {s.status === "active" ? "Ativa" : "Encerrada"}
                </span>
                {s.counted_items > 0 && (
                  <button onClick={() => onViewReport(s)} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">
                    Ver relatório →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Session Report View ──────────────────────────────────────────────────────

function SessionReportView({ session, onBack }: { session: InventorySessionRow; onBack: () => void }) {
  const [countRows, setCountRows] = useState<InventoryCountRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessionCounts(session.id).then(setCountRows).catch(() => {}).finally(() => setLoading(false));
  }, [session.id]);

  const sessionItems = session.items as StockItem[];
  const countMap = new Map(countRows.map(c => [c.item_code, c.counted_qty]));

  const withCount = sessionItems
    .map(i => ({ ...i, counted: countMap.has(i.code) ? countMap.get(i.code)! : -1 }))
    .filter(i => i.counted >= 0);

  const sobras  = withCount.filter(i => i.counted > i.saldo);
  const faltas  = withCount.filter(i => i.counted < i.saldo);
  const matches = withCount.filter(i => i.counted === i.saldo);
  const totalSistema = sessionItems.reduce((s, i) => s + i.saldo * i.custo, 0);
  const totalContado = withCount.reduce((s, i) => s + i.counted * i.custo, 0);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(withCount.map(i => ({
      Grupo: i.group, Código: i.code, Nome: i.name,
      "Saldo Sistema": i.saldo, Contado: i.counted, Diferença: i.counted - i.saldo,
      "Custo Unit.": i.custo,
      "Valor Sistema": +(i.saldo * i.custo).toFixed(2),
      "Valor Contado": +(i.counted * i.custo).toFixed(2),
      Situação: i.counted > i.saldo ? "Sobra" : i.counted < i.saldo ? "Falta" : "OK",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contagem");
    XLSX.writeFile(wb, `relatorio_${session.counter_name.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 hover:text-white transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-white truncate">{session.counter_name}</p>
          <p className="text-xs text-slate-500 truncate">{session.location || "Sem local"} · {fmtDate(session.started_at)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportExcel} disabled={loading || withCount.length === 0}
          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs shrink-0">
          <Download className="w-3.5 h-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Excel</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : withCount.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhum item contado nesta sessão</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Itens contados", value: withCount.length, color: "text-white" },
                  { label: "Sobras",         value: sobras.length,    color: "text-emerald-400" },
                  { label: "Faltas",         value: faltas.length,    color: "text-red-400" },
                  { label: "Conferidos",     value: matches.length,   color: "text-indigo-400" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Valor sistema</span><span className="text-white">{fmtBRL(totalSistema)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Valor contado</span><span className="text-white">{fmtBRL(totalContado)}</span></div>
                <div className="flex justify-between border-t border-slate-800 pt-1.5 mt-0.5">
                  <span className="text-slate-400">Diferença</span>
                  <span className={totalContado - totalSistema >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtBRL(totalContado - totalSistema)}</span>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-xs min-w-[520px]">
                  <thead><tr className="border-b border-slate-800 bg-slate-900/70">
                    {["Produto", "Sistema", "Contado", "Dif.", "Situação"].map(h => (
                      <th key={h} className={cn("px-3 py-2 text-slate-400 font-medium", h === "Produto" ? "text-left" : "text-right")}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {withCount.map(i => (
                      <tr key={i.code} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-3 py-2">
                          <p className="text-white font-medium truncate max-w-[200px]">{i.name}</p>
                          <p className="text-slate-500">{i.group}</p>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300">{i.saldo}</td>
                        <td className="px-3 py-2 text-right text-white font-medium">{i.counted}</td>
                        <td className={cn("px-3 py-2 text-right font-medium",
                          i.counted - i.saldo > 0 ? "text-emerald-400" : i.counted - i.saldo < 0 ? "text-red-400" : "text-slate-500")}>
                          {i.counted - i.saldo > 0 ? "+" : ""}{i.counted - i.saldo}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
                            i.counted > i.saldo ? "bg-emerald-500/20 text-emerald-400" :
                            i.counted < i.saldo ? "bg-red-500/20 text-red-400" :
                                                  "bg-slate-700 text-slate-400")}>
                            {i.counted > i.saldo ? "Sobra" : i.counted < i.saldo ? "Falta" : "OK"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EstoquePage() {
  const { campo, displayName, isAdmin } = useUserRole();

  const [view, setView] = useState<"loading" | "home" | "setup" | "counting" | "sessions" | "session-report">("loading");
  const [activeSession, setActiveSession] = useState<InventorySessionRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [fieldSessions, setFieldSessions] = useState<InventorySessionRow[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reportSession, setReportSession] = useState<InventorySessionRow | null>(null);

  useEffect(() => {
    Promise.all([
      getActiveInventorySession(),
      getActiveFieldSessions(),
    ]).then(async ([ownSession, allActive]) => {
      // Guarda userId do token
      const { data: { session: auth } } = await supabase.auth.getSession();
      if (auth) setCurrentUserId(auth.user.id);

      setFieldSessions(allActive);

      if (ownSession) {
        setActiveSession(ownSession);
        const sessionItems = (ownSession.items ?? []) as StockItem[];
        if (sessionItems.length > 0) {
          const countRows = await getSessionCounts(ownSession.id).catch(() => []);
          const map: Record<string, number> = {};
          for (const r of countRows) map[r.item_code] = r.counted_qty;
          setItems(sessionItems);
          setCounts(map);
        }
      }
      setView("home");
    }).catch(() => setView("home"));
  }, []);

  const handleStart = async ({ counterName, location, items: loadedItems }: { counterName: string; location: string; items: StockItem[] }) => {
    if (activeSession) await completeInventorySession(activeSession.id).catch(() => {});
    const session = await createInventorySession({ counterName, location, campo, itemCount: loadedItems.length, items: loadedItems });
    setActiveSession(session); setItems(loadedItems); setCounts({}); setView("counting");
  };

  const handleJoin = async (session: InventorySessionRow) => {
    const sessionItems = (session.items ?? []) as StockItem[];
    const countRows = await getSessionCounts(session.id).catch(() => []);
    const map: Record<string, number> = {};
    for (const r of countRows) map[r.item_code] = r.counted_qty;
    setActiveSession(session);
    setItems(sessionItems);
    setCounts(map);
    setView("counting");
  };

  const handleCount = useCallback(async (item: StockItem, qty: number) => {
    if (!activeSession) return;
    await upsertInventoryCount({ sessionId: activeSession.id, itemCode: item.code, itemName: item.name, groupName: item.group, saldo: item.saldo, custo: item.custo, qty });
    setCounts(prev => {
      const next = { ...prev, [item.code]: qty };
      updateInventorySessionProgress(activeSession.id, Object.keys(next).length).catch(() => {});
      return next;
    });
  }, [activeSession]);

  const handleEnd = useCallback(async (isOwner: boolean) => {
    if (!activeSession) return;
    if (isOwner) await completeInventorySession(activeSession.id);
    setActiveSession(null); setItems([]); setCounts({}); setView("home");
  }, [activeSession]);

  if (view === "loading") return (
    <div className="flex h-48 items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (view === "counting" && activeSession)
    return (
      <div className="animate-fade-in">
        <CountingScreen
          session={activeSession} items={items} counts={counts}
          isOwner={activeSession.user_id === currentUserId}
          onCount={handleCount} onEnd={handleEnd}
          onBack={() => setView("home")}
        />
      </div>
    );

  if (view === "setup")
    return <div className="animate-fade-in"><SetupScreen displayName={displayName} onStart={handleStart} onBack={() => setView("home")} /></div>;

  if (view === "sessions")
    return <div className="animate-fade-in"><SessionsView onBack={() => setView("home")} onViewReport={s => { setReportSession(s); setView("session-report"); }} /></div>;

  if (view === "session-report" && reportSession)
    return <div className="animate-fade-in"><SessionReportView session={reportSession} onBack={() => setView("sessions")} /></div>;

  return (
    <div className="animate-fade-in">
      <HomeScreen
        activeSession={activeSession}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        fieldSessions={fieldSessions}
        onNewSession={() => setView("setup")}
        onSessions={() => setView("sessions")}
        onResume={() => items.length > 0 ? setView("counting") : setView("setup")}
        onJoin={handleJoin}
      />
    </div>
  );
}
