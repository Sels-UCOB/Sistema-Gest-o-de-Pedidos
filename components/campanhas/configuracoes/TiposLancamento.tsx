"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useConfiguracao } from "@/lib/campanhas/context/ConfiguracaoContext";
import { ConfirmDialog } from "./ConfirmDialog";
import type { TipoLancamento } from "@/lib/campanhas/types/configuracao";

const VAZIO: Omit<TipoLancamento, "id"> = { nome: "", conta: "", subconta: "", departamento: "" };
const inputCls = "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors placeholder:text-[#8B8FA8]/50";
const labelCls = "block text-xs font-medium text-[#8B8FA8] mb-1.5";
const thCls = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]";
const tdCls = "px-4 py-3 text-sm text-[#8B8FA8]";
const btnSm = "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors";

const herdaDaCampanha = (conta: string) => conta.startsWith("4");

export function TiposLancamento() {
  const { tipos, addTipo, updateTipo, deleteTipo } = useConfiguracao();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<TipoLancamento, "id">>(VAZIO);
  const [novoForm, setNovoForm] = useState<Omit<TipoLancamento, "id">>(VAZIO);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);

  const iniciarEdicao = (t: TipoLancamento) => {
    setEditandoId(t.id);
    setEditForm({ nome: t.nome, conta: t.conta, subconta: t.subconta, departamento: t.departamento });
  };

  const salvarEdicao = () => {
    if (!editandoId || !editForm.nome.trim() || !editForm.conta.trim()) return;
    if (!herdaDaCampanha(editForm.conta) && !editForm.departamento.trim()) return;
    updateTipo(editandoId, {
      ...editForm,
      departamento: herdaDaCampanha(editForm.conta) ? "" : editForm.departamento,
    });
    setEditandoId(null);
  };

  const handleAdd = () => {
    if (!novoForm.nome.trim() || !novoForm.conta.trim()) return;
    if (!herdaDaCampanha(novoForm.conta) && !novoForm.departamento.trim()) return;
    addTipo({
      ...novoForm,
      departamento: herdaDaCampanha(novoForm.conta) ? "" : novoForm.departamento,
    });
    setNovoForm(VAZIO);
  };

  const tipoAlvo = tipos.find((t) => t.id === confirmarId);

  return (
    <div className="space-y-6">
      {confirmarId && tipoAlvo && (
        <ConfirmDialog
          mensagem={`Deseja excluir o tipo "${tipoAlvo.nome}"?`}
          onConfirmar={() => { deleteTipo(confirmarId); setConfirmarId(null); }}
          onCancelar={() => setConfirmarId(null)}
        />
      )}

      <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2F45]">
                {["Nome", "Conta", "Subconta", "Departamento", ""].map((h) => (
                  <th key={h} className={thCls}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tipos.map((tipo) =>
                editandoId === tipo.id ? (
                  <tr key={tipo.id} className="border-b border-[#2A2F45]/50 bg-[#6C63FF]/5">
                    <td className="px-4 py-2">
                      <input className={inputCls} value={editForm.nome} onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))} />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className={inputCls}
                        value={editForm.conta}
                        onChange={(e) => setEditForm((p) => ({
                          ...p,
                          conta: e.target.value,
                          departamento: herdaDaCampanha(e.target.value) ? "" : p.departamento,
                        }))}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input className={inputCls} value={editForm.subconta} onChange={(e) => setEditForm((p) => ({ ...p, subconta: e.target.value }))} />
                    </td>
                    <td className="px-4 py-2">
                      {herdaDaCampanha(editForm.conta) ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Herda da campanha
                        </span>
                      ) : (
                        <input className={inputCls} value={editForm.departamento} onChange={(e) => setEditForm((p) => ({ ...p, departamento: e.target.value }))} />
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1.5">
                        <button className={cn(btnSm, "bg-[#6C63FF]/15 text-[#6C63FF] hover:bg-[#6C63FF]/25")} onClick={salvarEdicao} type="button">Salvar</button>
                        <button className={cn(btnSm, "bg-[#2A2F45] text-[#8B8FA8] hover:text-white")} onClick={() => setEditandoId(null)} type="button">Cancelar</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={tipo.id} className="border-b border-[#2A2F45]/50 last:border-0 hover:bg-[#2A2F45]/20 transition-colors">
                    <td className={cn(tdCls, "text-white font-medium")}>{tipo.nome}</td>
                    <td className={tdCls}>{tipo.conta || <span className="text-[#2A2F45]">—</span>}</td>
                    <td className={tdCls}>{tipo.subconta || <span className="text-[#2A2F45]">—</span>}</td>
                    <td className={tdCls}>
                      {herdaDaCampanha(tipo.conta) ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Herda da campanha
                        </span>
                      ) : (
                        tipo.departamento || <span className="text-[#2A2F45]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button className={cn(btnSm, "bg-[#2A2F45] text-[#8B8FA8] hover:text-white")} onClick={() => iniciarEdicao(tipo)} type="button">Editar</button>
                        <button className={cn(btnSm, "bg-[#2A2F45] text-[#8B8FA8] hover:text-red-400")} onClick={() => setConfirmarId(tipo.id)} type="button">Excluir</button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Novo Tipo de Lançamento</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input className={inputCls} placeholder="Nome do tipo" value={novoForm.nome} onChange={(e) => setNovoForm((p) => ({ ...p, nome: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Conta *</label>
            <input
              className={inputCls}
              placeholder="Código da conta"
              value={novoForm.conta}
              onChange={(e) => setNovoForm((p) => ({
                ...p,
                conta: e.target.value,
                departamento: herdaDaCampanha(e.target.value) ? "" : p.departamento,
              }))}
            />
          </div>
          <div>
            <label className={labelCls}>Subconta</label>
            <input className={inputCls} placeholder="Código da subconta (opcional)" value={novoForm.subconta} onChange={(e) => setNovoForm((p) => ({ ...p, subconta: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>
              Departamento {!herdaDaCampanha(novoForm.conta) && "*"}
            </label>
            {herdaDaCampanha(novoForm.conta) ? (
              <div className="flex items-center h-[38px] px-3 rounded-lg bg-[#0F1117] border border-[#2A2F45]">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Herda da campanha
                </span>
              </div>
            ) : (
              <input className={inputCls} placeholder="Nome do departamento" value={novoForm.departamento} onChange={(e) => setNovoForm((p) => ({ ...p, departamento: e.target.value }))} />
            )}
          </div>
        </div>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#6C63FF] text-white hover:bg-[#5A52E8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={handleAdd}
          disabled={
            !novoForm.nome.trim() ||
            !novoForm.conta.trim() ||
            (!herdaDaCampanha(novoForm.conta) && !novoForm.departamento.trim())
          }
          type="button"
        >
          + Adicionar Tipo
        </button>
      </div>
    </div>
  );
}
