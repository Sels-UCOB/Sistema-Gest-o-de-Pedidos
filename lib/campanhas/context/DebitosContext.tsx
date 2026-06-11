"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { DevedorColportor, GastosLider, DebitoAdicional } from "@/lib/campanhas/types/debitos";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { useAcertosManagerOptional } from "@/lib/campanhas/context/AcertosManagerContext";

interface DebitosContextValue {
  encerrado: boolean;
  devedores: DevedorColportor[];
  addDevedor: () => void;
  updateDevedor: (id: string, parcial: Partial<Omit<DevedorColportor, "id">>) => void;
  removeDevedor: (id: string) => void;
  gastosLideres: GastosLider[];
  setGastosLider: (idx: number, gastos: number) => void;
  addDebitoAdicional: (liderIdx: number, preset?: { descricao: string; valor: number }) => void;
  updateDebitoAdicional: (liderIdx: number, id: string, parcial: Partial<Omit<DebitoAdicional, "id">>) => void;
  removeDebitoAdicional: (liderIdx: number, id: string) => void;
  gastosCaixa: GastosLider;
  setGastosCaixa: (gastos: number) => void;
  addDebitoAdicionalCaixa: () => void;
  updateDebitoAdicionalCaixa: (id: string, parcial: Partial<Omit<DebitoAdicional, "id">>) => void;
  removeDebitoAdicionalCaixa: (id: string) => void;
  salvar: () => void;
}

const DebitosContext = createContext<DebitosContextValue | null>(null);

let _seq = 5000;
const genId = () => `d${_seq++}`;

const GASTOS_VAZIO: GastosLider = { gastos: 0, debitosAdicionais: [] };
const gastosLideresVazio = () => [
  { ...GASTOS_VAZIO, debitosAdicionais: [] },
  { ...GASTOS_VAZIO, debitosAdicionais: [] },
  { ...GASTOS_VAZIO, debitosAdicionais: [] },
  { ...GASTOS_VAZIO, debitosAdicionais: [] },
];

function buildDevedores(nomes: string[], saldos: number[]): DevedorColportor[] {
  return nomes
    .map((nome, i) =>
      saldos[i] < 0 ? { id: genId(), nome, valorDebito: Math.abs(saldos[i]) } : null
    )
    .filter(Boolean) as DevedorColportor[];
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function DebitosProvider({ children }: { children: ReactNode }) {
  const { state } = useAcerto();
  const manager = useAcertosManagerOptional();
  const activeId = manager?.activeId ?? null;
  const encerrado = manager?.activeAcerto?.status === "Encerrado";

  const [devedores, setDevedores] = useState<DevedorColportor[]>([]);
  const [gastosLideres, setGastosLideresState] = useState<GastosLider[]>(gastosLideresVazio());
  const [gastosCaixa, setGastosCaixaState] = useState<GastosLider>({ ...GASTOS_VAZIO });
  const [pronto, setPronto] = useState(false);

  const lastActiveIdRef = useRef<string | null | undefined>(undefined);
  const activeIdForSave = useRef(activeId);
  const dadosRef = useRef(state.dadosImportados);
  const loadedFromSupabaseRef = useRef(false);

  const debouncedDevedores = useDebounce(devedores, 600);
  const debouncedGastosLideres = useDebounce(gastosLideres, 600);
  const debouncedGastosCaixa = useDebounce(gastosCaixa, 600);

  // Carrega do Supabase quando o acerto ativo muda
  useEffect(() => {
    if (lastActiveIdRef.current === activeId) return;
    lastActiveIdRef.current = activeId;
    activeIdForSave.current = activeId;
    loadedFromSupabaseRef.current = false;
    dadosRef.current = state.dadosImportados;
    setPronto(false);

    if (!activeId) {
      setDevedores([]);
      setGastosLideresState(gastosLideresVazio());
      setGastosCaixaState({ ...GASTOS_VAZIO });
      setPronto(true);
      return;
    }

    supabase
      .from("acerto_debitos")
      .select("devedores, gastos_lideres, gastos_caixa")
      .eq("acerto_id", activeId)
      .maybeSingle()
      .then(({ data }) => {
        if (activeIdForSave.current !== activeId) return;
        if (data) {
          if (Array.isArray(data.devedores)) setDevedores(data.devedores);
          if (Array.isArray(data.gastos_lideres)) setGastosLideresState(data.gastos_lideres);
          if (data.gastos_caixa) setGastosCaixaState(data.gastos_caixa);
          loadedFromSupabaseRef.current = true;
        } else {
          // Inicializa pelos dados importados se disponíveis
          if (state.dadosImportados) {
            setDevedores(buildDevedores(state.dadosImportados.nomes, state.dadosImportados.saldos));
          } else {
            setDevedores([]);
          }
          setGastosLideresState(gastosLideresVazio());
          setGastosCaixaState({ ...GASTOS_VAZIO });
        }
        setPronto(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, state.dadosImportados]);

  // Detecta re-importação dentro do mesmo acerto
  useEffect(() => {
    if (!pronto) return;
    if (!state.dadosImportados) return;
    if (state.dadosImportados === dadosRef.current) return;
    dadosRef.current = state.dadosImportados;

    if (loadedFromSupabaseRef.current) {
      loadedFromSupabaseRef.current = false;
      return;
    }

    setDevedores(buildDevedores(state.dadosImportados.nomes, state.dadosImportados.saldos));
    setGastosLideresState(gastosLideresVazio());
    setGastosCaixaState({ ...GASTOS_VAZIO });
  }, [state.dadosImportados, pronto]);

  // Salva no Supabase (debounced)
  useEffect(() => {
    const id = activeIdForSave.current;
    if (!id || !pronto) return;

    supabase
      .from("acerto_debitos")
      .upsert(
        {
          acerto_id: id,
          devedores: debouncedDevedores,
          gastos_lideres: debouncedGastosLideres,
          gastos_caixa: debouncedGastosCaixa,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "acerto_id" }
      )
      .then(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDevedores, debouncedGastosLideres, debouncedGastosCaixa, pronto]);

  const salvar = useCallback(() => {
    const id = activeIdForSave.current;
    if (!id) return;
    supabase
      .from("acerto_debitos")
      .upsert(
        {
          acerto_id: id,
          devedores,
          gastos_lideres: gastosLideres,
          gastos_caixa: gastosCaixa,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "acerto_id" }
      )
      .then(() => {});
  }, [devedores, gastosLideres, gastosCaixa]);

  // ─── Devedores ───────────────────────────────────────────────────────────────

  const addDevedor = useCallback(() => {
    if (encerrado) return;
    setDevedores((prev) => [...prev, { id: genId(), nome: "", valorDebito: 0 }]);
  }, [encerrado]);

  const updateDevedor = useCallback(
    (id: string, parcial: Partial<Omit<DevedorColportor, "id">>) => {
      if (encerrado) return;
      setDevedores((prev) => prev.map((d) => (d.id === id ? { ...d, ...parcial } : d)));
    },
    [encerrado]
  );

  const removeDevedor = useCallback((id: string) => {
    if (encerrado) return;
    setDevedores((prev) => prev.filter((d) => d.id !== id));
  }, [encerrado]);

  // ─── Gastos líderes ──────────────────────────────────────────────────────────

  const setGastosLider = useCallback((idx: number, gastos: number) => {
    if (encerrado) return;
    setGastosLideresState((prev) => {
      const next = prev.map((g) => ({ ...g, debitosAdicionais: [...g.debitosAdicionais] }));
      next[idx] = { ...next[idx], gastos };
      return next;
    });
  }, [encerrado]);

  const addDebitoAdicional = useCallback(
    (liderIdx: number, preset?: { descricao: string; valor: number }) => {
      if (encerrado) return;
      setGastosLideresState((prev) => {
        const next = prev.map((g) => ({ ...g, debitosAdicionais: [...g.debitosAdicionais] }));
        next[liderIdx].debitosAdicionais.push({
          id: genId(),
          descricao: preset?.descricao ?? "",
          valor: preset?.valor ?? 0,
        });
        return next;
      });
    },
    [encerrado]
  );

  const updateDebitoAdicional = useCallback(
    (liderIdx: number, id: string, parcial: Partial<Omit<DebitoAdicional, "id">>) => {
      if (encerrado) return;
      setGastosLideresState((prev) =>
        prev.map((g, gi) =>
          gi !== liderIdx
            ? g
            : { ...g, debitosAdicionais: g.debitosAdicionais.map((d) => (d.id === id ? { ...d, ...parcial } : d)) }
        )
      );
    },
    [encerrado]
  );

  const removeDebitoAdicional = useCallback((liderIdx: number, id: string) => {
    if (encerrado) return;
    setGastosLideresState((prev) =>
      prev.map((g, gi) =>
        gi !== liderIdx
          ? g
          : { ...g, debitosAdicionais: g.debitosAdicionais.filter((d) => d.id !== id) }
      )
    );
  }, [encerrado]);

  // ─── Gastos caixa ────────────────────────────────────────────────────────────

  const setGastosCaixa = useCallback((gastos: number) => {
    if (encerrado) return;
    setGastosCaixaState((prev) => ({ ...prev, gastos }));
  }, [encerrado]);

  const addDebitoAdicionalCaixa = useCallback(() => {
    if (encerrado) return;
    setGastosCaixaState((prev) => ({
      ...prev,
      debitosAdicionais: [...prev.debitosAdicionais, { id: genId(), descricao: "", valor: 0 }],
    }));
  }, [encerrado]);

  const updateDebitoAdicionalCaixa = useCallback(
    (id: string, parcial: Partial<Omit<DebitoAdicional, "id">>) => {
      if (encerrado) return;
      setGastosCaixaState((prev) => ({
        ...prev,
        debitosAdicionais: prev.debitosAdicionais.map((d) => (d.id === id ? { ...d, ...parcial } : d)),
      }));
    },
    [encerrado]
  );

  const removeDebitoAdicionalCaixa = useCallback((id: string) => {
    if (encerrado) return;
    setGastosCaixaState((prev) => ({
      ...prev,
      debitosAdicionais: prev.debitosAdicionais.filter((d) => d.id !== id),
    }));
  }, [encerrado]);

  return (
    <DebitosContext.Provider
      value={{
        encerrado,
        devedores, addDevedor, updateDevedor, removeDevedor,
        gastosLideres, setGastosLider, addDebitoAdicional, updateDebitoAdicional, removeDebitoAdicional,
        gastosCaixa, setGastosCaixa, addDebitoAdicionalCaixa, updateDebitoAdicionalCaixa, removeDebitoAdicionalCaixa,
        salvar,
      }}
    >
      {children}
    </DebitosContext.Provider>
  );
}

export function useDebitos() {
  const ctx = useContext(DebitosContext);
  if (!ctx) throw new Error("useDebitos deve ser usado dentro de DebitosProvider");
  return ctx;
}
