"use client";

import React, { useState } from "react";
import { TiposLancamento } from "@/components/campanhas/configuracoes/TiposLancamento";
import { Campos } from "@/components/campanhas/configuracoes/Campos";
import { Lideres } from "@/components/campanhas/configuracoes/Lideres";
import { cn } from "@/lib/utils";

type Aba = "tipos" | "campos" | "lideres";
const ABAS: { id: Aba; label: string }[] = [
  { id: "tipos",   label: "Tipos de Lançamento" },
  { id: "campos",  label: "Campos" },
  { id: "lideres", label: "Líderes" },
];

export default function ConfiguracoesPage() {
  const [aba, setAba] = useState<Aba>("tipos");

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Configurações</h1>
      <p className="text-sm text-[#8B8FA8] mt-1">Tipos de lançamento, campos e percentuais dos líderes.</p>

      <nav className="flex gap-1 p-1 rounded-xl bg-[#1A1F2E] border border-[#2A2F45] w-fit">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-current={aba === a.id ? "page" : undefined}
            onClick={() => setAba(a.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              aba === a.id
                ? "bg-[#6C63FF] text-white"
                : "text-[#8B8FA8] hover:text-white hover:bg-[#2A2F45]/50"
            )}
          >
            {a.label}
          </button>
        ))}
      </nav>

      <div>
        {aba === "tipos"   && <TiposLancamento />}
        {aba === "campos"  && <Campos />}
        {aba === "lideres" && <Lideres />}
      </div>
    </div>
  );
}
