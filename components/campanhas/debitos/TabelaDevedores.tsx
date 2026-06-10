"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useDebitos } from "@/lib/campanhas/context/DebitosContext";
import { calcularTotalDevedores } from "@/lib/campanhas/calcularDebitos";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import { AbaPercentualDebitos } from "./AbaPercentualDebitos";

const inputCls = "rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors placeholder:text-[#8B8FA8]/50";

export function TabelaDevedores() {
  const { devedores, encerrado, addDevedor, updateDevedor, removeDevedor, salvar } = useDebitos();
  const total = calcularTotalDevedores(devedores);
  const [salvo, setSalvo] = useState(false);

  const handleSalvar = useCallback(() => {
    if (encerrado) return;
    salvar();
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }, [salvar, encerrado]);

  return (
    <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Débitos de Colportores</h3>
        {!encerrado && (
          <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white transition-colors" onClick={addDevedor}>
            + Adicionar
          </button>
        )}
      </div>

      {devedores.length === 0 ? (
        <p className="text-sm text-[#8B8FA8]">Nenhum devedor registrado.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">
            <span className="flex-1">Nome</span>
            <span className="w-24 text-right">Valor</span>
            {!encerrado && <span className="w-6"></span>}
          </div>
          {devedores.map((d) => (
            <div key={d.id} className="flex items-center gap-2">
              <input className={cn(inputCls, "flex-1 min-w-0", encerrado && "opacity-50 cursor-not-allowed")} type="text" placeholder="Nome do colportor" value={d.nome} onChange={(e) => updateDevedor(d.id, { nome: e.target.value })} disabled={encerrado} />
              <input
                className={cn(inputCls, "w-28 shrink-0 text-right", encerrado && "opacity-50 cursor-not-allowed")}
                type="number" placeholder="0,00" min={0} step="0.01"
                value={d.valorDebito || ""}
                onChange={(e) => updateDevedor(d.id, { valorDebito: parseFloat(e.target.value) || 0 })}
                disabled={encerrado}
              />
              {!encerrado && <button type="button" className="w-6 h-6 rounded-md flex items-center justify-center text-[#8B8FA8] hover:text-red-400 hover:bg-red-500/10 transition-colors text-base leading-none" onClick={() => removeDevedor(d.id)} title="Remover">×</button>}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-[#2A2F45]">
        <span className="text-xs font-semibold text-[#8B8FA8]">Total débitos</span>
        <span className="text-sm font-bold text-white tabular-nums">{formatarBRL(total)}</span>
      </div>

      {devedores.length > 1 && (
        <div className="pt-2 border-t border-[#2A2F45]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] mb-3">Percentual por líder</p>
          <AbaPercentualDebitos />
        </div>
      )}

      {!encerrado && (
        <div className="flex justify-end">
          <button
            type="button"
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", salvo ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-[#6C63FF] text-white hover:bg-[#5A52E8]")}
            onClick={handleSalvar}
          >
            {salvo ? "Salvo ✓" : "Salvar alterações"}
          </button>
        </div>
      )}
    </div>
  );
}
