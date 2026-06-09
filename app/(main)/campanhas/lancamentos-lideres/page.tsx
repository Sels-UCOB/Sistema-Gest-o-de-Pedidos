"use client";

import { CabecalhoLider } from "@/components/campanhas/lancamentos-lideres/CabecalhoLider";
import { TabelaLider } from "@/components/campanhas/lancamentos-lideres/TabelaLider";
import { PainelConfig } from "@/components/campanhas/lancamentos-lideres/PainelConfig";
import { ResumoLideres } from "@/components/campanhas/debitos/ResumoLideres";
import { TabelaDevedores } from "@/components/campanhas/debitos/TabelaDevedores";

export default function LancamentosLideresPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Lançamentos — Líderes</h1>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E2235] border border-[#2A2F45] text-sm text-[#8B8FA8]">
          <span className="text-[#6C63FF] font-bold">3</span>
          <span>/</span>
          <span>3</span>
        </div>
      </div>

      <CabecalhoLider />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <TabelaLider />
          <ResumoLideres />
        </div>
        <div className="space-y-6">
          <PainelConfig />
          <TabelaDevedores />
        </div>
      </div>
    </div>
  );
}
