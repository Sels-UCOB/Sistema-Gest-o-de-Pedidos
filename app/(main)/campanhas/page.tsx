"use client";

import { useRouter } from "next/navigation";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { XlsxUploader } from "@/components/campanhas/upload/XlsxUploader";
import { PreviewImportacao } from "@/components/campanhas/upload/PreviewImportacao";
import { CampaignConfigForm } from "@/components/campanhas/config/CampaignConfigForm";
import type { DadosImportados } from "@/lib/campanhas/types/acerto";

export default function Tela1() {
  const router = useRouter();
  const { state, encerrado, setDadosImportados, setConfig, resetDados } = useAcerto();
  const { dadosImportados, config } = state;

  const podeProsseguir =
    dadosImportados !== null &&
    config.lideres[0].nome.trim() !== "" &&
    config.caixa.nome.trim() !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Importação &amp; Configuração</h1>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E2235] border border-[#2A2F45] text-sm text-[#8B8FA8]">
          <span className="text-[#6C63FF] font-bold">1</span>
          <span>/</span>
          <span>3</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna esquerda — Importação */}
        <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-[#6C63FF] bg-[#6C63FF]/10 border border-[#6C63FF]/20 px-2 py-1 rounded-lg shrink-0">01</span>
            <div>
              <h2 className="text-base font-semibold text-white">Relatório de Saldo</h2>
              <p className="text-sm text-[#8B8FA8] mt-0.5">
                Importe o arquivo Excel exportado do sistema de saldo de colportores
              </p>
            </div>
          </div>
          {dadosImportados ? (
            <PreviewImportacao dados={dadosImportados} onLimpar={resetDados} somenteLeitura={encerrado} />
          ) : encerrado ? (
            <p className="text-sm text-[#8B8FA8]">Nenhum relatório importado.</p>
          ) : (
            <XlsxUploader onImportado={(d: DadosImportados) => setDadosImportados(d)} />
          )}
        </div>

        {/* Coluna direita — Configuração */}
        <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-[#6C63FF] bg-[#6C63FF]/10 border border-[#6C63FF]/20 px-2 py-1 rounded-lg shrink-0">02</span>
            <div>
              <h2 className="text-base font-semibold text-white">Configuração da Campanha</h2>
              <p className="text-sm text-[#8B8FA8] mt-0.5">
                Preencha os dados da equipe e da campanha
              </p>
            </div>
          </div>
          <CampaignConfigForm config={config} onChange={setConfig} disabled={encerrado} />
        </div>
      </div>

      {/* Rodapé */}
      {!encerrado && (
        <div className="flex items-center justify-between pt-2">
          {!podeProsseguir && (
            <p className="text-sm text-[#8B8FA8]">
              {!dadosImportados
                ? "Importe o relatório de saldo para continuar"
                : "Preencha ao menos o 1º Líder e o Caixa para continuar"}
            </p>
          )}
          <div className="ml-auto">
            <button
              className="px-5 py-2.5 rounded-xl bg-[#6C63FF] text-white font-medium text-sm transition-colors hover:bg-[#5A52E8] disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!podeProsseguir}
              type="button"
              onClick={() => router.push("/campanhas/lancamentos")}
            >
              Prosseguir para Lançamentos →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
