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
  addDebitoAdicional: (liderIdx: number) => void;
  updateDebitoAdicional: (
    liderIdx: number,
    id: string,
    parcial: Partial<Omit<DebitoAdicional, "id">>
  ) => void;
  removeDebitoAdicional: (liderIdx: number, id: string) => void;
  gastosCaixa: GastosLider;
  setGastosCaixa: (gastos: number) => void;
  addDebitoAdicionalCaixa: () => void;
  updateDebitoAdicionalCaixa: (
    id: string,
    parcial: Partial<Omit<DebitoAdicional, "id">>
  ) => void;
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
  const result: DevedorColportor[] = [];
  nomes.forEach((nome, i) => {
    if (saldos[i] < 0) {
      result.push({ id: genId(), nome, valorDebito: Math.abs(saldos[i]) });
    }
  });
  return result;
}

export function DebitosProvider({ children }: { children: ReactNode }) {
  const { state } = useAcerto();
  const manager = useAcertosManagerOptional();
  const activeId = manager?.activeId ?? null;

  const encerrado = manager?.activeAcerto?.status === "Encerrado";

  const [devedores, setDevedores] = useState<DevedorColportor[]>([]);
  const [gastosLideres, setGastosLideresState] = useState<GastosLider[]>(
    gastosLideresVazio()
  );
  const [gastosCaixa, setGastosCaixaState] = useState<GastosLider>({
    ...GASTOS_VAZIO,
  });
  const [pronto, setPronto] = useState(false);

  const lastActiveIdRef = useRef<string | null | undefined>(undefined);
  // Ref para detectar troca de relatório dentro do mesmo acerto
  const dadosRef = useRef(state.dadosImportados);

  // Carrega/reseta quando o acerto ativo muda
  useEffect(() => {
    if (lastActiveIdRef.current === activeId) return;
    lastActiveIdRef.current = activeId;
    dadosRef.current = state.dadosImportados; // sincroniza ref p/ evitar detecção falsa
    setPronto(false);

    if (activeId) {
      const saved = localStorage.getItem(`acerto_${activeId}_debitos`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (Array.isArray(data.devedores)) setDevedores(data.devedores);
          if (Array.isArray(data.gastosLideres))
            setGastosLideresState(data.gastosLideres);
          if (data.gastosCaixa) setGastosCaixaState(data.gastosCaixa);
          setPronto(true);
          return;
        } catch {
          localStorage.removeItem(`acerto_${activeId}_debitos`);
        }
      }
    }

    // Sem dados salvos: inicializa pelo import atual se disponível
    if (state.dadosImportados) {
      setDevedores(
        buildDevedores(state.dadosImportados.nomes, state.dadosImportados.saldos)
      );
    } else {
      setDevedores([]);
    }
    setGastosLideresState(gastosLideresVazio());
    setGastosCaixaState({ ...GASTOS_VAZIO });
    setPronto(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, state.dadosImportados]);

  // Detecta novo relatório importado dentro do mesmo acerto e reseta
  useEffect(() => {
    if (!pronto) return;
    if (!state.dadosImportados) return;
    if (state.dadosImportados === dadosRef.current) return;

    dadosRef.current = state.dadosImportados;
    if (activeId) localStorage.removeItem(`acerto_${activeId}_debitos`);

    setDevedores(
      buildDevedores(state.dadosImportados.nomes, state.dadosImportados.saldos)
    );
    setGastosLideresState(gastosLideresVazio());
    setGastosCaixaState({ ...GASTOS_VAZIO });
  }, [state.dadosImportados, pronto, activeId]);

  // Auto-salva
  useEffect(() => {
    if (!pronto || !activeId) return;
    localStorage.setItem(
      `acerto_${activeId}_debitos`,
      JSON.stringify({ devedores, gastosLideres, gastosCaixa })
    );
  }, [devedores, gastosLideres, gastosCaixa, pronto, activeId]);

  const salvar = useCallback(() => {
    if (!activeId) return;
    localStorage.setItem(
      `acerto_${activeId}_debitos`,
      JSON.stringify({ devedores, gastosLideres, gastosCaixa })
    );
  }, [devedores, gastosLideres, gastosCaixa, activeId]);

  // --- Devedores ---
  const addDevedor = useCallback(() => {
    if (encerrado) return;
    setDevedores((prev) => [
      ...prev,
      { id: genId(), nome: "", valorDebito: 0 },
    ]);
  }, [encerrado]);

  const updateDevedor = useCallback(
    (id: string, parcial: Partial<Omit<DevedorColportor, "id">>) => {
      if (encerrado) return;
      setDevedores((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...parcial } : d))
      );
    },
    [encerrado]
  );

  const removeDevedor = useCallback((id: string) => {
    if (encerrado) return;
    setDevedores((prev) => prev.filter((d) => d.id !== id));
  }, [encerrado]);

  // --- Gastos líderes ---
  const setGastosLider = useCallback((idx: number, gastos: number) => {
    if (encerrado) return;
    setGastosLideresState((prev) => {
      const next = prev.map((g) => ({
        ...g,
        debitosAdicionais: [...g.debitosAdicionais],
      }));
      next[idx] = { ...next[idx], gastos };
      return next;
    });
  }, [encerrado]);

  const addDebitoAdicional = useCallback((liderIdx: number) => {
    if (encerrado) return;
    setGastosLideresState((prev) => {
      const next = prev.map((g) => ({
        ...g,
        debitosAdicionais: [...g.debitosAdicionais],
      }));
      next[liderIdx].debitosAdicionais.push({
        id: genId(),
        descricao: "",
        valor: 0,
      });
      return next;
    });
  }, [encerrado]);

  const updateDebitoAdicional = useCallback(
    (liderIdx: number, id: string, parcial: Partial<Omit<DebitoAdicional, "id">>) => {
      if (encerrado) return;
      setGastosLideresState((prev) =>
        prev.map((g, gi) =>
          gi !== liderIdx
            ? g
            : {
                ...g,
                debitosAdicionais: g.debitosAdicionais.map((d) =>
                  d.id === id ? { ...d, ...parcial } : d
                ),
              }
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
          : {
              ...g,
              debitosAdicionais: g.debitosAdicionais.filter((d) => d.id !== id),
            }
      )
    );
  }, [encerrado]);

  // --- Gastos caixa ---
  const setGastosCaixa = useCallback((gastos: number) => {
    if (encerrado) return;
    setGastosCaixaState((prev) => ({ ...prev, gastos }));
  }, [encerrado]);

  const addDebitoAdicionalCaixa = useCallback(() => {
    if (encerrado) return;
    setGastosCaixaState((prev) => ({
      ...prev,
      debitosAdicionais: [
        ...prev.debitosAdicionais,
        { id: genId(), descricao: "", valor: 0 },
      ],
    }));
  }, [encerrado]);

  const updateDebitoAdicionalCaixa = useCallback(
    (id: string, parcial: Partial<Omit<DebitoAdicional, "id">>) => {
      if (encerrado) return;
      setGastosCaixaState((prev) => ({
        ...prev,
        debitosAdicionais: prev.debitosAdicionais.map((d) =>
          d.id === id ? { ...d, ...parcial } : d
        ),
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
        devedores,
        addDevedor,
        updateDevedor,
        removeDevedor,
        gastosLideres,
        setGastosLider,
        addDebitoAdicional,
        updateDebitoAdicional,
        removeDebitoAdicional,
        gastosCaixa,
        setGastosCaixa,
        addDebitoAdicionalCaixa,
        updateDebitoAdicionalCaixa,
        removeDebitoAdicionalCaixa,
        salvar,
      }}
    >
      {children}
    </DebitosContext.Provider>
  );
}

export function useDebitos() {
  const ctx = useContext(DebitosContext);
  if (!ctx)
    throw new Error("useDebitos deve ser usado dentro de DebitosProvider");
  return ctx;
}
