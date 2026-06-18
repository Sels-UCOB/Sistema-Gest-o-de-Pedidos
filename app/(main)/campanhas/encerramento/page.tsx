"use client";

import { ResumoCampanha } from "@/components/campanhas/encerramento/ResumoCampanha";
import { ResumoLideresTabela } from "@/components/campanhas/encerramento/ResumoLideresTabela";
import { DiferencaCaixa } from "@/components/campanhas/encerramento/DiferencaCaixa";
import { BotaoGerarCSV } from "@/components/campanhas/encerramento/BotaoGerarCSV";
import { BotoesExportarPDF } from "@/components/campanhas/encerramento/BotoesExportarPDF";
import { BotaoEncerrar } from "@/components/campanhas/encerramento/BotaoEncerrar";
import { ChecklistEncerramento } from "@/components/campanhas/encerramento/ChecklistEncerramento";
import { useAcertosManager } from "@/lib/campanhas/context/AcertosManagerContext";
import { useAcertoChecklist } from "@/lib/campanhas/hooks/useAcertoChecklist";

export default function EncerramentoPage() {
  const { activeId, activeAcerto } = useAcertosManager();
  const { itens, loading, todosMarcados, progresso, toggleItem } = useAcertoChecklist(activeId);

  const encerrado = activeAcerto?.status === "Encerrado";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Encerramento</h1>
          <p className="text-sm text-[#8B8FA8] mt-1">Resumo final, exportação e fechamento da campanha.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BotaoGerarCSV />
          <BotoesExportarPDF />
        </div>
      </div>

      <div className="space-y-6">
        <ResumoCampanha />
        <ResumoLideresTabela />
        <DiferencaCaixa />
        <ChecklistEncerramento
          itens={itens}
          loading={loading}
          todosMarcados={todosMarcados}
          progresso={progresso}
          onToggle={toggleItem}
          encerrado={encerrado}
        />
        <BotaoEncerrar checklistCompleto={todosMarcados} />
      </div>
    </div>
  );
}
