"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  mensagem: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmDialog({ mensagem, onConfirmar, onCancelar }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal>
      <div className="w-full max-w-sm rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] shadow-2xl shadow-black/50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-sm text-white">{mensagem}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancelar} className="px-4 py-2 rounded-lg text-sm text-[#8B8FA8] hover:text-white border border-[#2A2F45] hover:border-[#6C63FF]/50 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
            Sim, excluir
          </button>
        </div>
      </div>
    </div>
  );
}
