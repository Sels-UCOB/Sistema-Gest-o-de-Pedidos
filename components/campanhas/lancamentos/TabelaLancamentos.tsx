"use client";

import React, { useState, useCallback } from "react";
import { Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLancamento } from "@/lib/campanhas/context/LancamentoContext";
import { useConfiguracao } from "@/lib/campanhas/context/ConfiguracaoContext";
import { calcularSaldos } from "@/lib/campanhas/calcularSaldos";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import { NovoTipoModal } from "./NovoTipoModal";

const inputCls = "w-full rounded-md bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-2 py-1.5 focus:outline-none focus:border-[#6C63FF] transition-colors";

type SaveState = "idle" | "salvando" | "ok" | "erro";

export function TabelaLancamentos() {
  const { lancamentos, encerrado, addLancamento, updateLancamento, removeLancamento, salvar } = useLancamento();
  const { tipos } = useConfiguracao();
  const [modalRowId, setModalRowId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saldos = calcularSaldos(lancamentos);

  const handleSalvar = useCallback(async () => {
    setSaveState("salvando");
    try {
      await salvar();
      setSaveState("ok");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("erro");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  }, [salvar]);

  const handleValor = useCallback((id: string, raw: string) => {
    const num = raw === "" ? null : parseFloat(raw);
    updateLancamento(id, { valor: num === null || isNaN(num) ? null : num });
  }, [updateLancamento]);

  const handleSaldoManual = useCallback((id: string, raw: string) => {
    const num = raw === "" ? 0 : parseFloat(raw);
    updateLancamento(id, { saldoManual: isNaN(num) ? 0 : num });
  }, [updateLancamento]);

  const saldoFinal = saldos.length > 0 ? saldos[saldos.length - 1] : 0;
  const thCls = "px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]";

  return (
    <div className="space-y-3">
      {modalRowId && (
        <NovoTipoModal
          onSalvar={(id) => { updateLancamento(modalRowId, { tipoLancamentoId: id }); setModalRowId(null); }}
          onFechar={() => setModalRowId(null)}
        />
      )}

      <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2F45]">
                <th className={cn(thCls, "w-10")}>#</th>
                <th className={thCls}>Tipo Lançamento</th>
                <th className={thCls}>Histórico</th>
                <th className={cn(thCls, "text-right")}>D/C</th>
                <th className={cn(thCls, "text-right")}>Saldo</th>
                <th className={cn(thCls, "w-8")}></th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((lanc, idx) => {
                const saldo = saldos[idx] ?? 0;
                const isPrimeira = idx === 0;

                return (
                  <tr key={lanc.id} className={cn("border-b border-[#2A2F45]/50 last:border-0", isPrimeira && "bg-[#6C63FF]/5")}>
                    <td className="px-3 py-2.5 text-[#8B8FA8] text-xs">{idx + 1}</td>

                    {isPrimeira ? (
                      <td colSpan={3} className="px-3 py-2.5 text-xs font-semibold text-[#6C63FF] uppercase tracking-wider">
                        Saldo Inicial
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2">
                          <select
                            value={lanc.tipoLancamentoId}
                            onChange={(e) => {
                              if (e.target.value === "__novo__") setModalRowId(lanc.id);
                              else updateLancamento(lanc.id, { tipoLancamentoId: e.target.value });
                            }}
                            className={cn(inputCls, "min-w-36", encerrado && "opacity-50 cursor-not-allowed")}
                            disabled={encerrado}
                          >
                            <option value="">— selecione —</option>
                            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                            {!encerrado && <><option disabled>──────────</option><option value="__novo__">+ Novo Tipo...</option></>}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={lanc.historico} onChange={(e) => updateLancamento(lanc.id, { historico: e.target.value })} className={cn(inputCls, encerrado && "opacity-50 cursor-not-allowed")} placeholder="Descrição" disabled={encerrado} />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={lanc.valor ?? ""}
                            onChange={(e) => handleValor(lanc.id, e.target.value)}
                            className={cn(inputCls, "text-right w-28", lanc.valor !== null && lanc.valor < 0 && "text-red-400", encerrado && "opacity-50 cursor-not-allowed")}
                            step="0.01"
                            placeholder="+/- valor"
                            disabled={encerrado}
                          />
                        </td>
                      </>
                    )}

                    <td className={cn("px-3 py-2.5 text-right text-sm tabular-nums", saldo < 0 ? "text-red-400" : "text-white")}>
                      {isPrimeira ? (
                        <input
                          type="number"
                          value={lanc.saldoManual ?? ""}
                          onChange={(e) => handleSaldoManual(lanc.id, e.target.value)}
                          className={cn(inputCls, "text-right w-28", encerrado && "opacity-50 cursor-not-allowed")}
                          step="0.01"
                          placeholder="0,00"
                          disabled={encerrado}
                        />
                      ) : (
                        <span>{formatarBRL(saldo)}</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      {!isPrimeira && !encerrado && (
                        <button
                          type="button"
                          onClick={() => removeLancamento(lanc.id)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[#8B8FA8] hover:text-red-400 hover:bg-red-500/10 transition-colors text-base leading-none"
                          aria-label={`Remover linha ${idx + 1}`}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!encerrado && (
            <button type="button" onClick={addLancamento} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white transition-colors">
              + Adicionar Linha
            </button>
          )}
          <button
            type="button"
            onClick={handleSalvar}
            disabled={saveState === "salvando" || encerrado}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50",
              saveState === "ok"
                ? "bg-green-500/20 text-green-400"
                : saveState === "erro"
                ? "bg-red-500/20 text-red-400"
                : "bg-[#6C63FF]/20 text-[#6C63FF] hover:bg-[#6C63FF]/30"
            )}
          >
            {saveState === "salvando" ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saveState === "salvando" ? "Salvando…" : saveState === "ok" ? "Salvo!" : saveState === "erro" ? "Erro" : "Salvar"}
          </button>
        </div>
        <span className={cn("text-sm font-medium", saldoFinal < 0 ? "text-red-400" : "text-white")}>
          Saldo final: <strong>{formatarBRL(saldoFinal)}</strong>
        </span>
      </div>
    </div>
  );
}
