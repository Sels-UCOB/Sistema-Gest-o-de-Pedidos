"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useConfiguracao } from "@/lib/campanhas/context/ConfiguracaoContext";
import type { TipoLancamento } from "@/lib/campanhas/types/configuracao";

interface Props { onSalvar: (id: string) => void; onFechar: () => void; }

const VAZIO: Omit<TipoLancamento, "id"> = { nome: "", conta: "", subconta: "", departamento: "" };
const inputCls = "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors placeholder:text-[#8B8FA8]/50";
const labelCls = "block text-xs font-medium text-[#8B8FA8] mb-1.5";

const herdaDaCampanha = (conta: string) => conta.startsWith("4");

export function NovoTipoModal({ onSalvar, onFechar }: Props) {
  const { tipos, addTipo } = useConfiguracao();
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!salvando || tipos.length === 0) return;
    onSalvar(tipos[tipos.length - 1].id);
  }, [tipos, salvando, onSalvar]);

  const podeSubmeter =
    form.nome.trim() !== "" &&
    form.conta.trim() !== "" &&
    (herdaDaCampanha(form.conta) || form.departamento.trim() !== "");

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!podeSubmeter) return;
    addTipo({
      ...form,
      departamento: herdaDaCampanha(form.conta) ? "" : form.departamento,
    });
    setSalvando(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onFechar}>
      <div className="w-full max-w-md rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2F45]">
          <h2 className="text-base font-semibold text-white">Novo Tipo de Lançamento</h2>
          <button type="button" onClick={onFechar} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8B8FA8] hover:text-white hover:bg-[#2A2F45] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input className={inputCls} placeholder="Nome do tipo" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Conta *</label>
            <input
              className={inputCls}
              placeholder="Código da conta"
              value={form.conta}
              onChange={(e) => setForm((p) => ({
                ...p,
                conta: e.target.value,
                departamento: herdaDaCampanha(e.target.value) ? "" : p.departamento,
              }))}
            />
          </div>
          <div>
            <label className={labelCls}>Subconta</label>
            <input className={inputCls} placeholder="Código da subconta (opcional)" value={form.subconta} onChange={(e) => setForm((p) => ({ ...p, subconta: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>
              Departamento {!herdaDaCampanha(form.conta) && "*"}
            </label>
            {herdaDaCampanha(form.conta) ? (
              <div className="flex items-center h-[38px] px-3 rounded-lg bg-[#0F1117] border border-[#2A2F45]">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Herda da campanha
                </span>
              </div>
            ) : (
              <input className={inputCls} placeholder="Nome do departamento" value={form.departamento} onChange={(e) => setForm((p) => ({ ...p, departamento: e.target.value }))} />
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onFechar} className="px-4 py-2 rounded-lg text-sm text-[#8B8FA8] hover:text-white border border-[#2A2F45] hover:border-[#6C63FF]/50 transition-colors">Cancelar</button>
            <button type="submit" disabled={!podeSubmeter} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#6C63FF] text-white hover:bg-[#5A52E8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Salvar Tipo</button>
          </div>
        </form>
      </div>
    </div>
  );
}
