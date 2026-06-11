"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, RefreshCw, Plus, Trash2, Pencil, Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import {
  getBolsaList,
  addManualBolsa,
  removeBolsa,
  updateBolsa,
  loadBolsaFromReport,
} from "@/lib/campanhas/db/bolsa";
import type { AcertoBolsa, AcertoBolsaDados } from "@/lib/campanhas/types/bolsa";
import { DocumentoBolsasPDF } from "@/lib/campanhas/pdf/DocumentoBolsasPDF";
import { ModalAdicionarBolsa } from "./ModalAdicionarBolsa";

interface Props {
  acertoId: string;
  acertoNome?: string;
}

export function PainelBolsas({ acertoId, acertoNome = "Acerto" }: Props) {
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bolsas, setBolsas] = useState<AcertoBolsa[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBolsa, setEditingBolsa] = useState<AcertoBolsa | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBolsas(await getBolsaList(acertoId));
    } catch {
      setError("Erro ao carregar bolsas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [acertoId]);

  useEffect(() => { load(); }, [load]);

  const extraHeaders =
    bolsas.find((b) => b.origem === "AUTO" && b.dados?.headers?.length)?.dados?.headers ?? [];

  // Colunas visíveis: apenas headers não-vazios com seu índice original
  const visibleCols = extraHeaders
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.trim() !== "");

  const handleReprocessar = async () => {
    setReprocessing(true);
    setError(null);
    try {
      await loadBolsaFromReport(acertoId);
      await load();
    } catch {
      setError("Erro ao reprocessar o relatório. Tente novamente.");
    } finally {
      setReprocessing(false);
    }
  };

  const handleAddManual = async (nome: string, colunas: string[]) => {
    const dados: AcertoBolsaDados | null =
      extraHeaders.length > 0 ? { headers: extraHeaders, colunas } : null;
    await addManualBolsa(acertoId, nome, dados);
    await load();
  };

  const handleEdit = async (nome: string, colunas: string[]) => {
    if (!editingBolsa) return;
    const dados: AcertoBolsaDados | null =
      extraHeaders.length > 0 ? { headers: extraHeaders, colunas } : null;
    await updateBolsa(editingBolsa.id, nome, dados);
    await load();
  };

  const handleRemover = async (id: string) => {
    setRemovingId(id);
    try {
      await removeBolsa(id);
      setBolsas((prev) => prev.filter((b) => b.id !== id));
    } catch {
      setError("Erro ao remover. Tente novamente.");
    } finally {
      setRemovingId(null);
    }
  };

  const handleExportarPDF = async () => {
    setExporting(true);
    setError(null);
    try {
      const blob = await pdf(
        <DocumentoBolsasPDF
          acertoNome={acertoNome}
          bolsas={bolsas}
          extraHeaders={extraHeaders}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bolsas-${acertoNome.toLowerCase().replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#8B8FA8] text-sm">Carregando bolsas...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">Colportores que bateram a bolsa</h2>
            {bolsas.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-xs font-medium">
                {bolsas.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {bolsas.length > 0 && (
              <button
                onClick={handleExportarPDF}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white disabled:opacity-50 transition-colors"
              >
                {exporting ? (
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                {exporting ? "Gerando..." : "Exportar PDF"}
              </button>
            )}
            <button
              onClick={handleReprocessar}
              disabled={reprocessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${reprocessing ? "animate-spin" : ""}`} />
              {reprocessing ? "Reprocessando..." : "Reprocessar Relatório"}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#6C63FF] text-white hover:bg-[#5B52E8] transition-colors"
            >
              <Plus className="w-3 h-3" />
              Adicionar Bolsa
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Lista */}
        <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] overflow-hidden">
          {bolsas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-[#2A2F45] flex items-center justify-center mb-4">
                <Trophy className="w-5 h-5 text-[#8B8FA8]" />
              </div>
              <p className="text-white font-medium">Nenhuma bolsa registrada</p>
              <p className="text-sm text-[#8B8FA8] mt-1">
                Reprocesse o relatório ou adicione manualmente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A2F45]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] whitespace-nowrap">
                      Colportor
                    </th>
                    {visibleCols.map(({ header, index }) => (
                      <th key={index} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] whitespace-nowrap">
                        {header}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] whitespace-nowrap">
                      Origem
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] whitespace-nowrap">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bolsas.map((bolsa) => (
                    <tr
                      key={bolsa.id}
                      className="border-b border-[#2A2F45]/50 last:border-0 hover:bg-[#2A2F45]/20 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                          <span className="font-medium text-white">{bolsa.nome}</span>
                        </div>
                      </td>

                      {visibleCols.map(({ index }) => (
                        <td key={index} className="px-4 py-3 text-[#8B8FA8] whitespace-nowrap">
                          {bolsa.dados?.colunas?.[index] ?? "—"}
                        </td>
                      ))}

                      <td className="px-4 py-3 whitespace-nowrap">
                        {bolsa.origem === "AUTO" ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
                            Importado
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400">
                            Manual
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {bolsa.origem === "MANUAL" && (
                            <button
                              onClick={() => setEditingBolsa(bolsa)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8B8FA8] hover:text-white hover:bg-[#2A2F45] transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemover(bolsa.id)}
                            disabled={removingId === bolsa.id}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8B8FA8] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <ModalAdicionarBolsa
          mode="add"
          extraHeaders={extraHeaders}
          onConfirm={handleAddManual}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingBolsa && (
        <ModalAdicionarBolsa
          mode="edit"
          initialNome={editingBolsa.nome}
          initialColunas={editingBolsa.dados?.colunas ?? []}
          extraHeaders={extraHeaders}
          onConfirm={handleEdit}
          onClose={() => setEditingBolsa(null)}
        />
      )}
    </>
  );
}
