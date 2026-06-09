"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { AcertoMeta, CriarAcertoData } from "@/lib/campanhas/types/acertoManager";

const CAMPOS = ["ALM", "AOM", "ASM", "ABC", "APLAC", "MTO", "IDEC", "Outro"] as const;
const TIPOS_CAMPANHA = ["Sonhando Alto 1", "Sonhando Alto 2", "Verão", "Inverno", "Outro"] as const;

const inputCls = "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors placeholder:text-[#8B8FA8]/50";
const labelCls = "block text-xs font-medium text-[#8B8FA8] mb-1.5";

interface Props {
  onClose: () => void;
  onSalvar: (data: CriarAcertoData) => void;
  dadosIniciais?: Pick<AcertoMeta, "nome" | "campo" | "tipoCampanha">;
  modoEdicao?: boolean;
}

export function ModalCriarAcerto({ onClose, onSalvar, dadosIniciais, modoEdicao }: Props) {
  const [nome, setNome] = useState(dadosIniciais?.nome ?? "");
  const [campo, setCampo] = useState(dadosIniciais?.campo ?? "AOM");
  const [tipoCampanha, setTipoCampanha] = useState(dadosIniciais?.tipoCampanha ?? "Sonhando Alto 1");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    onSalvar({ nome: nome.trim(), campo, tipoCampanha });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2F45]">
          <h2 className="text-base font-semibold text-white">
            {modoEdicao ? "Editar Acerto" : "Novo Acerto"}
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8B8FA8] hover:text-white hover:bg-[#2A2F45] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="acerto-nome" className={labelCls}>Nome / Identificador</label>
            <input
              id="acerto-nome"
              type="text"
              className={inputCls}
              placeholder="Ex: Sonhando Alto 1 — AOM 2026"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="acerto-campo" className={labelCls}>Campo</label>
            <select id="acerto-campo" className={inputCls} value={campo} onChange={(e) => setCampo(e.target.value)}>
              {CAMPOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="acerto-tipo" className={labelCls}>Tipo de Campanha</label>
            <select id="acerto-tipo" className={inputCls} value={tipoCampanha} onChange={(e) => setTipoCampanha(e.target.value)}>
              {TIPOS_CAMPANHA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2A2F45]">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#8B8FA8] hover:text-white border border-[#2A2F45] hover:border-[#6C63FF]/50 transition-colors">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={!nome.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#6C63FF] text-white hover:bg-[#5A52E8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {modoEdicao ? "Salvar" : "Criar Acerto"}
          </button>
        </div>
      </div>
    </div>
  );
}
