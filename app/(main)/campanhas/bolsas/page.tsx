"use client";

import { useAcertosManager } from "@/lib/campanhas/context/AcertosManagerContext";
import { PainelBolsas } from "@/components/campanhas/bolsas/PainelBolsas";

export default function BolsasPage() {
  const { activeId, activeAcerto } = useAcertosManager();

  if (!activeId || !activeAcerto) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-white font-medium">Nenhum acerto ativo</p>
        <p className="text-sm text-[#8B8FA8] mt-2">
          Acesse o painel de acertos e entre em um acerto para visualizar as bolsas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Bolsas</h1>
        <p className="text-sm text-[#8B8FA8] mt-1">
          Colportores que bateram bolsa no acerto{" "}
          <span className="text-white font-medium">{activeAcerto.nome}</span>.
        </p>
      </div>
      <PainelBolsas acertoId={activeId} acertoNome={activeAcerto.nome} />
    </div>
  );
}
