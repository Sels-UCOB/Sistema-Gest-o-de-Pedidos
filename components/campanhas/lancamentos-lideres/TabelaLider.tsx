"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useLancamentoLider } from "@/lib/campanhas/context/LancamentoLiderContext";
import { useLancamento } from "@/lib/campanhas/context/LancamentoContext";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { gerarLinhasLider } from "@/lib/campanhas/gerarLinhasLider";
import { calcularSaldosLider } from "@/lib/campanhas/calcularSaldosLider";
import { calcularSaldos } from "@/lib/campanhas/calcularSaldos";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import { MIN_COLPORTORES_POR_LIDER } from "@/lib/campanhas/config/app";
import { ModalDetalhe } from "./ModalDetalhe";
import type { LinhaTabela } from "@/lib/campanhas/types/lancamentoLider";

function formatDC(valor: number): string {
  if (valor === 0) return "—";
  const abs = formatarBRL(Math.abs(valor));
  return valor > 0 ? `+${abs}` : `-${abs}`;
}

export function TabelaLider() {
  const { cartaBolsa, jurosCampanha } = useLancamentoLider();
  const { lancamentos } = useLancamento();
  const { state } = useAcerto();
  const { salarioCaixa } = state.config.caixa;
  const numLideres = state.config.numLideres;
  const totalColportores = state.dadosImportados?.nomes.length ?? 0;
  const minPorLider = MIN_COLPORTORES_POR_LIDER[state.config.tipoCampanha] ?? null;
  const proporcaoInsuficiente = minPorLider !== null && totalColportores > 0 && totalColportores / numLideres < minPorLider;

  const configs = state.config.lideres.filter((l) => l.nome.trim()).map((l) => ({ nome: l.nome, bonificacaoPercentual: l.bonificacaoPercentual, auxilioPercentual: l.auxilioPercentual }));
  const caixaConfig = state.config.caixa.nome.trim() ? { nome: state.config.caixa.nome, auxilioPercentual: state.config.caixa.auxilioPercentual } : null;
  const [modalLinha, setModalLinha] = useState<LinhaTabela | null>(null);
  const compraBonificada = state.dadosImportados?.bonificado ?? 0;

  const saldosLancamentos = useMemo(() => calcularSaldos(lancamentos), [lancamentos]);
  const saldoInicial = saldosLancamentos.length > 0 ? saldosLancamentos[saldosLancamentos.length - 1] : 0;

  const linhas = useMemo(() => gerarLinhasLider({ configs, cartaBolsa, compraBonificada, jurosCampanha, salarioCaixa, caixaConfig }), [configs, cartaBolsa, compraBonificada, jurosCampanha, salarioCaixa]);
  const saldos = useMemo(() => calcularSaldosLider(linhas, saldoInicial), [linhas, saldoInicial]);
  const saldoFinal = saldos.length > 0 ? saldos[saldos.length - 1] : saldoInicial;

  return (
    <div className="space-y-3">
      {modalLinha && <ModalDetalhe linha={modalLinha} onFechar={() => setModalLinha(null)} />}

      {proporcaoInsuficiente && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <span className="font-bold shrink-0">!</span>
          <span>
            Proporção insuficiente: {totalColportores} colportor{totalColportores !== 1 ? "es" : ""} para {numLideres} líder{numLideres !== 1 ? "es" : ""} — mínimo: {minPorLider} por líder ({numLideres * (minPorLider ?? 0)} total).
          </span>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#1A1F2E] border border-[#2A2F45]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Saldo herdado da campanha</span>
        <span className={cn("text-sm font-bold tabular-nums", saldoInicial < 0 ? "text-red-400" : "text-[#6C63FF]")}>{formatarBRL(saldoInicial)}</span>
      </div>

      <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2F45]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Descrição</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">D/C</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, idx) => {
                const saldo = saldos[idx] ?? saldoInicial;

                if (linha.tipo === "header") {
                  return (
                    <tr key={linha.id} className="bg-[#6C63FF]/5">
                      <td colSpan={3} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6C63FF]">{linha.descricao}</td>
                    </tr>
                  );
                }

                const isSalario = linha.tipo === "salarioCaixa";
                const isFpc = linha.tipo === "fpc";

                return (
                  <tr
                    key={linha.id}
                    className={cn(
                      "border-b border-[#2A2F45]/50 last:border-0 transition-colors",
                      linha.clicavel && "cursor-pointer hover:bg-[#2A2F45]/30",
                      isFpc && "opacity-70",
                    )}
                    onClick={linha.clicavel ? () => setModalLinha(linha) : undefined}
                    title={linha.clicavel ? "Clique para ver detalhes" : undefined}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm", isFpc ? "text-[#8B8FA8]" : "text-white")}>{linha.descricao}</span>
                        {linha.clicavel && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#6C63FF]/15 text-[#6C63FF]">detalhes</span>}
                        {isSalario && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2A2F45] text-[#8B8FA8]">fora do saldo</span>}
                      </div>
                    </td>
                    <td className={cn("px-4 py-2.5 text-right text-sm tabular-nums font-medium", linha.valor < 0 ? "text-red-400" : "text-green-400")}>
                      {formatDC(linha.valor)}
                    </td>
                    <td className={cn("px-4 py-2.5 text-right text-sm tabular-nums", saldo < 0 ? "text-red-400" : "text-white")}>
                      {linha.excluirDoSaldo ? <span className="text-[#2A2F45]">—</span> : formatarBRL(saldo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <span className={cn("text-sm font-medium", saldoFinal < 0 ? "text-red-400" : "text-white")}>
          Saldo final: <strong>{formatarBRL(saldoFinal)}</strong>
        </span>
      </div>
    </div>
  );
}
