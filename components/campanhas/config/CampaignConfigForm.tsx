"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import type { ConfigCampanha, CampanhaType, CampoType, LiderAcerto, CaixaAcerto } from "@/lib/campanhas/types/acerto";
import { CAMPANHAS, CAMPOS, DEFAULTS_LIDERES, TOTAIS_ESPERADOS } from "@/lib/campanhas/config/app";

interface CampaignConfigFormProps {
  config: ConfigCampanha;
  onChange: (parcial: Partial<ConfigCampanha>) => void;
  disabled?: boolean;
}

const inputCls = "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors placeholder:text-[#8B8FA8]/50";
const selectCls = "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] mb-1";
const fieldsetCls = "rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-5 space-y-4";
const legendCls = "text-xs font-bold uppercase tracking-wider text-[#6C63FF] px-1 mb-4 block";

export function CampaignConfigForm({ config, onChange, disabled = false }: CampaignConfigFormProps) {
  const [localLideres, setLocalLideres] = useState<ConfigCampanha["lideres"]>(
    () => config.lideres.map((l) => ({ ...l })) as ConfigCampanha["lideres"]
  );
  const [localCaixa, setLocalCaixa] = useState<CaixaAcerto>(() => ({ ...config.caixa }));
  const [localNumLideres, setLocalNumLideres] = useState<1 | 2 | 3 | 4>(() => (config.numLideres ?? 1) as 1 | 2 | 3 | 4);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  const setLiderField = (idx: number, campo: keyof LiderAcerto, valor: string | number | boolean) => {
    setErroValidacao(null);
    setLocalLideres((prev) => {
      const novos = prev.map((l) => ({ ...l })) as ConfigCampanha["lideres"];
      novos[idx] = { ...novos[idx], [campo]: valor };
      return novos;
    });
  };

  const handleNumLideresChange = (n: 1 | 2 | 3 | 4) => {
    setLocalNumLideres(n);
    setErroValidacao(null);
    const defaults = DEFAULTS_LIDERES[n];
    setLocalLideres((prev) => {
      const novos = prev.map((l) => ({ ...l })) as ConfigCampanha["lideres"];
      for (let i = 0; i < 4; i++) {
        if (i < defaults.length) {
          novos[i] = { ...novos[i], bonificacaoPercentual: defaults[i].bonificacaoPercentual, auxilioPercentual: defaults[i].auxilioPercentual, percentualDebito: defaults[i].percentualDebito };
        } else {
          novos[i] = { ...novos[i], bonificacaoPercentual: 0, auxilioPercentual: 0 };
        }
      }
      return novos;
    });
  };

  const salvarLideres = () => {
    const totais = TOTAIS_ESPERADOS[localNumLideres];
    if (totais) {
      const ativos = Array.from({ length: localNumLideres }, (_, i) => localLideres[i]);
      const somaBonif = Math.round(ativos.reduce((s, l) => s + l.bonificacaoPercentual, 0) * 100) / 100;
      const somaAux = Math.round((ativos.reduce((s, l) => s + l.auxilioPercentual, 0) + localCaixa.auxilioPercentual) * 100) / 100;
      const erros: string[] = [];
      if (somaBonif !== totais.bonificacao) erros.push(`Manutenção: soma ${somaBonif}%, esperado ${totais.bonificacao}%`);
      if (somaAux !== totais.auxilio) erros.push(`Auxílio: soma ${somaAux}%, esperado ${totais.auxilio}%`);
      if (erros.length > 0) { setErroValidacao(erros.join(" — ")); return; }
    }
    setErroValidacao(null);
    onChange({ lideres: localLideres, caixa: localCaixa, numLideres: localNumLideres });
  };

  return (
    <fieldset disabled={disabled} className={cn("space-y-5", disabled && "opacity-60 pointer-events-none")}>
      {/* Campanha */}
      <fieldset className={fieldsetCls}>
        <legend className={legendCls}>Campanha</legend>

        <div>
          <label className={labelCls} htmlFor="tipoCampanha">Tipo de Campanha</label>
          <select id="tipoCampanha" className={selectCls} value={config.tipoCampanha} onChange={(e) => onChange({ tipoCampanha: e.target.value as CampanhaType })}>
            {CAMPANHAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {config.tipoCampanha === "Outro" && (
          <div>
            <label className={labelCls} htmlFor="tipoCampanhaOutro">Nome da Campanha</label>
            <input id="tipoCampanhaOutro" className={inputCls} type="text" placeholder="Ex: Primavera 2026" value={config.tipoCampanhaOutro} onChange={(e) => onChange({ tipoCampanhaOutro: e.target.value })} />
          </div>
        )}

        <div>
          <label className={labelCls} htmlFor="campo">Campo</label>
          <select id="campo" className={selectCls} value={config.campo} onChange={(e) => onChange({ campo: e.target.value as CampoType })}>
            {CAMPOS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {config.campo === "Outro" && (
          <div>
            <label className={labelCls} htmlFor="campoOutro">Nome do Campo</label>
            <input id="campoOutro" className={inputCls} type="text" placeholder="Nome do campo" value={config.campoOutro} onChange={(e) => onChange({ campoOutro: e.target.value })} />
          </div>
        )}
      </fieldset>

      {/* Líderes */}
      <fieldset className={fieldsetCls}>
        <legend className={legendCls}>Líderes</legend>

        <div>
          <label className={labelCls} htmlFor="numLideres">Nº de Líderes</label>
          <select id="numLideres" className={selectCls} value={localNumLideres} onChange={(e) => handleNumLideresChange(Number(e.target.value) as 1 | 2 | 3 | 4)}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[1fr_5rem_5rem_5rem] gap-2 px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Nome</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] text-center">Bonif. %</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] text-center">Auxílio %</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] text-center">% Déb.</span>
        </div>

        {Array.from({ length: localNumLideres }, (_, i) => i).map((idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="grid grid-cols-[1fr_5rem_5rem_5rem] gap-2">
              <input className={inputCls} type="text" placeholder={`${idx + 1}º líder`} value={localLideres[idx].nome} onChange={(e) => setLiderField(idx, "nome", e.target.value)} />
              <input className={cn(inputCls, "text-center")} type="number" placeholder="0" min={0} max={100} step="0.01" value={localLideres[idx].bonificacaoPercentual || ""} onChange={(e) => setLiderField(idx, "bonificacaoPercentual", parseFloat(e.target.value) || 0)} />
              <input className={cn(inputCls, "text-center")} type="number" placeholder="0" min={0} max={100} step="0.01" value={localLideres[idx].auxilioPercentual || ""} onChange={(e) => setLiderField(idx, "auxilioPercentual", parseFloat(e.target.value) || 0)} />
              <input className={cn(inputCls, "text-center")} type="number" placeholder="0" min={0} max={100} step="0.01" value={localLideres[idx].percentualDebito || ""} onChange={(e) => setLiderField(idx, "percentualDebito", parseFloat(e.target.value) || 0)} />
            </div>
            {idx === 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  id="veiculoSPA"
                  type="checkbox"
                  className="w-4 h-4 rounded accent-[#6C63FF] cursor-pointer"
                  checked={localLideres[0].possuiVeiculoSPA}
                  onChange={(e) => setLiderField(0, "possuiVeiculoSPA", e.target.checked)}
                />
                <span className="text-sm text-[#8B8FA8]">Possui veículo no SPA?</span>
              </label>
            )}
          </div>
        ))}

        {erroValidacao && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm" role="alert">
            ⚠ {erroValidacao}
          </div>
        )}

        {/* Caixa separator */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Caixa</span>
          <div className="flex-1 h-px bg-[#2A2F45]" />
        </div>

        <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
          <input className={inputCls} type="text" placeholder="Nome do caixa" value={localCaixa.nome} onChange={(e) => setLocalCaixa((p) => ({ ...p, nome: e.target.value }))} />
          <input
            className={cn(inputCls, "text-center")}
            type="number" placeholder="Sal." min={0} step="0.01"
            value={localCaixa.salarioCaixa ?? ""}
            onChange={(e) => setLocalCaixa((p) => ({ ...p, salarioCaixa: e.target.value === "" ? null : parseFloat(e.target.value) }))}
          />
          <input
            className={cn(inputCls, "text-center")}
            type="number" placeholder="0" min={0} max={100} step="0.01"
            value={localCaixa.auxilioPercentual || ""}
            onChange={(e) => setLocalCaixa((p) => ({ ...p, auxilioPercentual: parseFloat(e.target.value) || 0 }))}
          />
        </div>

        <div className="flex justify-end">
          <button type="button" className="px-5 py-2 rounded-lg text-sm font-medium bg-[#6C63FF] text-white hover:bg-[#5A52E8] transition-colors" onClick={salvarLideres}>
            Salvar
          </button>
        </div>
      </fieldset>

      {/* Financeiro */}
      <fieldset className={fieldsetCls}>
        <legend className={legendCls}>Financeiro & Organização</legend>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelCls} htmlFor="subConta">SubConta Campanha</label>
            <input id="subConta" className={inputCls} type="text" placeholder="Código ou nome" value={config.subContaCampanha} onChange={(e) => onChange({ subContaCampanha: e.target.value })} />
          </div>
          <div>
            <label className={labelCls} htmlFor="departamento">Departamento</label>
            <input id="departamento" className={inputCls} type="text" placeholder="Nome do departamento" value={config.departamento} onChange={(e) => onChange({ departamento: e.target.value })} />
          </div>
        </div>
      </fieldset>
    </fieldset>
  );
}
