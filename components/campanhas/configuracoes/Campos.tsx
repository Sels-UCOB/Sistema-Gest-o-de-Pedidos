"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useConfiguracao } from "@/lib/campanhas/context/ConfiguracaoContext";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Campo } from "@/lib/campanhas/types/configuracao";

const inputCls = "w-full rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors placeholder:text-[#8B8FA8]/50";
const labelCls = "block text-xs font-medium text-[#8B8FA8] mb-1.5";
const thCls = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]";
const tdCls = "px-4 py-3 text-sm text-[#8B8FA8]";
const btnSm = "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors";

export function Campos() {
  const { campos, addCampo, updateCampo, deleteCampo } = useConfiguracao();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", codigo: "" });
  const [novoForm, setNovoForm] = useState({ nome: "", codigo: "" });
  const [confirmarId, setConfirmarId] = useState<string | null>(null);

  const iniciarEdicao = (c: Campo) => { setEditandoId(c.id); setEditForm({ nome: c.nome, codigo: c.codigo }); };
  const salvarEdicao = () => {
    if (!editandoId || !editForm.nome.trim() || !editForm.codigo.trim()) return;
    updateCampo(editandoId, editForm);
    setEditandoId(null);
  };
  const handleAdd = () => {
    if (!novoForm.nome.trim() || !novoForm.codigo.trim()) return;
    addCampo(novoForm);
    setNovoForm({ nome: "", codigo: "" });
  };

  const campoAlvo = campos.find((c) => c.id === confirmarId);

  return (
    <div className="space-y-6">
      {confirmarId && campoAlvo && (
        <ConfirmDialog
          mensagem={`Deseja excluir o campo "${campoAlvo.nome}"?`}
          onConfirmar={() => { deleteCampo(confirmarId); setConfirmarId(null); }}
          onCancelar={() => setConfirmarId(null)}
        />
      )}

      <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2F45]">
                <th className={thCls}>Nome</th>
                <th className={thCls}>Código</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {campos.map((campo) =>
                editandoId === campo.id ? (
                  <tr key={campo.id} className="border-b border-[#2A2F45]/50 bg-[#6C63FF]/5">
                    <td className="px-4 py-2"><input className={inputCls} value={editForm.nome} onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))} /></td>
                    <td className="px-4 py-2"><input className={inputCls} value={editForm.codigo} onChange={(e) => setEditForm((p) => ({ ...p, codigo: e.target.value }))} /></td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1.5">
                        <button className={cn(btnSm, "bg-[#6C63FF]/15 text-[#6C63FF] hover:bg-[#6C63FF]/25")} onClick={salvarEdicao} type="button">Salvar</button>
                        <button className={cn(btnSm, "bg-[#2A2F45] text-[#8B8FA8] hover:text-white")} onClick={() => setEditandoId(null)} type="button">Cancelar</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={campo.id} className="border-b border-[#2A2F45]/50 last:border-0 hover:bg-[#2A2F45]/20 transition-colors">
                    <td className={cn(tdCls, "text-white font-medium")}>{campo.nome}</td>
                    <td className={tdCls}>{campo.codigo ? <code className="px-2 py-0.5 rounded bg-[#2A2F45] text-[#8B8FA8] font-mono text-xs">{campo.codigo}</code> : <span className="text-[#2A2F45]">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button className={cn(btnSm, "bg-[#2A2F45] text-[#8B8FA8] hover:text-white")} onClick={() => iniciarEdicao(campo)} type="button">Editar</button>
                        <button className={cn(btnSm, "bg-[#2A2F45] text-[#8B8FA8] hover:text-red-400")} onClick={() => setConfirmarId(campo.id)} type="button">Excluir</button>
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
        <h3 className="text-sm font-semibold text-white">Novo Campo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input className={inputCls} placeholder="Ex: ACN" value={novoForm.nome} onChange={(e) => setNovoForm((p) => ({ ...p, nome: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Código *</label>
            <input className={inputCls} placeholder="Código do campo" value={novoForm.codigo} onChange={(e) => setNovoForm((p) => ({ ...p, codigo: e.target.value }))} />
          </div>
        </div>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#6C63FF] text-white hover:bg-[#5A52E8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={handleAdd}
          disabled={!novoForm.nome.trim() || !novoForm.codigo.trim()}
          type="button"
        >
          + Adicionar Campo
        </button>
      </div>
    </div>
  );
}
