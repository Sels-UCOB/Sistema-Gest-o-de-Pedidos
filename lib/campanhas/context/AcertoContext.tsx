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
import { supabase } from "@/lib/supabase";
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

// Debounce simples para não enviar ao Supabase a cada tecla
function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function AcertoProvider({ children }: { children: ReactNode }) {
  const manager = useAcertosManagerOptional();
  const activeId = manager?.activeId ?? null;
  const encerrado = manager?.activeAcerto?.status === "Encerrado";

  const [state, setState] = useState<AcertoState>(ESTADO_INICIAL);
  const lastActiveIdRef = useRef<string | null | undefined>(undefined);
  const debouncedState = useDebounce(state, 600);
  const activeIdForSave = useRef(activeId);
  const loadingRef = useRef(false);

  // Carrega do Supabase quando o acerto ativo muda
  useEffect(() => {
    if (lastActiveIdRef.current === activeId) return;
    lastActiveIdRef.current = activeId;
    activeIdForSave.current = activeId;

    // Reset completo evita que a config do acerto anterior vaze para o novo
    // via debounce enquanto o Supabase ainda não respondeu
    setState(ESTADO_INICIAL);

    if (!activeId) {
      loadingRef.current = false;
      return;
    }

    loadingRef.current = true;

    supabase
      .from("acerto_state")
      .select("dados_importados, config")
      .eq("acerto_id", activeId)
      .maybeSingle()
      .then(({ data }) => {
        if (activeIdForSave.current !== activeId) return;
        loadingRef.current = false;
        if (data) {
          setState({
            dadosImportados: data.dados_importados ?? null,
            config: data.config ?? CONFIG_INICIAL,
          });
        } else {
          setState(ESTADO_INICIAL);
        }
      });
  }, [activeId]);

  // Salva no Supabase (com debounce) quando estado muda.
  // loadingRef impede que o debounce dispare com estado do acerto anterior
  // enquanto o novo ainda não foi carregado do Supabase.
  useEffect(() => {
    const id = activeIdForSave.current;
    if (!id || loadingRef.current) return;

    supabase
      .from("acerto_state")
      .upsert(
        {
          acerto_id: id,
          dados_importados: debouncedState.dadosImportados,
          config: debouncedState.config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "acerto_id" }
      )
      .then(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedState]);

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
