"use client";

import { AcertosManagerProvider } from "@/lib/campanhas/context/AcertosManagerContext";
import { AcertoProvider } from "@/lib/campanhas/context/AcertoContext";
import { ConfiguracaoProvider } from "@/lib/campanhas/context/ConfiguracaoContext";
import { LancamentoProvider } from "@/lib/campanhas/context/LancamentoContext";
import { LancamentoLiderProvider } from "@/lib/campanhas/context/LancamentoLiderContext";
import { DebitosProvider } from "@/lib/campanhas/context/DebitosContext";
import { MigracaoLocalStorage } from "@/components/campanhas/MigracaoLocalStorage";

export default function CampanhasLayout({ children }: { children: React.ReactNode }) {
  return (
    <AcertosManagerProvider>
      <AcertoProvider>
        <ConfiguracaoProvider>
          <LancamentoProvider>
            <LancamentoLiderProvider>
              <DebitosProvider>
                {children}
                <MigracaoLocalStorage />
              </DebitosProvider>
            </LancamentoLiderProvider>
          </LancamentoProvider>
        </ConfiguracaoProvider>
      </AcertoProvider>
    </AcertosManagerProvider>
  );
}
