import React from "react";
import { cn } from "@/lib/utils";
import type { StatusAcerto } from "@/lib/campanhas/types/acertoManager";

interface Props {
  status: StatusAcerto;
}

const STYLES: Record<StatusAcerto, string> = {
  Criado: "bg-[#2A2F45] text-[#8B8FA8]",
  "Em Aberto": "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  Encerrado: "bg-green-500/15 text-green-400 border border-green-500/20",
};

export function BadgeStatus({ status }: Props) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", STYLES[status])}>
      {status}
    </span>
  );
}
