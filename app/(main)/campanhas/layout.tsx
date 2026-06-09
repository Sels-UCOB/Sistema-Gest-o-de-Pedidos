"use client";

import { AcertosManagerProvider } from "@/lib/campanhas/context/AcertosManagerContext";
import { AcertoProvider } from "@/lib/campanhas/context/AcertoContext";
import { ConfiguracaoProvider } from "@/lib/campanhas/context/ConfiguracaoContext";
import { LancamentoProvider } from "@/lib/campanhas/context/LancamentoContext";
import { LancamentoLiderProvider } from "@/lib/campanhas/context/LancamentoLiderContext";
import { DebitosProvider } from "@/lib/campanhas/context/DebitosContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/campanhas/acertos",           label: "Acertos" },
  { href: "/campanhas",                   label: "Importação" },
  { href: "/campanhas/lancamentos",       label: "Lançamentos" },
  { href: "/campanhas/lancamentos-lideres", label: "Líderes" },
  { href: "/campanhas/encerramento",      label: "Encerramento" },
  { href: "/campanhas/configuracoes",     label: "Configurações" },
];

function CampanhasSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 flex-wrap p-1 rounded-xl bg-[#1A1F2E] border border-[#2A2F45] mb-6">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/campanhas"
            ? pathname === "/campanhas"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-[#6C63FF] text-white"
                : "text-[#8B8FA8] hover:text-white hover:bg-[#2A2F45]/50"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function CampanhasLayout({ children }: { children: React.ReactNode }) {
  return (
    <AcertosManagerProvider>
      <AcertoProvider>
        <ConfiguracaoProvider>
          <LancamentoProvider>
            <LancamentoLiderProvider>
              <DebitosProvider>
                <CampanhasSubNav />
                {children}
              </DebitosProvider>
            </LancamentoLiderProvider>
          </LancamentoProvider>
        </ConfiguracaoProvider>
      </AcertoProvider>
    </AcertosManagerProvider>
  );
}
