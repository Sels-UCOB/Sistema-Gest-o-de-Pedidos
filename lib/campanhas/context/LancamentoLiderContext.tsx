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
import type { CartaBolsa } from "@/lib/campanhas/types/lancamentoLider";
import { useAcertosManagerOptional } from "@/lib/campanhas/context/AcertosManagerContext";

interface LancamentoLiderContextValue {
  cartaBolsa: CartaBolsa;
  jurosCampanha: number | null;
  encerrado: boolean;
  updateCartaBolsa: (parcial: Partial<CartaBolsa>) => void;
  setJurosCampanha: (v: number | null) => void;
}

const LancamentoLiderContext = createContext<LancamentoLiderContextValue | null>(null);

const CARTA_INICIAL: CartaBolsa = { valor: 0, liderReceptor: "" };

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function LancamentoLiderProvider({ children }: { children: ReactNode }) {
  const manager = useAcertosManagerOptional();
  const activeId = manager?.activeId ?? null;
  const encerrado = manager?.activeAcerto?.status === "Encerrado";

  const [cartaBolsa, setCartaBolsa] = useState<CartaBolsa>(CARTA_INICIAL);
  const [jurosCampanha, setJurosCampanhaState] = useState<number | null>(null);
  const lastActiveIdRef = useRef<string | null | undefined>(undefined);
  const activeIdForSave = useRef(activeId);
  const loadingRef = useRef(false);

  const debouncedCarta = useDebounce(cartaBolsa, 600);
  const debouncedJuros = useDebounce(jurosCampanha, 600);

  // Carrega do Supabase quando o acerto ativo muda
  useEffect(() => {
    if (lastActiveIdRef.current === activeId) return;
    lastActiveIdRef.current = activeId;
    activeIdForSave.current = activeId;

    if (!activeId) {
      loadingRef.current = false;
      setCartaBolsa(CARTA_INICIAL);
      setJurosCampanhaState(null);
      return;
    }

    loadingRef.current = true;

    supabase
      .from("acerto_lider")
      .select("carta_bolsa, juros_campanha")
      .eq("acerto_id", activeId)
      .maybeSingle()
      .then(({ data }) => {
        if (activeIdForSave.current !== activeId) return;
        loadingRef.current = false;
        if (data) {
          setCartaBolsa(data.carta_bolsa ?? CARTA_INICIAL);
          setJurosCampanhaState(data.juros_campanha ?? null);
        } else {
          setCartaBolsa(CARTA_INICIAL);
          setJurosCampanhaState(null);
        }
      });
  }, [activeId]);

  // Salva no Supabase (debounced).
  // loadingRef impede que o debounce dispare com dados do acerto anterior
  // enquanto o novo ainda está carregando.
  useEffect(() => {
    const id = activeIdForSave.current;
    if (!id || loadingRef.current) return;

    supabase
      .from("acerto_lider")
      .upsert(
        {
          acerto_id: id,
          carta_bolsa: debouncedCarta,
          juros_campanha: debouncedJuros,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "acerto_id" }
      )
      .then(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCarta, debouncedJuros]);

  const updateCartaBolsa = useCallback((parcial: Partial<CartaBolsa>) => {
    if (encerrado) return;
    setCartaBolsa((prev) => ({ ...prev, ...parcial }));
  }, [encerrado]);

  const setJurosCampanha = useCallback((v: number | null) => {
    if (encerrado) return;
    setJurosCampanhaState(v);
  }, [encerrado]);

  return (
    <LancamentoLiderContext.Provider
      value={{ cartaBolsa, jurosCampanha, encerrado, updateCartaBolsa, setJurosCampanha }}
    >
      {children}
    </LancamentoLiderContext.Provider>
  );
}

export function useLancamentoLider() {
  const ctx = useContext(LancamentoLiderContext);
  if (!ctx)
    throw new Error("useLancamentoLider deve ser usado dentro de LancamentoLiderProvider");
  return ctx;
}
