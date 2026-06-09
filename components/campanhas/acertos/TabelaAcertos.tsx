"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";
import type { AcertoMeta } from "@/lib/campanhas/types/acertoManager";
import { BadgeStatus } from "./BadgeStatus";

interface Props {
  acertos: AcertoMeta[];
  activeId: string | null;
  onEntrar: (acerto: AcertoMeta) => void;
  onEditar: (acerto: AcertoMeta) => void;
  onExcluir: (acerto: AcertoMeta) => void;
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function TabelaAcertos({ acertos, activeId, onEntrar, onEditar, onExcluir }: Props) {
  const [confirmarExcluir, setConfirmarExcluir] = useState<string | null>(null);

  if (acertos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-[#1A1F2E] border border-[#2A2F45]">
        <div className="w-12 h-12 rounded-full bg-[#2A2F45] flex items-center justify-center mb-4"><ClipboardList className="w-5 h-5 text-[#8B8FA8]" /></div>
        <p className="text-white font-medium">Nenhum acerto encontrado.</p>
        <p className="text-sm text-[#8B8FA8] mt-1">Clique em &quot;Novo Acerto&quot; para começar.</p>
      </div>
    );
  }

  const handleExcluirConfirmar = (acerto: AcertoMeta) => {
    if (confirmarExcluir === acerto.id) {
      onExcluir(acerto);
      setConfirmarExcluir(null);
    } else {
      setConfirmarExcluir(acerto.id);
    }
  };

  const btnBase = "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors";

  return (
    <div className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2F45]">
              {["Nome", "Campo", "Tipo de Campanha", "Criado em", "Status", "Ações"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#8B8FA8]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {acertos.map((a) => (
              <tr
                key={a.id}
                className={cn(
                  "border-b border-[#2A2F45]/50 last:border-0 transition-colors hover:bg-[#2A2F45]/20",
                  a.id === activeId && "bg-[#6C63FF]/5"
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{a.nome}</span>
                    {a.id === activeId && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#6C63FF]/20 text-[#6C63FF]">ativo</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#8B8FA8]">{a.campo}</td>
                <td className="px-4 py-3 text-[#8B8FA8]">{a.tipoCampanha}</td>
                <td className="px-4 py-3 text-[#8B8FA8]">{fmtData(a.dataCriacao)}</td>
                <td className="px-4 py-3"><BadgeStatus status={a.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {a.status === "Encerrado" ? (
                      <button className={cn(btnBase, "bg-[#2A2F45] text-[#8B8FA8] hover:text-white")} onClick={() => onEntrar(a)}>
                        Visualizar
                      </button>
                    ) : (
                      <>
                        <button className={cn(btnBase, "bg-[#6C63FF]/15 text-[#6C63FF] hover:bg-[#6C63FF]/25")} onClick={() => onEntrar(a)}>
                          Entrar
                        </button>
                        <button className={cn(btnBase, "bg-[#2A2F45] text-[#8B8FA8] hover:text-white")} onClick={() => onEditar(a)}>
                          Editar
                        </button>
                        {a.status === "Criado" && (
                          <button
                            className={cn(btnBase, confirmarExcluir === a.id
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              : "bg-[#2A2F45] text-[#8B8FA8] hover:text-red-400"
                            )}
                            onClick={() => handleExcluirConfirmar(a)}
                            onBlur={() => setConfirmarExcluir((p) => p === a.id ? null : p)}
                          >
                            {confirmarExcluir === a.id ? "Confirmar?" : "Excluir"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
