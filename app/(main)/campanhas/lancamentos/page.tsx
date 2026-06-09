"use client";

import { CabecalhoCampanha } from "@/components/campanhas/lancamentos/CabecalhoCampanha";
import { TabelaLancamentos } from "@/components/campanhas/lancamentos/TabelaLancamentos";

export default function LancamentosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Lançamentos</h1>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E2235] border border-[#2A2F45] text-sm text-[#8B8FA8]">
          <span className="text-[#6C63FF] font-bold">2</span>
          <span>/</span>
          <span>3</span>
        </div>
      </div>
      <CabecalhoCampanha />
      <TabelaLancamentos />
    </div>
  );
}
