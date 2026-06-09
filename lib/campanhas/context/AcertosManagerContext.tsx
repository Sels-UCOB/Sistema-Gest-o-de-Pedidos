"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { AcertoMeta, CriarAcertoData, FiltrosAcerto, StatusAcerto } from "@/lib/campanhas/types/acertoManager";
import type { AcertoState } from "@/lib/campanhas/types/acerto";
import { CONFIG_INICIAL } from "@/lib/campanhas/types/acerto";

const META_KEY = "acertos_meta_v1";
const ACTIVE_KEY = "acertos_active_v1";

function loadMeta(): AcertoMeta[] {
  try {
    const s = localStorage.getItem(META_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function loadActiveId(list: AcertoMeta[]): string | null {
  const id = localStorage.getItem(ACTIVE_KEY);
  if (!id) return null;
  return list.some((a) => a.id === id) ? id : null;
}

function genId(): string {
  return `ac_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

interface AcertosManagerContextValue {
  acertos: AcertoMeta[];
  activeId: string | null;
  activeAcerto: AcertoMeta | null;
  createAcerto: (data: CriarAcertoData) => string;
  updateAcerto: (
    id: string,
    data: Partial<Pick<AcertoMeta, "nome" | "campo" | "tipoCampanha">>
  ) => void;
  closeAcerto: (id: string) => void;
  deleteAcerto: (id: string) => void;
  setActiveAcerto: (id: string | null) => void;
  marcarEmAberto: (id: string) => void;
  getFilteredAcertos: (filters: FiltrosAcerto) => AcertoMeta[];
}

const AcertosManagerContext = createContext<AcertosManagerContextValue | null>(null);

export function AcertosManagerProvider({ children }: { children: ReactNode }) {
  // Inicializa vazio — sem lazy initializer que leria localStorage durante SSR/hidratação
  const [acertos, setAcertos] = useState<AcertoMeta[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  // Impede o efeito de persistência de sobrescrever dados antes da carga inicial
  const [carregado, setCarregado] = useState(false);

  // Carrega do localStorage apenas no cliente, após a montagem
  useEffect(() => {
    const list = loadMeta();
    const id = loadActiveId(list);
    setAcertos(list);
    setActiveIdState(id);
    setCarregado(true);
  }, []);

  // Persiste a lista sempre que mudar, mas só após o carregamento inicial
  useEffect(() => {
    if (!carregado) return;
    localStorage.setItem(META_KEY, JSON.stringify(acertos));
  }, [acertos, carregado]);

  const setActiveAcerto = useCallback((id: string | null) => {
    setActiveIdState(id);
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }, []);

  const createAcerto = useCallback(
    (data: CriarAcertoData): string => {
      const id = genId();
      const meta: AcertoMeta = {
        id,
        nome: data.nome.trim(),
        campo: data.campo,
        tipoCampanha: data.tipoCampanha,
        dataCriacao: new Date().toISOString(),
        status: "Criado",
      };

      const initialState: AcertoState = {
        dadosImportados: null,
        config: {
          ...CONFIG_INICIAL,
          campo: data.campo as AcertoState["config"]["campo"],
          tipoCampanha: data.tipoCampanha as AcertoState["config"]["tipoCampanha"],
        },
      };
      localStorage.setItem(`acerto_${id}_state`, JSON.stringify(initialState));

      setAcertos((prev) => [...prev, meta]);
      setActiveAcerto(id);
      return id;
    },
    [setActiveAcerto]
  );

  const updateAcerto = useCallback(
    (
      id: string,
      data: Partial<Pick<AcertoMeta, "nome" | "campo" | "tipoCampanha">>
    ) => {
      setAcertos((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...data } : a))
      );
    },
    []
  );

  const closeAcerto = useCallback((id: string) => {
    const updated = acertos.map((a) =>
      a.id === id
        ? { ...a, status: "Encerrado" as StatusAcerto, dataEncerramento: new Date().toISOString() }
        : a
    );
    setAcertos(updated);
    localStorage.setItem(META_KEY, JSON.stringify(updated));
  }, [acertos]);

  const deleteAcerto = useCallback(
    (id: string) => {
      localStorage.removeItem(`acerto_${id}_state`);
      localStorage.removeItem(`acerto_${id}_lancamentos`);
      localStorage.removeItem(`acerto_${id}_lider`);
      localStorage.removeItem(`acerto_${id}_debitos`);

      if (activeId === id) setActiveAcerto(null);
      setAcertos((prev) => prev.filter((a) => a.id !== id));
    },
    [activeId, setActiveAcerto]
  );

  const marcarEmAberto = useCallback((id: string) => {
    setAcertos((prev) => {
      const target = prev.find((a) => a.id === id);
      if (!target || target.status !== "Criado") return prev;
      return prev.map((a) =>
        a.id === id ? { ...a, status: "Em Aberto" as StatusAcerto } : a
      );
    });
  }, []);

  const getFilteredAcertos = useCallback(
    (filters: FiltrosAcerto): AcertoMeta[] => {
      return acertos.filter((a) => {
        if (filters.status !== "todos" && a.status !== filters.status) return false;
        if (filters.campo !== "todos" && a.campo !== filters.campo) return false;
        if (
          filters.tipoCampanha !== "todos" &&
          a.tipoCampanha !== filters.tipoCampanha
        )
          return false;
        if (filters.dataInicio && a.dataCriacao < filters.dataInicio) return false;
        if (filters.dataFim && a.dataCriacao > filters.dataFim + "T23:59:59")
          return false;
        return true;
      });
    },
    [acertos]
  );

  const activeAcerto = useMemo(
    () => acertos.find((a) => a.id === activeId) ?? null,
    [acertos, activeId]
  );

  return (
    <AcertosManagerContext.Provider
      value={{
        acertos,
        activeId,
        activeAcerto,
        createAcerto,
        updateAcerto,
        closeAcerto,
        deleteAcerto,
        setActiveAcerto,
        marcarEmAberto,
        getFilteredAcertos,
      }}
    >
      {children}
    </AcertosManagerContext.Provider>
  );
}

export function useAcertosManager() {
  const ctx = useContext(AcertosManagerContext);
  if (!ctx)
    throw new Error(
      "useAcertosManager deve ser usado dentro de AcertosManagerProvider"
    );
  return ctx;
}

/** Versão segura — retorna null fora do provider (usado dentro de child contexts) */
export function useAcertosManagerOptional() {
  return useContext(AcertosManagerContext);
}
