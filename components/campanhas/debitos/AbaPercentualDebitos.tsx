"use client";

import { cn } from "@/lib/utils";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { calcularPercentuaisProporcional } from "@/lib/campanhas/calcularDebitos";

export function AbaPercentualDebitos() {
  const { state, encerrado, updateLiderPercentual, setConfig } = useAcerto();
  const numLideres = state.config.numLideres ?? 1;
  const lideres = Array.from({ length: numLideres }, (_, i) => state.config.lideres[i]).filter((l) => l.nome.trim());

  if (lideres.length === 0) {
    return <p className="text-sm text-[#8B8FA8]">Nenhum líder configurado.</p>;
  }

  const soma = lideres.reduce((s, l) => s + (l.percentualDebito ?? 0), 0);
  const somaErro = Math.abs(soma - 100) > 0.01;

  const handleProporcional = () => {
    if (encerrado) return;
    const proporcional = calcularPercentuaisProporcional(state.config.lideres, numLideres);
    const novasLideres = state.config.lideres.map((l, i) =>
      i < numLideres ? { ...l, percentualDebito: proporcional[i] } : l
    ) as typeof state.config.lideres;
    setConfig({ lideres: novasLideres });
  };

  const inputCls = "w-20 rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-2 py-1.5 text-right focus:outline-none focus:border-[#6C63FF] transition-colors";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">
        <span>Líder</span>
        <span>%</span>
      </div>

      {lideres.map((lider, idx) => (
        <div key={lider.nome} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#0F1117] border border-[#2A2F45]">
          <span className="text-sm text-white truncate" title={lider.nome}>{lider.nome}</span>
          <input
            type="number"
            className={cn(inputCls, encerrado && "opacity-50 cursor-not-allowed")}
            min={0} max={100} step="0.1"
            value={lider.percentualDebito ?? 0}
            onChange={(e) => updateLiderPercentual(idx, parseFloat(e.target.value) || 0)}
            disabled={encerrado}
          />
        </div>
      ))}

      <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2F45]">
        <span className="text-xs font-semibold text-[#8B8FA8]">Soma</span>
        <span className={cn("text-sm font-bold tabular-nums", somaErro ? "text-red-400" : "text-green-400")}>
          {soma.toFixed(2)}%
        </span>
      </div>

      {somaErro && <p className="text-xs text-red-400 px-1">A soma deve ser 100%.</p>}

      {!encerrado && (
        <button
          type="button"
          className="w-full py-2 rounded-lg text-xs font-semibold text-[#8B8FA8] hover:text-white border border-[#2A2F45] hover:border-[#6C63FF]/50 transition-colors"
          onClick={handleProporcional}
        >
          Calcular proporcional
        </button>
      )}
    </div>
  );
}
