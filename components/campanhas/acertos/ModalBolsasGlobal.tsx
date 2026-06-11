"use client";

import { useState, useMemo, useCallback } from "react";
import { X, Download, Trophy, Search, ArrowUpDown } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { useAcertosManager } from "@/lib/campanhas/context/AcertosManagerContext";
import { getBolsasParaAcertos } from "@/lib/campanhas/db/bolsa";
import { DocumentoBolsasGlobalPDF } from "@/lib/campanhas/pdf/DocumentoBolsasGlobalPDF";
import type { BolsaGlobalItem } from "@/lib/campanhas/types/bolsa";

const TIPOS = ["Sonhando Alto 1", "Sonhando Alto 2", "Verão", "Inverno", "Outro"] as const;

type SortKey = "nome" | "universidade" | "curso";

const inputCls =
  "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors";
const labelCls = "block text-xs font-medium text-[#8B8FA8] mb-1";

interface Props {
  onClose: () => void;
}

export function ModalBolsasGlobal({ onClose }: Props) {
  const { acertos } = useAcertosManager();

  const [tipoCampanha, setTipoCampanha] = useState("");
  const [ano, setAno] = useState("");
  const [universidade, setUniversidade] = useState("");

  const [bolsas, setBolsas] = useState<BolsaGlobalItem[]>([]);
  const [buscado, setBuscado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortAsc, setSortAsc] = useState(true);

  const anosDisponiveis = useMemo(() => {
    const set = new Set(acertos.map((a) => new Date(a.dataCriacao).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [acertos]);

  // Headers dinâmicos: do primeiro bolsa que tenha dados
  const extraHeaders: string[] = useMemo(
    () => bolsas.find((b) => b.dados?.headers?.length)?.dados?.headers ?? [],
    [bolsas]
  );

  // Colunas visíveis: apenas headers não-vazios com índice original (para alinhar com colunas)
  const visibleCols = useMemo(
    () =>
      extraHeaders
        .map((header, index) => ({ header, index }))
        .filter(({ header }) => header.trim() !== ""),
    [extraHeaders]
  );

  const universidadesDisponiveis = useMemo(() => {
    const set = new Set(bolsas.map((b) => b.universidade).filter(Boolean));
    return Array.from(set).sort();
  }, [bolsas]);

  const handleBuscar = useCallback(async () => {
    if (!tipoCampanha || !ano) return;
    setLoading(true);
    setError(null);
    try {
      const anoNum = parseInt(ano, 10);
      const acertosFiltrados = acertos.filter((a) => {
        if (a.tipoCampanha !== tipoCampanha) return false;
        return new Date(a.dataCriacao).getFullYear() === anoNum;
      });
      const resultado = await getBolsasParaAcertos(acertosFiltrados);
      setBolsas(resultado);
      setBuscado(true);
    } catch {
      setError("Erro ao buscar bolsas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [acertos, tipoCampanha, ano]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const bolsasFiltradas = useMemo(() => {
    let result = bolsas;
    if (universidade) {
      const u = universidade.toLowerCase();
      result = result.filter((b) => b.universidade.toLowerCase().includes(u));
    }
    return [...result].sort((a, b) => {
      const va = a[sortKey].toLowerCase();
      const vb = b[sortKey].toLowerCase();
      return sortAsc ? va.localeCompare(vb, "pt-BR") : vb.localeCompare(va, "pt-BR");
    });
  }, [bolsas, universidade, sortKey, sortAsc]);

  const handleExportarPDF = async () => {
    setExporting(true);
    try {
      const blob = await pdf(
        <DocumentoBolsasGlobalPDF
          tipoCampanha={tipoCampanha}
          ano={parseInt(ano, 10)}
          bolsas={bolsasFiltradas}
          extraHeaders={extraHeaders}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bolsas-${tipoCampanha.toLowerCase().replace(/\s+/g, "-")}-${ano}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button type="button" onClick={() => handleSort(col)} className="flex items-center gap-1 group">
      {label}
      <ArrowUpDown
        className={`w-3 h-3 transition-colors ${
          sortKey === col ? "text-[#6C63FF]" : "text-[#4A4F6A] group-hover:text-[#8B8FA8]"
        }`}
      />
    </button>
  );

  const podeBuscar = !!tipoCampanha && !!ano;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-6xl bg-[#1A1F2E] border border-[#2A2F45] rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2F45] shrink-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">Bolsas — Visão Global</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8B8FA8] hover:text-white hover:bg-[#2A2F45] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filtros */}
        <div className="px-6 py-4 border-b border-[#2A2F45] shrink-0">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-44">
              <label className={labelCls}>Tipo de Campanha *</label>
              <select
                className={inputCls}
                value={tipoCampanha}
                onChange={(e) => { setTipoCampanha(e.target.value); setBuscado(false); }}
              >
                <option value="">Selecione...</option>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="min-w-28">
              <label className={labelCls}>Ano *</label>
              <select
                className={inputCls}
                value={ano}
                onChange={(e) => { setAno(e.target.value); setBuscado(false); }}
              >
                <option value="">Selecione...</option>
                {anosDisponiveis.map((a) => <option key={a} value={String(a)}>{a}</option>)}
              </select>
            </div>

            {buscado && universidadesDisponiveis.length > 0 && (
              <div className="min-w-44">
                <label className={labelCls}>Universidade</label>
                <select
                  className={inputCls}
                  value={universidade}
                  onChange={(e) => setUniversidade(e.target.value)}
                >
                  <option value="">Todas</option>
                  {universidadesDisponiveis.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleBuscar}
              disabled={!podeBuscar || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#6C63FF] text-white hover:bg-[#5B52E8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              {loading ? "Buscando..." : "Buscar"}
            </button>

            {buscado && bolsasFiltradas.length > 0 && (
              <button
                type="button"
                onClick={handleExportarPDF}
                disabled={exporting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white disabled:opacity-50 transition-colors"
              >
                {exporting ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {exporting ? "Gerando..." : "Exportar PDF"}
              </button>
            )}
          </div>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          {!buscado ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Search className="w-8 h-8 text-[#4A4F6A] mb-3" />
              <p className="text-[#8B8FA8] text-sm">
                Selecione o tipo de campanha e o ano para buscar as bolsas.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
              <span className="text-[#8B8FA8] text-sm">Carregando...</span>
            </div>
          ) : bolsasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Trophy className="w-8 h-8 text-[#4A4F6A] mb-3" />
              <p className="text-white font-medium">Nenhuma bolsa encontrada</p>
              <p className="text-sm text-[#8B8FA8] mt-1">
                Nenhum colportor bateu bolsa nesta campanha.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#1A1F2E] border-b border-[#2A2F45]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] whitespace-nowrap">
                    <SortBtn col="nome" label="Colportor" />
                  </th>
                  {visibleCols.map(({ header, index }) => {
                    const lh = header.toLowerCase();
                    const sortCol: SortKey | null =
                      /universidade/i.test(lh) ? "universidade" :
                      /curso/i.test(lh) ? "curso" : null;
                    return (
                      <th key={index} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8] whitespace-nowrap">
                        {sortCol ? <SortBtn col={sortCol} label={header} /> : header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {bolsasFiltradas.map((bolsa) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {buscado && !loading && bolsasFiltradas.length > 0 && (
          <div className="px-6 py-3 border-t border-[#2A2F45] shrink-0 flex items-center justify-between">
            <p className="text-xs text-[#8B8FA8]">
              {bolsasFiltradas.length} colportor{bolsasFiltradas.length !== 1 ? "es" : ""} encontrado{bolsasFiltradas.length !== 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-sm text-[#8B8FA8] hover:text-white border border-[#2A2F45] hover:border-[#6C63FF]/50 transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
