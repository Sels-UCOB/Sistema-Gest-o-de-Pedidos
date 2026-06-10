"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useDebitos } from "@/lib/campanhas/context/DebitosContext";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { useLancamentoLider } from "@/lib/campanhas/context/LancamentoLiderContext";
import { calcularTotalDevedores, calcularResumoLider } from "@/lib/campanhas/calcularDebitos";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";

const inputCls = "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors placeholder:text-[#8B8FA8]/50";
const inputSmCls = "rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-2 py-1.5 focus:outline-none focus:border-[#6C63FF] transition-colors placeholder:text-[#8B8FA8]/50";

function RfLinha({ label, valor, positivo }: { label: string; valor: number; positivo?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#2A2F45]/40 last:border-0">
      <span className="text-sm text-[#8B8FA8]">{label}</span>
      <span className={cn("text-sm tabular-nums font-medium", positivo ? "text-green-400" : "text-red-400")}>
        {positivo ? "" : "−"}{formatarBRL(Math.abs(valor))}
      </span>
    </div>
  );
}

export function ResumoLideres() {
  const { state } = useAcerto();
  const { cartaBolsa } = useLancamentoLider();
  const {
    devedores,
    gastosLideres,
    setGastosLider,
    addDebitoAdicional,
    updateDebitoAdicional,
    removeDebitoAdicional,
    gastosCaixa,
    setGastosCaixa,
    addDebitoAdicionalCaixa,
    updateDebitoAdicionalCaixa,
    removeDebitoAdicionalCaixa,
  } = useDebitos();

  const [expandidos, setExpandidos] = useState<Record<number, boolean>>({});

  const possuiVeiculoSPA = state.config.lideres[0]?.possuiVeiculoSPA ?? false;

  useEffect(() => {
    const gastos0 = gastosLideres[0];
    if (!gastos0) return;
    const entry = gastos0.debitosAdicionais.find((d) => d.descricao === "Seguro Veículo");
    if (possuiVeiculoSPA && !entry) {
      addDebitoAdicional(0, { descricao: "Seguro Veículo", valor: 0 });
    } else if (!possuiVeiculoSPA && entry) {
      removeDebitoAdicional(0, entry.id);
    }
  }, [possuiVeiculoSPA, gastosLideres, addDebitoAdicional, removeDebitoAdicional]);

  const compraBonificada = state.dadosImportados?.bonificado ?? 0;
  const totalDevedores = useMemo(() => calcularTotalDevedores(devedores), [devedores]);

  const numLideres = state.config.numLideres ?? 1;
  const lideres = Array.from({ length: numLideres }, (_, i) => state.config.lideres[i]).filter((l) => l.nome.trim());
  const caixa = state.config.caixa;
  const temCaixa = caixa.nome.trim().length > 0;

  if (lideres.length === 0 && !temCaixa) {
    return <p className="text-sm text-[#8B8FA8] px-1">Nenhum líder configurado.</p>;
  }

  const toggleExpandido = (idx: number) => setExpandidos((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const salarioCaixa = caixa.salarioCaixa ?? 0;
  const auxilioCaixa = Math.round((caixa.auxilioPercentual / 100) * compraBonificada * 100) / 100;
  const totalBrutoCaixa = Math.round((salarioCaixa + auxilioCaixa) * 100) / 100;
  const totalGastosCaixa = Math.round((gastosCaixa.gastos + gastosCaixa.debitosAdicionais.reduce((s, d) => s + d.valor, 0)) * 100) / 100;
  const saldoCaixa = Math.round((totalBrutoCaixa - totalGastosCaixa) * 100) / 100;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[#8B8FA8]">Resumo dos Líderes</h3>
      <div className="space-y-4">

        {/* Leader cards */}
        {lideres.map((lider, idx) => {
          const resumo = calcularResumoLider({
            lider,
            percentualDebito: lider.percentualDebito ?? 0,
            totalDevedores,
            gastosLider: gastosLideres[idx],
            compraBonificada,
            cartaBolsaValor: cartaBolsa.valor,
            cartaBolsaReceptor: cartaBolsa.liderReceptor,
          });

          const gastosConfig = gastosLideres[idx];
          const expandido = expandidos[idx] ?? false;

          return (
            <div key={lider.nome} className="w-full rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-white">{lider.nome}</span>
              </div>

              {/* Gastos do líder */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Gastos do líder</label>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="R$ 0,00"
                  min={0}
                  step="0.01"
                  value={gastosConfig.gastos || ""}
                  onChange={(e) => setGastosLider(idx, parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Débitos de colportores */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Débitos de colportores</span>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-[#8B8FA8] hover:text-white transition-colors"
                    onClick={() => toggleExpandido(idx)}
                  >
                    <span className="tabular-nums font-medium text-white">{formatarBRL(resumo.debitoColportores)}</span>
                    <span className="text-[10px]">{expandido ? "▲" : "▼"}</span>
                  </button>
                </div>
                {expandido && (
                  <div className="rounded-lg bg-[#0F1117] border border-[#2A2F45] divide-y divide-[#2A2F45]/50 overflow-hidden">
                    {devedores.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-[#8B8FA8]">Sem devedores registrados</p>
                    ) : (
                      devedores.map((d) => {
                        const pct = lider.percentualDebito ?? 0;
                        const valorIndividual = Math.round((pct / 100) * d.valorDebito * 100) / 100;
                        return (
                          <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <span className="text-xs text-[#8B8FA8] flex-1 truncate">{d.nome || "—"}</span>
                            <span className="text-xs text-[#8B8FA8]">{pct.toFixed(1)}%</span>
                            <span className="text-xs tabular-nums text-white">{formatarBRL(valorIndividual)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Débitos adicionais */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Débitos adicionais</span>
                  <button type="button" className="text-xs text-[#8B8FA8] hover:text-white transition-colors" onClick={() => addDebitoAdicional(idx)}>
                    + Adicionar
                  </button>
                </div>
                {gastosConfig.debitosAdicionais.map((d) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      className={cn(inputSmCls, "flex-1")}
                      placeholder="Descrição"
                      value={d.descricao}
                      onChange={(e) => updateDebitoAdicional(idx, d.id, { descricao: e.target.value })}
                    />
                    <input
                      type="number"
                      className={cn(inputSmCls, "w-20 text-right")}
                      placeholder="0,00"
                      min={0}
                      step="0.01"
                      value={d.valor || ""}
                      onChange={(e) => updateDebitoAdicional(idx, d.id, { valor: parseFloat(e.target.value) || 0 })}
                    />
                    <button type="button" className="w-6 h-6 rounded flex items-center justify-center text-[#8B8FA8] hover:text-red-400 hover:bg-red-500/10 transition-colors text-base leading-none" onClick={() => removeDebitoAdicional(idx, d.id)}>×</button>
                  </div>
                ))}
              </div>

              {/* Total débitos */}
              <div className="flex items-center justify-between pt-1 border-t border-[#2A2F45]">
                <span className="text-xs font-semibold text-[#8B8FA8]">Total de débitos</span>
                <span className="text-sm font-bold tabular-nums text-red-400">{formatarBRL(resumo.totalDebitos)}</span>
              </div>

              {/* Resumo financeiro */}
              <div className="space-y-0 rounded-xl bg-[#0F1117] border border-[#2A2F45] px-3 py-2">
                <RfLinha label="Bonificação + Auxílio" valor={resumo.totalBruto} positivo />
                {resumo.carta > 0 && <RfLinha label="Carta de Bolsa" valor={resumo.carta} />}
                <RfLinha label="Total Débitos" valor={resumo.totalDebitos} />
                <RfLinha label="Dízimo" valor={resumo.dizimo} />
                <RfLinha label="INSS" valor={resumo.inss} />
                <RfLinha label="IRPF" valor={resumo.irpf} />
                <div className="flex items-center justify-between py-2 mt-1 border-t border-[#2A2F45]">
                  <span className="text-sm font-bold text-white">Saldo final</span>
                  <span className={cn("text-sm font-bold tabular-nums", resumo.saldoFinal < 0 ? "text-red-400" : "text-green-400")}>
                    {formatarBRL(resumo.saldoFinal)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Caixa card */}
        {temCaixa && (
          <div className="w-full rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-white">{caixa.nome}</span>
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-[#6C63FF]/15 text-[#6C63FF] border border-[#6C63FF]/20">Caixa</span>
            </div>

            {/* Salário + Auxílio */}
            <div className="space-y-0 rounded-xl bg-[#0F1117] border border-[#2A2F45] px-3 py-2">
              {salarioCaixa > 0 && <RfLinha label="Salário" valor={salarioCaixa} positivo />}
              {auxilioCaixa > 0 && <RfLinha label="Auxílio" valor={auxilioCaixa} positivo />}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm font-bold text-[#8B8FA8]">Total bruto</span>
                <span className="text-sm font-bold tabular-nums text-green-400">{formatarBRL(totalBrutoCaixa)}</span>
              </div>
            </div>

            {/* Gastos do caixa */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Gastos do caixa</label>
              <input
                type="number"
                className={inputCls}
                placeholder="R$ 0,00"
                min={0}
                step="0.01"
                value={gastosCaixa.gastos || ""}
                onChange={(e) => setGastosCaixa(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Outros gastos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Outros gastos</span>
                <button type="button" className="text-xs text-[#8B8FA8] hover:text-white transition-colors" onClick={addDebitoAdicionalCaixa}>
                  + Adicionar
                </button>
              </div>
              {gastosCaixa.debitosAdicionais.map((d) => (
                <div key={d.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    className={cn(inputSmCls, "flex-1")}
                    placeholder="Descrição"
                    value={d.descricao}
                    onChange={(e) => updateDebitoAdicionalCaixa(d.id, { descricao: e.target.value })}
                  />
                  <input
                    type="number"
                    className={cn(inputSmCls, "w-20 text-right")}
                    placeholder="0,00"
                    min={0}
                    step="0.01"
                    value={d.valor || ""}
                    onChange={(e) => updateDebitoAdicionalCaixa(d.id, { valor: parseFloat(e.target.value) || 0 })}
                  />
                  <button type="button" className="w-6 h-6 rounded flex items-center justify-center text-[#8B8FA8] hover:text-red-400 hover:bg-red-500/10 transition-colors text-base leading-none" onClick={() => removeDebitoAdicionalCaixa(d.id)}>×</button>
                </div>
              ))}
            </div>

            {/* Total gastos + Saldo */}
            <div className="flex items-center justify-between pt-1 border-t border-[#2A2F45]">
              <span className="text-xs font-semibold text-[#8B8FA8]">Total de gastos</span>
              <span className="text-sm font-bold tabular-nums text-red-400">{formatarBRL(totalGastosCaixa)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-bold text-white">Saldo final</span>
              <span className={cn("text-sm font-bold tabular-nums", saldoCaixa < 0 ? "text-red-400" : "text-green-400")}>
                {formatarBRL(saldoCaixa)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
