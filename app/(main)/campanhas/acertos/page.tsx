
"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAcertosManager } from "@/lib/campanhas/context/AcertosManagerContext";
import { FiltrosAcertos } from "@/components/campanhas/acertos/FiltrosAcertos";
import { TabelaAcertos } from "@/components/campanhas/acertos/TabelaAcertos";
import { ModalCriarAcerto } from "@/components/campanhas/acertos/ModalCriarAcerto";
import type { AcertoMeta, CriarAcertoData, FiltrosAcerto } from "@/lib/campanhas/types/acertoManager";

const FILTROS_INICIAIS: FiltrosAcerto = {
  status: "todos",
  campo: "todos",
  tipoCampanha: "todos",
  dataInicio: "",
  dataFim: "",
};

export default function PainelAcertosPage() {
  const router = useRouter();
  const { acertos, activeId, createAcerto, updateAcerto, deleteAcerto, setActiveAcerto } =
    useAcertosManager();

  const [filtros, setFiltros] = useState<FiltrosAcerto>(FILTROS_INICIAIS);
  const [modalAberto, setModalAberto] = useState(false);
  const [acertoParaEditar, setAcertoParaEditar] = useState<AcertoMeta | null>(null);

  const acertosFiltrados = useMemo(() => {
    return acertos.filter((a) => {
      if (filtros.status !== "todos" && a.status !== filtros.status) return false;
      if (filtros.campo !== "todos" && a.campo !== filtros.campo) return false;
      if (filtros.tipoCampanha !== "todos" && a.tipoCampanha !== filtros.tipoCampanha) return false;
      if (filtros.dataInicio && a.dataCriacao < filtros.dataInicio + "T00:00:00") return false;
      if (filtros.dataFim && a.dataCriacao > filtros.dataFim + "T23:59:59") return false;
      return true;
    });
  }, [acertos, filtros]);

  const handleCriar = (data: CriarAcertoData) => {
    createAcerto(data);
    setModalAberto(false);
    router.push("/campanhas");
  };

  const handleEditar = (data: CriarAcertoData) => {
    if (!acertoParaEditar) return;
    updateAcerto(acertoParaEditar.id, data);
    setAcertoParaEditar(null);
    setModalAberto(false);
  };

  const handleEntrar = (acerto: AcertoMeta) => {
    setActiveAcerto(acerto.id);
    router.push("/campanhas");
  };

  const handleAbrirEditar = (acerto: AcertoMeta) => {
    setAcertoParaEditar(acerto);
    setModalAberto(true);
  };

  const handleFecharModal = () => {
    setModalAberto(false);
    setAcertoParaEditar(null);
  };

  const totalPorStatus = useMemo(
    () => ({
      Criado: acertos.filter((a) => a.status === "Criado").length,
      "Em Aberto": acertos.filter((a) => a.status === "Em Aberto").length,
      Encerrado: acertos.filter((a) => a.status === "Encerrado").length,
    }),
    [acertos]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Painel de Acertos</h1>
          <p className="text-sm text-[#8B8FA8] mt-1">Gerencie os ciclos de acerto das campanhas de colportagem.</p>
        </div>
        <button
          type="button"
          className="shrink-0 px-4 py-2 rounded-xl bg-[#6C63FF] text-white font-medium text-sm hover:bg-[#5A52E8] transition-colors"
          onClick={() => { setAcertoParaEditar(null); setModalAberto(true); }}
        >
          + Novo Acerto
        </button>
      </div>

      {/* Resumo rápido */}
      {acertos.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Criado", value: totalPorStatus.Criado, color: "text-[#8B8FA8]" },
            { label: "Em Aberto", value: totalPorStatus["Em Aberto"], color: "text-blue-400" },
            { label: "Encerrado", value: totalPorStatus.Encerrado, color: "text-green-400" },
            { label: "Total", value: acertos.length, color: "text-white" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-[#1A1F2E] border border-[#2A2F45] p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-[#8B8FA8] mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      <FiltrosAcertos filtros={filtros} onChange={setFiltros} />

      <TabelaAcertos
        acertos={acertosFiltrados}
        activeId={activeId}
        onEntrar={handleEntrar}
        onEditar={handleAbrirEditar}
        onExcluir={(a) => deleteAcerto(a.id)}
      />

      {modalAberto && (
        <ModalCriarAcerto
          onClose={handleFecharModal}
          onSalvar={acertoParaEditar ? handleEditar : handleCriar}
          dadosIniciais={
            acertoParaEditar
              ? { nome: acertoParaEditar.nome, campo: acertoParaEditar.campo, tipoCampanha: acertoParaEditar.tipoCampanha }
              : undefined
          }
          modoEdicao={!!acertoParaEditar}
        />
      )}
    </div>
  );
}
