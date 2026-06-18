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
import { supabase } from "@/lib/supabase";
import type { AcertoMeta, CriarAcertoData, FiltrosAcerto, StatusAcerto } from "@/lib/campanhas/types/acertoManager";
import { campoToRegiao } from "@/lib/campanhas/types/acertoManager";

const ACTIVE_KEY = "acertos_active_v1";

function genId(): string {
  return `ac_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function rowToMeta(row: Record<string, unknown>): AcertoMeta {
  return {
    id: row.id as string,
    nome: row.nome as string,
    campo: row.campo as string,
    regiao: (row.campo_regiao as string | undefined) ?? campoToRegiao(row.campo as string),
    tipoCampanha: row.tipo_campanha as string,
    dataCriacao: row.data_criacao as string,
    status: row.status as StatusAcerto,
    dataEncerramento: row.data_encerramento as string | undefined,
    loteAASI: row.lote_aasi as number | undefined,
  };
}

interface AcertosManagerContextValue {
  acertos: AcertoMeta[];
  activeId: string | null;
  activeAcerto: AcertoMeta | null;
  loading: boolean;
  loadError: string | null;
  reload: () => void;
  createAcerto: (data: CriarAcertoData) => Promise<string>;
  updateAcerto: (id: string, data: Partial<Pick<AcertoMeta, "nome" | "campo" | "tipoCampanha" | "loteAASI">>) => Promise<void>;
  closeAcerto: (id: string, loteAASI?: number) => Promise<void>;
  deleteAcerto: (id: string) => Promise<void>;
  setActiveAcerto: (id: string | null) => void;
  marcarEmAberto: (id: string) => Promise<void>;
  getFilteredAcertos: (filters: FiltrosAcerto) => AcertoMeta[];
}

const AcertosManagerContext = createContext<AcertosManagerContextValue | null>(null);

export function AcertosManagerProvider({ children }: { children: ReactNode }) {
  const [acertos, setAcertos] = useState<AcertoMeta[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  // Carrega lista do Supabase na montagem (e ao chamar reload)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    async function load() {
      const { data, error } = await supabase
        .from("acertos")
        .select("id, nome, campo, campo_regiao, tipo_campanha, status, data_criacao, data_encerramento, lote_aasi")
        .order("data_criacao", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("[AcertosManager] erro ao carregar acertos:", error);
        setLoadError(error.message);
        setLoading(false);
        return;
      }

      setAcertos(data.map(rowToMeta));

      // activeId vem do localStorage (preferência de UI, não dado)
      const saved = localStorage.getItem(ACTIVE_KEY);
      if (saved && data.some((a) => a.id === saved)) {
        setActiveIdState(saved);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const setActiveAcerto = useCallback((id: string | null) => {
    setActiveIdState(id);
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }, []);

  const createAcerto = useCallback(async (data: CriarAcertoData): Promise<string> => {
    const id = genId();
    const now = new Date().toISOString();

    const regiao = campoToRegiao(data.campo);

    const { error } = await supabase.from("acertos").insert({
      id,
      nome: data.nome.trim(),
      campo: data.campo,
      campo_regiao: regiao,
      tipo_campanha: data.tipoCampanha,
      status: "Criado",
      data_criacao: now,
    });

    if (error) throw error;

    const meta: AcertoMeta = {
      id,
      nome: data.nome.trim(),
      campo: data.campo,
      regiao,
      tipoCampanha: data.tipoCampanha,
      dataCriacao: now,
      status: "Criado",
    };

    setAcertos((prev) => [...prev, meta]);
    setActiveAcerto(id);
    return id;
  }, [setActiveAcerto]);

  const updateAcerto = useCallback(async (
    id: string,
    data: Partial<Pick<AcertoMeta, "nome" | "campo" | "tipoCampanha" | "loteAASI">>
  ) => {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.nome !== undefined) payload.nome = data.nome.trim();
    if (data.campo !== undefined) {
      payload.campo = data.campo;
      payload.campo_regiao = campoToRegiao(data.campo);
    }
    if (data.tipoCampanha !== undefined) payload.tipo_campanha = data.tipoCampanha;
    if (data.loteAASI !== undefined) payload.lote_aasi = data.loteAASI;

    const { error } = await supabase.from("acertos").update(payload).eq("id", id);
    if (error) throw error;

    setAcertos((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const updated = { ...a, ...data };
      if (data.campo !== undefined) updated.regiao = campoToRegiao(data.campo);
      return updated;
    }));
  }, []);

  const closeAcerto = useCallback(async (id: string, loteAASI?: number) => {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      status: "Encerrado",
      data_encerramento: now,
      updated_at: now,
    };
    if (loteAASI !== undefined) payload.lote_aasi = loteAASI;

    const { error } = await supabase.from("acertos").update(payload).eq("id", id);
    if (error) throw error;

    setAcertos((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "Encerrado", dataEncerramento: now, loteAASI }
          : a
      )
    );
  }, []);

  const deleteAcerto = useCallback(async (id: string) => {
    // ON DELETE CASCADE limpa acerto_state, lancamentos, lider, debitos
    const { error } = await supabase.from("acertos").delete().eq("id", id);
    if (error) throw error;

    if (activeId === id) setActiveAcerto(null);
    setAcertos((prev) => prev.filter((a) => a.id !== id));
  }, [activeId, setActiveAcerto]);

  const marcarEmAberto = useCallback(async (id: string) => {
    const acerto = acertos.find((a) => a.id === id);
    if (!acerto || acerto.status !== "Criado") return;

    const { error } = await supabase
      .from("acertos")
      .update({ status: "Em Aberto", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    setAcertos((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "Em Aberto" } : a))
    );
  }, [acertos]);

  const getFilteredAcertos = useCallback(
    (filters: FiltrosAcerto): AcertoMeta[] => {
      return acertos.filter((a) => {
        if (filters.status !== "todos" && a.status !== filters.status) return false;
        if (filters.campo !== "todos" && a.campo !== filters.campo) return false;
        if (filters.tipoCampanha !== "todos" && a.tipoCampanha !== filters.tipoCampanha) return false;
        if (filters.dataInicio && a.dataCriacao < filters.dataInicio) return false;
        if (filters.dataFim && a.dataCriacao > filters.dataFim + "T23:59:59") return false;
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
        loading,
        loadError,
        reload,
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
    throw new Error("useAcertosManager deve ser usado dentro de AcertosManagerProvider");
  return ctx;
}

export function useAcertosManagerOptional() {
  return useContext(AcertosManagerContext);
}
