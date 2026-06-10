"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, RefreshCw, FileSearch } from "lucide-react";
import { getBolsaData } from "@/lib/campanhas/db/bolsa";
import type { BolsaData } from "@/lib/campanhas/types/bolsa";
import type { AcertoAnexo } from "@/lib/campanhas/types/anexo";

interface Props {
  acertoId: string;
}

export function PainelBolsas({ acertoId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anexo, setAnexo] = useState<AcertoAnexo | null>(null);
  const [data, setData] = useState<BolsaData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBolsaData(acertoId);
      setAnexo(result.anexo);
      setData(result.data);
    } catch {
      setError("Erro ao processar o arquivo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [acertoId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#8B8FA8] text-sm">Processando anexos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h2 className="text-white font-semibold">Colportores que bateram a bolsa</h2>
          {data && data.colportores.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-xs font-medium">
              {data.colportores.length}
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Reprocessar
        </button>
      </div>

      {/* Source file info */}
      {anexo && (
        <p className="text-xs text-[#8B8FA8]">
          Fonte:{" "}
          <span className="text-white">{anexo.nome}</span>
        </p>
      )}

      {/* Content */}
      <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] overflow-hidden">
        {!anexo ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-[#2A2F45] flex items-center justify-center mb-4">
              <FileSearch className="w-5 h-5 text-[#8B8FA8]" />
            </div>
            <p className="text-white font-medium">Arquivo não encontrado</p>
            <p className="text-sm text-[#8B8FA8] mt-1">
              Nenhum arquivo{" "}
              <span className="text-white font-mono">BagColporteurReport</span>{" "}
              encontrado nos anexos deste acerto.
            </p>
          </div>
        ) : !data || data.colportores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2A2F45] flex items-center justify-center mb-4">
              <Trophy className="w-5 h-5 text-[#8B8FA8]" />
            </div>
            <p className="text-white font-medium">Nenhum colportor identificado</p>
            <p className="text-sm text-[#8B8FA8] mt-1">
              O arquivo foi encontrado mas não contém dados de bolsa.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2F45]">
                  {data.headers.map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.colportores.map((col, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-[#2A2F45]/50 last:border-0 hover:bg-[#2A2F45]/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        <span className="font-medium text-white">{col.nome}</span>
                      </div>
                    </td>
                    {col.colunas.map((val, ci) => (
                      <td
                        key={ci}
                        className="px-4 py-3 text-[#8B8FA8] whitespace-nowrap"
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
