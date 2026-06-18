
"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAcertosManager } from "@/lib/campanhas/context/AcertosManagerContext";
import { FiltrosAcertos } from "@/components/campanhas/acertos/FiltrosAcertos";
import { TabelaAcertos } from "@/components/campanhas/acertos/TabelaAcertos";
import { ModalCriarAcerto } from "@/components/campanhas/acertos/ModalCriarAcerto";
import type { AcertoMeta, CriarAcertoData, FiltrosAcerto } from "@/lib/campanhas/types/acertoManager";
import { ModalBolsasGlobal } from "@/components/campanhas/acertos/ModalBolsasGlobal";

const FILTROS_INICIAIS: FiltrosAcerto = {
  status: "todos",
  campo: "todos",
  tipoCampanha: "todos",
  dataInicio: "",
  dataFim: "",
};

export default function PainelAcertosPage() {
  const router = useRouter();
  const { acertos, activeId, createAcerto, updateAcerto, deleteAcerto, setActiveAcerto, loadError, reload, loading } =
    useAcertosManager();

  const [filtros, setFiltros] = useState<FiltrosAcerto>(FILTROS_INICIAIS);
  const [modalAberto, setModalAberto] = useState(false);
  const [acertoParaEditar, setAcertoParaEditar] = useState<AcertoMeta | null>(null);
  const [bolsasGlobalAberto, setBolsasGlobalAberto] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

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

  const handleCriar = async (data: CriarAcertoData) => {
    try {
      setOpError(null);
      await createAcerto(data);
      setModalAberto(false);
      router.push("/campanhas");
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Erro ao criar acerto.");
    }
  };

  const handleEditar = async (data: CriarAcertoData) => {
    if (!acertoParaEditar) return;
    try {
      setOpError(null);
      await updateAcerto(acertoParaEditar.id, data);
      setAcertoParaEditar(null);
      setModalAberto(false);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Erro ao salvar acerto.");
    }
  };

  const handleExcluir = async (a: AcertoMeta) => {
    try {
      setOpError(null);
      await deleteAcerto(a.id);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Erro ao excluir acerto.");
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-sm text-red-400 max-w-md">
          Erro ao carregar acertos: <span className="font-mono">{loadError}</span>
        </p>
        <button
          type="button"
          onClick={reload}
          className="px-4 py-2 rounded-xl bg-[#6C63FF] text-white text-sm font-medium hover:bg-[#5A52E8] transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {opError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{opError}</p>
          <button
            type="button"
            onClick={() => setOpError(null)}
            className="text-red-400 hover:text-red-300 text-xs shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Painel de Acertos</h1>
          <p className="text-sm text-[#8B8FA8] mt-1">Gerencie os ciclos de acerto das campanhas de colportagem.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-[#2A2F45] text-[#8B8FA8] font-medium text-sm hover:text-white transition-colors"
            onClick={() => setBolsasGlobalAberto(true)}
          >
            Ver Bolsas
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-[#6C63FF] text-white font-medium text-sm hover:bg-[#5A52E8] transition-colors"
            onClick={() => { setAcertoParaEditar(null); setModalAberto(true); }}
          >
            + Novo Acerto
          </button>
        </div>
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
        onExcluir={handleExcluir}
      />

      {bolsasGlobalAberto && (
        <ModalBolsasGlobal onClose={() => setBolsasGlobalAberto(false)} />
      )}

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
