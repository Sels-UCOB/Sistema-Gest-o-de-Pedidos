"use client";

import { cn } from "@/lib/utils";
import { useLancamentoLider } from "@/lib/campanhas/context/LancamentoLiderContext";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";

const inputCls = "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors placeholder:text-[#8B8FA8]/50";
const labelCls = "block text-xs font-medium text-[#8B8FA8] mb-1.5";

export function PainelConfig() {
  const { cartaBolsa, jurosCampanha, encerrado, updateCartaBolsa, setJurosCampanha } = useLancamentoLider();
  const { state } = useAcerto();
  const lideres = state.config.lideres.filter((l) => l.nome.trim());

  return (
    <aside className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-5 space-y-5">
      <h2 className="text-sm font-semibold text-white">Configuração</h2>

      {lideres.length === 0 && (
        <p className="text-xs text-[#8B8FA8]">Nenhum líder configurado. Defina os líderes na aba Acerto.</p>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Carta de Bolsa</h3>
        <div>
          <label className={labelCls}>Valor</label>
          <input
            type="number"
            className={cn(inputCls, encerrado && "opacity-50 cursor-not-allowed")}
            value={cartaBolsa.valor === 0 ? "" : cartaBolsa.valor}
            placeholder="R$ 0,00"
            min={0}
            step="0.01"
            disabled={encerrado}
            onChange={(e) => updateCartaBolsa({ valor: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className={labelCls}>Líder receptor</label>
          <select className={cn(inputCls, encerrado && "opacity-50 cursor-not-allowed")} value={cartaBolsa.liderReceptor} disabled={encerrado} onChange={(e) => updateCartaBolsa({ liderReceptor: e.target.value })}>
            <option value="">— nenhum —</option>
            {lideres.map((l) => <option key={l.nome} value={l.nome}>{l.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-[#2A2F45]" />

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">Lançamentos Manuais</h3>
        <div>
          <label className={labelCls}>Juros Campanha</label>
          <input
            type="number"
            className={cn(inputCls, encerrado && "opacity-50 cursor-not-allowed")}
            value={jurosCampanha ?? ""}
            placeholder="+/- valor"
            step="0.01"
            disabled={encerrado}
            onChange={(e) => setJurosCampanha(e.target.value === "" ? null : parseFloat(e.target.value))}
          />
        </div>
      </div>
    </aside>
  );
}
