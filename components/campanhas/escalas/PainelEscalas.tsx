"use client";

import { useState, useEffect, useCallback } from "react";
import { FileSpreadsheet } from "lucide-react";
import { uploadAnexo, listAnexos, softDeleteAnexo } from "@/lib/campanhas/db/anexos";
import type { AcertoAnexo } from "@/lib/campanhas/types/anexo";
import { PageNav } from "@/components/ui/page-nav";
import { AnexoUploader } from "./AnexoUploader";
import { ModalPreviewAnexo } from "./ModalPreviewAnexo";

const PAGE_SIZE = 10;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Props {
  acertoId: string;
}

export function PainelEscalas({ acertoId }: Props) {
  const [anexos, setAnexos] = useState<AcertoAnexo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewAnexo, setPreviewAnexo] = useState<AcertoAnexo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listAnexos(acertoId, p, PAGE_SIZE);
        setAnexos(result.data);
        setTotal(result.total);
      } catch {
        setError("Erro ao carregar escalas. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [acertoId]
  );

  useEffect(() => {
    load(page);
  }, [load, page]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await uploadAnexo(acertoId, file);
      setPage(0);
      await load(0);
    } catch {
      setError("Erro ao enviar arquivo. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setConfirmDelete(null);
    try {
      await softDeleteAnexo(id);
      await load(page);
    } catch {
      setError("Erro ao excluir escala. Tente novamente.");
    }
  };

  const btnBase = "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors";

  return (
    <div className="space-y-4">
      <AnexoUploader onUpload={handleUpload} uploading={uploading} />

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] overflow-hidden">
        {loading && anexos.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : anexos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2A2F45] flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-5 h-5 text-[#8B8FA8]" />
            </div>
            <p className="text-white font-medium">Nenhuma escala anexada</p>
            <p className="text-sm text-[#8B8FA8] mt-1">
              Envie um arquivo XLSX acima para começar.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A2F45]">
                    {["Nome", "Data", "Tamanho", "Ações"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {anexos.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-[#2A2F45]/50 last:border-0 hover:bg-[#2A2F45]/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="font-medium text-white truncate max-w-xs">
                            {a.nome}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#8B8FA8] whitespace-nowrap">
                        {fmtData(a.data_upload)}
                      </td>
                      <td className="px-4 py-3 text-[#8B8FA8] whitespace-nowrap">
                        {fmtSize(a.tamanho)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            className={`${btnBase} bg-[#6C63FF]/15 text-[#6C63FF] hover:bg-[#6C63FF]/25`}
                            onClick={() => setPreviewAnexo(a)}
                          >
                            Visualizar
                          </button>
                          <a
                            href={a.file_url}
                            download={a.nome}
                            className={`${btnBase} bg-[#2A2F45] text-[#8B8FA8] hover:text-white`}
                          >
                            Baixar
                          </a>
                          <button
                            className={`${btnBase} ${
                              confirmDelete === a.id
                                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                : "bg-[#2A2F45] text-[#8B8FA8] hover:text-red-400"
                            }`}
                            onClick={() => handleDelete(a.id)}
                            onBlur={() =>
                              setConfirmDelete((p) => (p === a.id ? null : p))
                            }
                          >
                            {confirmDelete === a.id ? "Confirmar?" : "Excluir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PageNav
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={setPage}
              loading={loading}
            />
          </>
        )}
      </div>

      {previewAnexo && (
        <ModalPreviewAnexo
          anexo={previewAnexo}
          onClose={() => setPreviewAnexo(null)}
        />
      )}
    </div>
  );
}
