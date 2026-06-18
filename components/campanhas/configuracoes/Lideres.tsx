"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useConfiguracao } from "@/lib/campanhas/context/ConfiguracaoContext";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { ConfirmDialog } from "./ConfirmDialog";

const inputCls = "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors placeholder:text-[#8B8FA8]/50";
const labelCls = "block text-xs font-medium text-[#8B8FA8] mb-1.5";

export function Lideres() {
  const { lideres, initLideres, updateLider, deleteLider } = useConfiguracao();
  const { state } = useAcerto();
  const [confirmarNome, setConfirmarNome] = useState<string | null>(null);

  useEffect(() => {
    const nomes = state.config.lideres.filter((l) => l.nome).map((l) => l.nome);
    initLideres(nomes);
  }, [initLideres, state.config.lideres]);

  const naoConfigurados = lideres.filter((l) => !l.subcontaLider.trim() || !l.subcontaLucro.trim());

  return (
    <div className="space-y-4">
      {confirmarNome && (
        <ConfirmDialog
          mensagem={`Tem certeza que deseja excluir o líder "${confirmarNome}"?`}
          onConfirmar={() => { deleteLider(confirmarNome); setConfirmarNome(null); }}
          onCancelar={() => setConfirmarNome(null)}
        />
      )}

      {naoConfigurados.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm" role="alert">
          <span>⚠</span>
          <span>Por favor, configure as Subcontas do(s) Líderes!</span>
        </div>
      )}

      {lideres.length === 0 ? (
        <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-8 text-center">
          <p className="text-sm text-[#8B8FA8]">
            Nenhum líder encontrado. Configure os líderes na tela de Importação &amp; Configuração primeiro.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lideres.map((lider) => {
            const incompleto = !lider.subcontaLider.trim() || !lider.subcontaLucro.trim();
            const slug = lider.nome.replace(/\s+/g, "-");
            return (
              <div key={lider.nome} className={cn("rounded-2xl bg-[#1A1F2E] border p-5 space-y-4", incompleto ? "border-amber-500/30" : "border-[#2A2F45]")}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{lider.nome}</span>
                    {incompleto ? (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">Não configurado</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">Configurado</span>
                    )}
                  </div>
                  <button
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-red-400 transition-colors"
                    onClick={() => setConfirmarNome(lider.nome)}
                    type="button"
                  >
                    Excluir
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} htmlFor={`subcontaLider-${slug}`}>Subconta Líder *</label>
                    <input
                      id={`subcontaLider-${slug}`}
                      className={cn(inputCls, !lider.subcontaLider.trim() && "border-amber-500/40")}
                      type="text"
                      placeholder="Código da subconta"
                      value={lider.subcontaLider}
                      onChange={(e) => updateLider(lider.nome, { subcontaLider: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`subcontaLucro-${slug}`}>Subconta Lucro *</label>
                    <input
                      id={`subcontaLucro-${slug}`}
                      className={cn(inputCls, !lider.subcontaLucro.trim() && "border-amber-500/40")}
                      type="text"
                      placeholder="Código da subconta"
                      value={lider.subcontaLucro}
                      onChange={(e) => updateLider(lider.nome, { subcontaLucro: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
