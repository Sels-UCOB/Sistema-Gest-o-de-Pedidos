"use client";

import React, { useMemo } from "react";
import { useLancamento } from "@/lib/campanhas/context/LancamentoContext";
import { useConfiguracao } from "@/lib/campanhas/context/ConfiguracaoContext";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";

export function ResumoCampanha() {
  const { lancamentos } = useLancamento();
  const { tipos } = useConfiguracao();

  const { grupos, totalGeral } = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of lancamentos) {
      if (!l.tipoLancamentoId || l.valor === null) continue;
      mapa.set(l.tipoLancamentoId, (mapa.get(l.tipoLancamentoId) ?? 0) + l.valor);
    }
    const grupos = Array.from(mapa.entries()).map(([id, total]) => ({ nome: tipos.find((t) => t.id === id)?.nome ?? id, total }));
    return { grupos, totalGeral: grupos.reduce((s, g) => s + g.total, 0) };
  }, [lancamentos, tipos]);

  return (
    <section className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-6">
      <h2 className="text-base font-semibold text-white mb-4">Resumo da Campanha</h2>

      {grupos.length === 0 ? (
        <p className="text-sm text-[#8B8FA8]">Nenhum lançamento registrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2F45]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Tipo de lançamento</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Total</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.nome} className="border-b border-[#2A2F45]/50 hover:bg-[#2A2F45]/20 transition-colors">
                  <td className="px-4 py-3 text-[#8B8FA8]">{g.nome}</td>
                  <td className="px-4 py-3 text-right text-white font-medium tabular-nums">{formatarBRL(g.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#2A2F45]">
                <td className="px-4 py-3 text-sm font-semibold text-white">Total geral</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-[#6C63FF] tabular-nums">{formatarBRL(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
