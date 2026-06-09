"use client";

import React, { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { parseRelatorioSaldo } from "@/lib/campanhas/parseRelatorioSaldo";
import type { DadosImportados } from "@/lib/campanhas/types/acerto";

interface Props { onImportado: (dados: DadosImportados) => void; }

export function XlsxUploader({ onImportado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  const processar = useCallback(async (arquivo: File) => {
    if (!arquivo.name.match(/\.(xlsx|xlsm|xls)$/i)) { setErro("Formato inválido. Envie um arquivo .xlsx ou .xlsm"); return; }
    setErro(null);
    setCarregando(true);
    setNomeArquivo(arquivo.name);
    try {
      const dados = await parseRelatorioSaldo(arquivo);
      onImportado(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao processar arquivo.");
      setNomeArquivo(null);
    } finally {
      setCarregando(false);
    }
  }, [onImportado]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processar(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processar(f);
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer",
        arrastando ? "border-[#6C63FF] bg-[#6C63FF]/10" : "border-[#2A2F45] hover:border-[#6C63FF]/50 hover:bg-[#2A2F45]/20",
        carregando && "pointer-events-none opacity-60"
      )}
      onClick={() => !carregando && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
      onDragLeave={() => setArrastando(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      aria-label="Área de upload do relatório de saldo"
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={onFileChange} className="hidden" aria-hidden />

      <div className="w-12 h-12 rounded-xl bg-[#6C63FF]/10 border border-[#6C63FF]/20 flex items-center justify-center">
        {carregando ? (
          <span className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" aria-label="Processando..." />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#6C63FF]" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </div>

      <div className="space-y-1">
        {carregando ? (
          <p className="text-sm text-[#8B8FA8]">Processando <strong className="text-white">{nomeArquivo}</strong>…</p>
        ) : nomeArquivo ? (
          <p className="text-sm text-[#8B8FA8]">✓ <strong className="text-white">{nomeArquivo}</strong> — clique para trocar</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-white">Arraste o relatório de saldo</p>
            <p className="text-xs text-[#8B8FA8]">ou clique para selecionar · .xlsx / .xlsm</p>
          </>
        )}
      </div>

      {erro && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm" role="alert">
          ⚠ {erro}
        </div>
      )}
    </div>
  );
}
