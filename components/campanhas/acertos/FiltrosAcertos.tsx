"use client";

import type { FiltrosAcerto } from "@/lib/campanhas/types/acertoManager";

const CAMPOS = ["todos", "ALM", "AOM", "ASM", "ABC", "APLAC", "MTO", "IDEC", "Outro"] as const;
const TIPOS = ["todos", "Sonhando Alto 1", "Sonhando Alto 2", "Verão", "Inverno", "Outro"] as const;
const STATUS = ["todos", "Criado", "Em Aberto", "Encerrado"] as const;

const inputCls = "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors";
const labelCls = "block text-xs font-medium text-[#8B8FA8] mb-1";

interface Props {
  filtros: FiltrosAcerto;
  onChange: (filtros: FiltrosAcerto) => void;
}

const FILTROS_LIMPOS: FiltrosAcerto = { status: "todos", campo: "todos", tipoCampanha: "todos", dataInicio: "", dataFim: "" };

export function FiltrosAcertos({ filtros, onChange }: Props) {
  const set = <K extends keyof FiltrosAcerto>(key: K, value: FiltrosAcerto[K]) =>
    onChange({ ...filtros, [key]: value });

  const sujo = Object.values(filtros).some((v) => v !== "todos" && v !== "");

  return (
    <div className="rounded-xl bg-[#1A1F2E] border border-[#2A2F45] p-4 flex flex-wrap gap-3 items-end">
      <div className="min-w-32.5">
        <label className={labelCls}>Status</label>
        <select className={inputCls} value={filtros.status} onChange={(e) => set("status", e.target.value as FiltrosAcerto["status"])}>
          {STATUS.map((s) => <option key={s} value={s}>{s === "todos" ? "Todos os status" : s}</option>)}
        </select>
      </div>

      <div className="min-w-30">
        <label className={labelCls}>Campo</label>
        <select className={inputCls} value={filtros.campo} onChange={(e) => set("campo", e.target.value)}>
          {CAMPOS.map((c) => <option key={c} value={c}>{c === "todos" ? "Todos os campos" : c}</option>)}
        </select>
      </div>

      <div className="min-w-40">
        <label className={labelCls}>Tipo de Campanha</label>
        <select className={inputCls} value={filtros.tipoCampanha} onChange={(e) => set("tipoCampanha", e.target.value)}>
          {TIPOS.map((t) => <option key={t} value={t}>{t === "todos" ? "Todos os tipos" : t}</option>)}
        </select>
      </div>

      <div className="min-w-32.5">
        <label className={labelCls}>De</label>
        <input type="date" className={inputCls} value={filtros.dataInicio} onChange={(e) => set("dataInicio", e.target.value)} />
      </div>

      <div className="min-w-32.5">
        <label className={labelCls}>Até</label>
        <input type="date" className={inputCls} value={filtros.dataFim} onChange={(e) => set("dataFim", e.target.value)} />
      </div>

      {sujo && (
        <button
          type="button"
          className="px-3 py-2 rounded-lg text-sm text-[#8B8FA8] hover:text-white border border-[#2A2F45] hover:border-[#6C63FF]/50 transition-colors"
          onClick={() => onChange(FILTROS_LIMPOS)}
        >
          Limpar
        </button>
      )}
    </div>
  );
}
