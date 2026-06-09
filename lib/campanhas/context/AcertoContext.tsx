"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { AcertoState, DadosImportados, ConfigCampanha } from "@/lib/campanhas/types/acerto";
import { CONFIG_INICIAL } from "@/lib/campanhas/types/acerto";
import { useAcertosManagerOptional } from "@/lib/campanhas/context/AcertosManagerContext";

interface AcertoContextValue {
  state: AcertoState;
  encerrado: boolean;
  setDadosImportados: (dados: DadosImportados) => void;
  setConfig: (config: Partial<ConfigCampanha>) => void;
  updateLiderPercentual: (idx: number, pct: number) => void;
  resetDados: () => void;
}

const AcertoContext = createContext<AcertoContextValue | null>(null);

const ESTADO_INICIAL: AcertoState = { dadosImportados: null, config: CONFIG_INICIAL };

export function AcertoProvider({ children }: { children: ReactNode }) {
  const manager = useAcertosManagerOptional();
  const activeId = manager?.activeId ?? null;

  const encerrado = manager?.activeAcerto?.status === "Encerrado";

  const [state, setState] = useState<AcertoState>(ESTADO_INICIAL);
  const lastActiveIdRef = useRef<string | null | undefined>(undefined);

  // Carrega estado quando o acerto ativo muda
  useEffect(() => {
    if (lastActiveIdRef.current === activeId) return;
    lastActiveIdRef.current = activeId;

    if (!activeId) {
      setState(ESTADO_INICIAL);
      return;
    }

    const saved = localStorage.getItem(`acerto_${activeId}_state`);
    if (saved) {
      try {
        setState(JSON.parse(saved));
        return;
      } catch {
        localStorage.removeItem(`acerto_${activeId}_state`);
      }
    }
    setState(ESTADO_INICIAL);
  }, [activeId]);

  // Auto-salva quando estado muda
  useEffect(() => {
    if (!activeId) return;
    localStorage.setItem(`acerto_${activeId}_state`, JSON.stringify(state));
  }, [state, activeId]);

  const setDadosImportados = useCallback((dados: DadosImportados) => {
    if (encerrado) return;
    setState((s) => ({ ...s, dadosImportados: dados }));
  }, [encerrado]);

  const setConfig = useCallback((parcial: Partial<ConfigCampanha>) => {
    if (encerrado) return;
    setState((s) => ({ ...s, config: { ...s.config, ...parcial } }));
  }, [encerrado]);

  const updateLiderPercentual = useCallback((idx: number, pct: number) => {
    if (encerrado) return;
    setState((s) => {
      const lideres = s.config.lideres.map((l, i) =>
        i === idx ? { ...l, percentualDebito: pct } : l
      ) as ConfigCampanha["lideres"];
      return { ...s, config: { ...s.config, lideres } };
    });
  }, [encerrado]);

  const resetDados = useCallback(() => {
    if (encerrado) return;
    setState((s) => ({ ...s, dadosImportados: null }));
  }, [encerrado]);

  return (
    <AcertoContext.Provider
      value={{ state, encerrado, setDadosImportados, setConfig, updateLiderPercentual, resetDados }}
    >
      {children}
    </AcertoContext.Provider>
  );
}

export function useAcerto() {
  const ctx = useContext(AcertoContext);
  if (!ctx) throw new Error("useAcerto deve ser usado dentro de AcertoProvider");
  return ctx;
}
