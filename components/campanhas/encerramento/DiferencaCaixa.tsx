"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { useLancamento } from "@/lib/campanhas/context/LancamentoContext";
import { useLancamentoLider } from "@/lib/campanhas/context/LancamentoLiderContext";
import { useDebitos } from "@/lib/campanhas/context/DebitosContext";
import { calcularSaldos } from "@/lib/campanhas/calcularSaldos";
import { calcularResumoLider, calcularTotalDevedores } from "@/lib/campanhas/calcularDebitos";
import { FPC_PERCENTUAL } from "@/lib/campanhas/config/impostos";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";

function arred(n: number) { return Math.round(n * 100) / 100; }

const Row = ({ label, value, variant }: { label: string; value: string; variant?: "positive" | "negative" | "subtotal" }) => (
  <div className={cn("flex items-center justify-between py-2", variant === "subtotal" && "border-t border-[#2A2F45] mt-1 pt-3")}>
    <span className="text-sm text-[#8B8FA8]">{label}</span>
    <span className={cn("text-sm font-medium tabular-nums",
      variant === "positive" ? "text-green-400" :
      variant === "negative" ? "text-red-400" :
      "text-white"
    )}>{value}</span>
  </div>
);

export function DiferencaCaixa() {
  const { state } = useAcerto();
  const { lancamentos } = useLancamento();
  const { cartaBolsa, jurosCampanha } = useLancamentoLider();
  const { devedores, gastosLideres, gastosCaixa } = useDebitos();

  const compraBonificada = state.dadosImportados?.bonificado ?? 0;
  const numLideres = state.config.numLideres ?? 1;
  const salarioCaixa = state.config.caixa.salarioCaixa ?? 0;

  const calculo = useMemo(() => {
    const saldos = calcularSaldos(lancamentos);
    const saldoInicial = saldos.length > 0 ? saldos[saldos.length - 1] : 0;
    const fpc = arred(compraBonificada * FPC_PERCENTUAL);
    const juros = jurosCampanha ?? 0;
    const base = arred(saldoInicial + salarioCaixa - fpc + juros);
    const totalDevedores = calcularTotalDevedores(devedores);
    const lideres = Array.from({ length: numLideres }, (_, i) => state.config.lideres[i]).filter((l) => l.nome.trim());
    const totalDebitosLideres = arred(lideres.reduce((s, lider, idx) => s + calcularResumoLider({ lider, percentualDebito: lider.percentualDebito ?? 0, totalDevedores, gastosLider: gastosLideres[idx], compraBonificada, cartaBolsaValor: cartaBolsa.valor, cartaBolsaReceptor: cartaBolsa.liderReceptor }).totalDebitos, 0));
    const totalDebitosCaixa = arred(gastosCaixa.gastos + gastosCaixa.debitosAdicionais.reduce((s, d) => s + d.valor, 0));
    const totalDebitos = arred(totalDebitosLideres + totalDebitosCaixa);
    return { saldoInicial, salarioCaixa, fpc, juros, base, totalDebitosLideres, totalDebitosCaixa, totalDebitos, diferenca: arred(totalDebitos - base), temJuros: jurosCampanha !== null };
  }, [lancamentos, compraBonificada, salarioCaixa, jurosCampanha, devedores, gastosLideres, gastosCaixa, cartaBolsa, state.config, numLideres]);

  return (
    <section className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-6">
      <h2 className="text-base font-semibold text-white mb-4">Diferença de Caixa</h2>

      <div className="space-y-0 divide-y divide-[#2A2F45]/30">
        <div className="pb-3 space-y-0">
          <Row label="Total débitos líderes" value={calculo.totalDebitosLideres > 0 ? formatarBRL(calculo.totalDebitosLideres) : "—"} />
          <Row label="Total débitos caixa" value={calculo.totalDebitosCaixa > 0 ? formatarBRL(calculo.totalDebitosCaixa) : "—"} />
          <Row label="Total débitos" value={formatarBRL(calculo.totalDebitos)} variant="subtotal" />
        </div>

        <div className="py-3 space-y-0">
          <Row label="Saldo final (Lançamentos)" value={formatarBRL(calculo.saldoInicial)} />
          {calculo.salarioCaixa > 0 && <Row label="Salário Caixa" value={`+${formatarBRL(calculo.salarioCaixa)}`} variant="positive" />}
          <Row label="2% Bonificação (FPC)" value={`−${formatarBRL(calculo.fpc)}`} variant="negative" />
          {calculo.temJuros && (
            <Row
              label="Juros Campanha"
              value={calculo.juros >= 0 ? `+${formatarBRL(calculo.juros)}` : `−${formatarBRL(Math.abs(calculo.juros))}`}
              variant={calculo.juros >= 0 ? "positive" : "negative"}
            />
          )}
          <Row label={`Base ${calculo.temJuros ? "(após Juros Campanha)" : "(após FPC)"}`} value={`−${formatarBRL(calculo.base)}`} variant="subtotal" />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[#2A2F45] flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Diferença de caixa</span>
        <span className={cn("text-lg font-bold tabular-nums", calculo.diferenca < 0 ? "text-red-400" : "text-green-400")}>
          {formatarBRL(calculo.diferenca)}
        </span>
      </div>
    </section>
  );
}
