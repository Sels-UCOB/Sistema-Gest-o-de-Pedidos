"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { useAcertosManagerOptional } from "@/lib/campanhas/context/AcertosManagerContext";

export function BotaoEncerrar() {
  const manager = useAcertosManagerOptional();
  const [confirmando, setConfirmando] = useState(false);
  const [lote, setLote] = useState<string>("");

  if (!manager) return null;
  const { activeId, activeAcerto, closeAcerto, updateAcerto } = manager;
  if (!activeId || !activeAcerto) return null;

  if (activeAcerto.status === "Encerrado") {
    const dt = activeAcerto.dataEncerramento
      ? new Date(activeAcerto.dataEncerramento).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";
    return (
      <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[#2A2F45]">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>Encerrado em {dt}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[#8B8FA8]">Lote AASI</label>
          <input
            type="number"
            className="w-28 rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-1.5 focus:outline-none focus:border-[#6C63FF] transition-colors"
            placeholder="Nº do lote"
            min={0}
            value={activeAcerto.loteAASI ?? ""}
            onChange={(e) => updateAcerto(activeId, { loteAASI: e.target.value === "" ? undefined : parseInt(e.target.value) })}
          />
        </div>
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className="pt-4 border-t border-[#2A2F45]">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#8B8FA8]">Lote AASI</label>
            <input
              type="number"
              className="w-28 rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-1.5 focus:outline-none focus:border-[#6C63FF] transition-colors"
              placeholder="Nº do lote"
              min={0}
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex-1">
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
                  onClick={() => {
                    const loteNum = lote !== "" ? parseInt(lote) : undefined;
                    closeAcerto(activeId, loteNum);
                    setConfirmando(false);
                  }}
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-4 pt-4 border-t border-[#2A2F45]">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[#8B8FA8]">Lote AASI</label>
        <input
          type="number"
          className="w-28 rounded-lg bg-[#0F1117] border border-[#2A2F45] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#6C63FF] transition-colors"
          placeholder="Nº do lote"
          min={0}
          value={lote}
          onChange={(e) => setLote(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="px-4 py-2 rounded-xl text-sm font-medium bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20 transition-colors"
        onClick={() => setConfirmando(true)}
      >
        Encerrar Acerto
      </button>
    </div>
  );
}
