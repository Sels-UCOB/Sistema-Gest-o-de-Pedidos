"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { useLancamentoLider } from "@/lib/campanhas/context/LancamentoLiderContext";
import { useDebitos } from "@/lib/campanhas/context/DebitosContext";
import { calcularResumoLider, calcularTotalDevedores } from "@/lib/campanhas/calcularDebitos";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";

export function ResumoLideresTabela() {
  const { state } = useAcerto();
  const { cartaBolsa } = useLancamentoLider();
  const { devedores, gastosLideres } = useDebitos();

  const compraBonificada = state.dadosImportados?.bonificado ?? 0;
  const numLideres = state.config.numLideres ?? 1;

  const resumos = useMemo(() => {
    const totalDevedores = calcularTotalDevedores(devedores);
    return Array.from({ length: numLideres }, (_, i) => state.config.lideres[i])
      .filter((l) => l.nome.trim())
      .map((lider, idx) => calcularResumoLider({ lider, percentualDebito: lider.percentualDebito ?? 0, totalDevedores, gastosLider: gastosLideres[idx], compraBonificada, cartaBolsaValor: cartaBolsa.valor, cartaBolsaReceptor: cartaBolsa.liderReceptor }));
  }, [state.config, devedores, gastosLideres, compraBonificada, cartaBolsa, numLideres]);

  if (resumos.length === 0) {
    return (
      <section className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-6">
        <h2 className="text-base font-semibold text-white mb-4">Resumo dos Líderes</h2>
        <p className="text-sm text-[#8B8FA8]">Nenhum líder configurado.</p>
      </section>
    );
  }

  const thCls = "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]";
  const tdNum = "px-4 py-3 text-right text-sm tabular-nums";

  return (
    <section className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-6">
      <h2 className="text-base font-semibold text-white mb-4">Resumo dos Líderes</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2F45]">
              <th className={cn(thCls, "text-left")}>Líder</th>
              {["Bruto", "Débitos", "Dízimo", "INSS", "IRPF", "Carta", "Saldo final"].map((h) => (
                <th key={h} className={cn(thCls, "text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumos.map((r) => (
              <tr key={r.nome} className="border-b border-[#2A2F45]/50 last:border-0 hover:bg-[#2A2F45]/20 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-white">{r.nome}</td>
                <td className={cn(tdNum, "text-white")}>{formatarBRL(r.totalBruto)}</td>
                <td className={cn(tdNum, "text-red-400")}>{r.totalDebitos > 0 ? `−${formatarBRL(r.totalDebitos)}` : "—"}</td>
                <td className={cn(tdNum, "text-red-400")}>−{formatarBRL(r.dizimo)}</td>
                <td className={cn(tdNum, "text-red-400")}>−{formatarBRL(r.inss)}</td>
                <td className={cn(tdNum, "text-red-400")}>{r.irpf > 0 ? `−${formatarBRL(r.irpf)}` : "—"}</td>
                <td className={cn(tdNum, r.carta > 0 ? "text-red-400" : "text-[#8B8FA8]")}>{r.carta > 0 ? `−${formatarBRL(r.carta)}` : "—"}</td>
                <td className={cn(tdNum, "font-bold", r.saldoFinal < 0 ? "text-red-400" : "text-green-400")}>{formatarBRL(r.saldoFinal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
