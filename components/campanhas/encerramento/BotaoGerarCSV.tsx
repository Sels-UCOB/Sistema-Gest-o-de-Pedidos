"use client";

import React, { useState, useCallback } from "react";
import { X } from "lucide-react";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { useLancamento } from "@/lib/campanhas/context/LancamentoContext";
import { useLancamentoLider } from "@/lib/campanhas/context/LancamentoLiderContext";
import { useDebitos } from "@/lib/campanhas/context/DebitosContext";
import { useConfiguracao } from "@/lib/campanhas/context/ConfiguracaoContext";
import { gerarCSVContabil } from "@/lib/campanhas/gerarCSVContabil";

interface Pendencia { nome: string; falta: string; }

export function BotaoGerarCSV() {
  const { state } = useAcerto();
  const { lancamentos } = useLancamento();
  const { cartaBolsa, jurosCampanha } = useLancamentoLider();
  const { devedores, gastosLideres, gastosCaixa } = useDebitos();
  const { tipos, campos, lideres: lideresConfig } = useConfiguracao();

  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const handleGerar = useCallback(() => {
    setErroGeral(null);
    if (!state.dadosImportados) { setErroGeral("Importe um relatório antes de gerar o CSV."); return; }
    if (!state.config.subContaCampanha.trim()) { setErroGeral("Subconta da campanha não está configurada. Acesse a aba Configuração."); return; }

    const numLideres = state.config.numLideres;
    const lcMap = new Map(lideresConfig.map((l) => [l.nome, l]));
    const faltando: Pendencia[] = [];

    for (let i = 0; i < numLideres; i++) {
      const lider = state.config.lideres[i];
      if (!lider.nome.trim()) continue;
      const lc = lcMap.get(lider.nome);
      const problemas: string[] = [];
      if (!lc || !lc.subcontaLider.trim()) problemas.push("Subconta Líder");
      if (!lc || !lc.subcontaLucro.trim()) problemas.push("Subconta Lucro");
      if (problemas.length > 0) faltando.push({ nome: lider.nome, falta: problemas.join(" e ") });
    }

    if (faltando.length > 0) { setPendencias(faltando); return; }

    const csv = gerarCSVContabil({ lancamentos, tipos, lideresConfig, campos, config: state.config, cartaBolsa, jurosCampanha, devedores, gastosLideres, gastosCaixa, dadosImportados: state.dadosImportados });
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const campanha = state.config.tipoCampanha === "Outro" ? state.config.tipoCampanhaOutro : state.config.tipoCampanha;
    const campo = state.config.campo === "Outro" ? state.config.campoOutro : state.config.campo;
    a.download = `acerto_${campanha}_${campo}_${new Date().getFullYear()}.csv`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  }, [state, lancamentos, tipos, lideresConfig, campos, cartaBolsa, jurosCampanha, devedores, gastosLideres, gastosCaixa]);

  const Modal = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        {children}
        <div className="flex justify-end">
          <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#6C63FF] text-white hover:bg-[#5A52E8] transition-colors" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" className="px-4 py-2 rounded-xl text-sm font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white transition-colors" onClick={handleGerar}>
        Gerar CSV Contábil
      </button>

      {erroGeral && (
        <Modal onClose={() => setErroGeral(null)}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-white">Não foi possível gerar o CSV</h3>
            <button onClick={() => setErroGeral(null)} className="text-[#8B8FA8] hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm text-[#8B8FA8]">{erroGeral}</p>
        </Modal>
      )}

      {pendencias.length > 0 && (
        <Modal onClose={() => setPendencias([])}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-white">Subcontas não cadastradas</h3>
            <button onClick={() => setPendencias([])} className="text-[#8B8FA8] hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm text-[#8B8FA8]">Configure as subcontas dos líderes abaixo em <strong className="text-white">Configurações → Líderes</strong> antes de gerar o CSV:</p>
          <ul className="space-y-2">
            {pendencias.map((p) => (
              <li key={p.nome} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0F1117] border border-[#2A2F45]">
                <span className="text-sm text-white font-medium">{p.nome}</span>
                <span className="text-xs text-amber-400">{p.falta}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
