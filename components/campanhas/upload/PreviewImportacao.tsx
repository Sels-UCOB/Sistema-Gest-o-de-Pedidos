"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import type { DadosImportados } from "@/lib/campanhas/types/acerto";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import { EXIBICAO } from "@/lib/campanhas/config/app";

interface Props { dados: DadosImportados; onLimpar: () => void; somenteLeitura?: boolean; }

export function PreviewImportacao({ dados, onLimpar, somenteLeitura = false }: Props) {
  const [expandido, setExpandido] = useState(false);
  const visiveis = expandido ? dados.nomes : dados.nomes.slice(0, EXIBICAO.previewMaxLinhas);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">✓ Importado</span>
          <span className="text-sm text-[#8B8FA8]">{dados.nomes.length} colportores</span>
        </div>
        {!somenteLeitura && (
          <button className="text-xs text-[#8B8FA8] hover:text-white underline underline-offset-2 transition-colors" onClick={onLimpar} type="button">
            Trocar arquivo
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Compra Total", value: formatarBRL(dados.compraTotal) },
          { label: "Bonificado", value: formatarBRL(dados.bonificado) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-[#0F1117] border border-[#2A2F45] p-3 text-center">
            <p className="text-xs text-[#8B8FA8]">{label}</p>
            <p className="text-sm font-bold text-[#6C63FF] tabular-nums mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-[#0F1117] border border-[#2A2F45] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#2A2F45]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Nome</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Saldo</span>
        </div>
        {visiveis.map((nome, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-[#2A2F45]/50 last:border-0 hover:bg-[#2A2F45]/20 transition-colors">
            <span className="text-sm text-[#8B8FA8]">{nome}</span>
            <span className={cn("text-sm tabular-nums font-medium", dados.saldos[i] < 0 ? "text-red-400" : dados.saldos[i] > 0 ? "text-green-400" : "text-[#8B8FA8]")}>
              {formatarBRL(dados.saldos[i])}
            </span>
          </div>
        ))}
      </div>

      {dados.nomes.length > 5 && (
        <button className="w-full py-2 rounded-lg text-xs font-medium text-[#8B8FA8] hover:text-white border border-[#2A2F45] hover:border-[#6C63FF]/50 transition-colors" onClick={() => setExpandido((v) => !v)} type="button">
          {expandido ? "Mostrar menos ▲" : `Ver todos os ${dados.nomes.length} colportores ▼`}
        </button>
      )}
    </div>
  );
}
