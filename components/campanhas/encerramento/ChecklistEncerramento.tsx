"use client";

import { ClipboardCheck, CheckCircle2, Circle } from "lucide-react";
import type { ChecklistItem, ChecklistProgresso } from "@/lib/campanhas/types/checklist";
import { CHECKLIST_PADRAO } from "@/lib/campanhas/types/checklist";

interface Props {
  itens: ChecklistItem[];
  loading: boolean;
  todosMarcados: boolean;
  progresso: ChecklistProgresso;
  onToggle: (itemKey: string) => void;
  encerrado: boolean;
}

export function ChecklistEncerramento({ itens, loading, todosMarcados, progresso, onToggle, encerrado }: Props) {
  const verificacoes = itens.filter((i) => CHECKLIST_PADRAO.find((p) => p.itemKey === i.itemKey)?.grupo === "verificacao");
  const anexos = itens.filter((i) => CHECKLIST_PADRAO.find((p) => p.itemKey === i.itemKey)?.grupo === "anexo");
  const percentual = progresso.total > 0 ? Math.round((progresso.marcados / progresso.total) * 100) : 0;

  if (loading) {
    return (
      <div className="rounded-xl bg-[#14172B] border border-[#2A2F45] p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-[#2A2F45] animate-pulse" />
          <div className="h-4 w-44 bg-[#2A2F45] rounded animate-pulse" />
        </div>
        <div className="h-1.5 bg-[#2A2F45] rounded-full mb-6 animate-pulse" />
        <div className="grid sm:grid-cols-2 gap-6">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-2.5">
              <div className="h-3 w-24 bg-[#2A2F45] rounded animate-pulse mb-3" />
              {Array.from({ length: col === 0 ? 7 : 9 }).map((_, i) => (
                <div key={i} className="h-4 bg-[#2A2F45] rounded animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-6 transition-colors duration-300 ${
      todosMarcados
        ? "bg-green-500/5 border-green-500/20"
        : "bg-[#14172B] border-[#2A2F45]"
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className={`w-5 h-5 shrink-0 ${todosMarcados ? "text-green-400" : "text-[#6C63FF]"}`} />
          <h3 className="text-sm font-semibold text-white">Checklist de Encerramento</h3>
          {encerrado && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#2A2F45] text-[#8B8FA8]">somente leitura</span>
          )}
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          todosMarcados
            ? "bg-green-500/15 text-green-400"
            : "bg-[#2A2F45] text-[#8B8FA8]"
        }`}>
          {progresso.marcados}/{progresso.total} concluídos
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="mb-6">
        <div className="h-1.5 rounded-full bg-[#2A2F45] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              todosMarcados ? "bg-green-500" : "bg-[#6C63FF]"
            }`}
            style={{ width: `${percentual}%` }}
          />
        </div>
      </div>

      {/* Grupos */}
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
        <ItemGroup titulo="Verificações" itens={verificacoes} onToggle={onToggle} disabled={encerrado} />
        <ItemGroup titulo="Anexos" itens={anexos} onToggle={onToggle} disabled={encerrado} />
      </div>
    </div>
  );
}

function ItemGroup({
  titulo,
  itens,
  onToggle,
  disabled,
}: {
  titulo: string;
  itens: ChecklistItem[];
  onToggle: (itemKey: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#8B8FA8] uppercase tracking-wider mb-3">{titulo}</p>
      <div className="space-y-1">
        {itens.map((item) => (
          <ChecklistItemRow key={item.itemKey} item={item} onToggle={onToggle} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

function ChecklistItemRow({
  item,
  onToggle,
  disabled,
}: {
  item: ChecklistItem;
  onToggle: (itemKey: string) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(item.itemKey)}
      disabled={disabled}
      className={`w-full flex items-start gap-2.5 text-left rounded-lg px-2.5 py-2 transition-colors group ${
        disabled
          ? "cursor-default"
          : item.marcado
          ? "hover:bg-green-500/5"
          : "hover:bg-white/5 cursor-pointer"
      }`}
    >
      {item.marcado ? (
        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
      ) : (
        <Circle className={`w-4 h-4 shrink-0 mt-0.5 transition-colors ${
          disabled ? "text-[#4A4F6A]" : "text-[#4A4F6A] group-hover:text-[#6C63FF]"
        }`} />
      )}
      <span className={`text-sm leading-snug ${
        item.marcado ? "text-[#6B7280]" : "text-white"
      }`}>
        {item.descricao}
      </span>
    </button>
  );
}
