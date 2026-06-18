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
import type { TipoLancamento, Campo, LiderConfig } from "@/lib/campanhas/types/configuracao";
import { TIPOS_INICIAIS, CAMPOS_INICIAIS } from "@/lib/campanhas/config/configuracoes";

interface ConfiguracaoContextValue {
  tipos: TipoLancamento[];
  campos: Campo[];
  lideres: LiderConfig[];

  addTipo: (tipo: Omit<TipoLancamento, "id">) => void;
  updateTipo: (id: string, parcial: Partial<Omit<TipoLancamento, "id">>) => void;
  deleteTipo: (id: string) => void;

  addCampo: (campo: Omit<Campo, "id">) => void;
  updateCampo: (id: string, parcial: Partial<Omit<Campo, "id">>) => void;
  deleteCampo: (id: string) => void;

  initLideres: (nomes: string[]) => void;
  updateLider: (nome: string, parcial: Partial<Pick<LiderConfig, "subcontaLider" | "subcontaLucro">>) => void;
  deleteLider: (nome: string) => void;
}

const ConfiguracaoContext = createContext<ConfiguracaoContextValue | null>(null);

const genId = () => crypto.randomUUID();

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function ConfiguracaoProvider({ children }: { children: ReactNode }) {
  const [tipos, setTipos] = useState<TipoLancamento[]>(TIPOS_INICIAIS);
  const [campos, setCampos] = useState<Campo[]>(CAMPOS_INICIAIS);
  const [lideres, setLideres] = useState<LiderConfig[]>([]);
  const [carregado, setCarregado] = useState(false);

  const debouncedTipos = useDebounce(tipos, 800);
  const debouncedCampos = useDebounce(campos, 800);
  const debouncedLideres = useDebounce(lideres, 800);
  const saveRef = useRef(carregado);
  saveRef.current = carregado;

  // Carrega do Supabase na montagem
  useEffect(() => {
    supabase
      .from("config_global")
      .select("tipos, campos, lideres")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("[config] erro ao carregar configuração global:", error);
        if (data) {
          if (Array.isArray(data.tipos) && data.tipos.length > 0) setTipos(data.tipos);
          if (Array.isArray(data.campos) && data.campos.length > 0) setCampos(data.campos);
          if (Array.isArray(data.lideres))
            setLideres(data.lideres.map((l: LiderConfig) => ({ ...l, id: l.id || genId() })));
        }
        setCarregado(true);
      });
  }, []);

  // Salva no Supabase (debounced) quando dados mudam
  useEffect(() => {
    if (!saveRef.current) return;
    supabase
      .from("config_global")
      .update({
        tipos: debouncedTipos,
        campos: debouncedCampos,
        lideres: debouncedLideres,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .then(({ error }) => {
        if (error) console.error("[config] erro ao salvar configuração global:", error.message, error.code, error.details);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTipos, debouncedCampos, debouncedLideres]);

  const addTipo = useCallback((tipo: Omit<TipoLancamento, "id">) => {
    setTipos((p) => [...p, { ...tipo, id: genId() }]);
  }, []);

  const updateTipo = useCallback((id: string, parcial: Partial<Omit<TipoLancamento, "id">>) => {
    setTipos((p) => p.map((t) => (t.id === id ? { ...t, ...parcial } : t)));
  }, []);

  const deleteTipo = useCallback((id: string) => {
    setTipos((p) => p.filter((t) => t.id !== id));
  }, []);

  const addCampo = useCallback((campo: Omit<Campo, "id">) => {
    setCampos((p) => [...p, { ...campo, id: genId() }]);
  }, []);

  const updateCampo = useCallback((id: string, parcial: Partial<Omit<Campo, "id">>) => {
    setCampos((p) => p.map((c) => (c.id === id ? { ...c, ...parcial } : c)));
  }, []);

  const deleteCampo = useCallback((id: string) => {
    setCampos((p) => p.filter((c) => c.id !== id));
  }, []);

  const initLideres = useCallback((nomes: string[]) => {
    const nomesValidos = nomes.filter(Boolean);
    if (nomesValidos.length === 0) return;
    setLideres((prev) => {
      // Garante IDs em entradas antigas sem eles (migração de dados)
      let mudou = false;
      const prevComIds = prev.map((l) => {
        if (l.id) return l;
        mudou = true;
        return { ...l, id: genId() };
      });
      // Só adiciona nomes novos — nunca remove entradas existentes
      const existentes = new Set(prevComIds.map((l) => l.nome));
      const novos = nomesValidos.filter((n) => !existentes.has(n));
      if (novos.length === 0 && !mudou) return prev;
      return [...prevComIds, ...novos.map((nome) => ({ id: genId(), nome, subcontaLider: "", subcontaLucro: "" }))];
    });
  }, []);

  const updateLider = useCallback(
    (nome: string, parcial: Partial<Pick<LiderConfig, "subcontaLider" | "subcontaLucro">>) => {
      setLideres((p) => p.map((l) => (l.nome === nome ? { ...l, ...parcial } : l)));
    },
    []
  );

  const deleteLider = useCallback((nome: string) => {
    setLideres((p) => p.filter((l) => l.nome !== nome));
  }, []);

  return (
    <ConfiguracaoContext.Provider
      value={{
        tipos, campos, lideres,
        addTipo, updateTipo, deleteTipo,
        addCampo, updateCampo, deleteCampo,
        initLideres, updateLider, deleteLider,
      }}
    >
      {children}
    </ConfiguracaoContext.Provider>
  );
}

export function useConfiguracao() {
  const ctx = useContext(ConfiguracaoContext);
  if (!ctx) throw new Error("useConfiguracao deve ser usado dentro de ConfiguracaoProvider");
  return ctx;
}
