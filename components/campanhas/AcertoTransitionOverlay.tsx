"use client";

import { useLancamento } from "@/lib/campanhas/context/LancamentoContext";

export function AcertoTransitionOverlay() {
  const { transitionState } = useLancamento();

  if (transitionState === "idle") return null;

  const label = transitionState === "salvando" ? "Salvando lançamentos..." : "Carregando lançamentos...";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm">
      <div className="w-10 h-10 rounded-full border-4 border-[#6C63FF]/30 border-t-[#6C63FF] animate-spin" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
