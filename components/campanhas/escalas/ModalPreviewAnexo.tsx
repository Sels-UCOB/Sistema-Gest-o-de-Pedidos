"use client";

import { useEffect, useState, useCallback } from "react";
import { X, FileSpreadsheet, Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { loadAttachmentForPreview } from "@/lib/campanhas/db/anexos";
import { DocumentoEscalaPDF } from "@/lib/campanhas/pdf/DocumentoEscalaPDF";
import type { AcertoAnexo, PreviewSheet } from "@/lib/campanhas/types/anexo";

interface Props {
  anexo: AcertoAnexo;
  onClose: () => void;
}

export function ModalPreviewAnexo({ anexo, onClose }: Props) {
  const [sheets, setSheets] = useState<PreviewSheet[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    loadAttachmentForPreview(anexo.id)
      .then((d) => { setSheets(d); setLoading(false); })
      .catch(() => { setError("Falha ao carregar o arquivo."); setLoading(false); });
  }, [anexo.id]);

  const handleGerarPdf = useCallback(async () => {
    if (!sheets) return;
    setGerandoPdf(true);
    try {
      const blob = await pdf(
        <DocumentoEscalaPDF nomeAnexo={anexo.nome} sheets={sheets} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = anexo.nome.replace(/\.(xlsx|xls)$/i, "") + ".pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGerandoPdf(false);
    }
  }, [sheets, anexo.nome]);

  const sheet = sheets?.[activeSheet];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2F45] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
            <span className="text-white font-medium text-sm truncate">{anexo.nome}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {sheets && (
              <button
                type="button"
                disabled={gerandoPdf}
                onClick={handleGerarPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white disabled:opacity-50 transition-colors"
              >
                {gerandoPdf ? (
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                {gerandoPdf ? "Gerando..." : "Gerar PDF"}
              </button>
            )}
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8B8FA8] hover:text-white hover:bg-[#2A2F45] transition-colors"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3">
              <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
              <span className="text-[#8B8FA8] text-sm">Carregando arquivo...</span>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
              {error}
            </div>
          )}

          {sheets && (
            <>
              {/* Sheet tabs */}
              {sheets.length > 1 && (
                <div className="flex gap-1 flex-wrap shrink-0">
                  {sheets.map((s, i) => (
                    <button
                      key={i}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        i === activeSheet
                          ? "bg-[#6C63FF] text-white"
                          : "bg-[#2A2F45] text-[#8B8FA8] hover:text-white"
                      }`}
                      onClick={() => setActiveSheet(i)}
                    >
                      {s.sheetName}
                    </button>
                  ))}
                </div>
              )}

              {/* Table */}
              {sheet && (
                <div className="flex-1 overflow-auto rounded-xl border border-[#2A2F45] min-h-0">
                  {sheet.rows.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-[#8B8FA8] text-sm">
                      Aba sem dados
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#0F1117] z-10">
                        <tr className="border-b border-[#2A2F45]">
                          {sheet.headers.map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[#8B8FA8] whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.rows.map((row, i) => (
                          <tr
                            key={i}
                            className="border-b border-[#2A2F45]/50 last:border-0 hover:bg-[#2A2F45]/20"
                          >
                            {sheet.headers.map((h) => (
                              <td key={h} className="px-3 py-2 text-[#C4C8D8] whitespace-nowrap">
                                {row[h] == null ? "" : String(row[h])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <p className="text-xs text-[#8B8FA8] text-right shrink-0">
                {sheet?.rows.length ?? 0} linha{sheet?.rows.length !== 1 ? "s" : ""}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
