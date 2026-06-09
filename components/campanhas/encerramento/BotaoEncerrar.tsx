"use client";

import React, { useState } from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { useAcertosManagerOptional } from "@/lib/campanhas/context/AcertosManagerContext";

export function BotaoEncerrar() {
  const manager = useAcertosManagerOptional();
  const [confirmando, setConfirmando] = useState(false);

  if (!manager) return null;
  const { activeId, activeAcerto, closeAcerto } = manager;
  if (!activeId || !activeAcerto) return null;

  if (activeAcerto.status === "Encerrado") {
    const dt = activeAcerto.dataEncerramento
      ? new Date(activeAcerto.dataEncerramento).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
        <CheckCircle className="w-4 h-4" />
        <span>Encerrado em {dt}</span>
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-sm text-amber-300 font-medium">Encerrar este acerto?</p>
          <p className="text-xs text-amber-400/80">
            Todos os dados serão travados. Não será possível editar lançamentos ou configurações após o encerramento.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20 transition-colors"
              onClick={() => { closeAcerto(activeId); setConfirmando(false); }}
            >
              Sim, encerrar
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white transition-colors"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="px-4 py-2 rounded-xl text-sm font-medium bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20 transition-colors"
      onClick={() => setConfirmando(true)}
    >
      Encerrar Acerto
    </button>
  );
}
