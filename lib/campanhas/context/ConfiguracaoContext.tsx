"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { TipoLancamento, Campo, LiderConfig } from "@/lib/campanhas/types/configuracao";
import { TIPOS_INICIAIS, CAMPOS_INICIAIS } from "@/lib/campanhas/config/configuracoes";

const STORAGE_KEY = "campanhas_config_global_v1";

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
  updateLider: (id: string, parcial: Partial<Pick<LiderConfig, "subcontaLider" | "subcontaLucro">>) => void;
  deleteLider: (id: string) => void;
}

const ConfiguracaoContext = createContext<ConfiguracaoContextValue | null>(null);

let _seq = 200;
const genId = () => String(_seq++);

export function ConfiguracaoProvider({ children }: { children: ReactNode }) {
  const [tipos, setTipos] = useState<TipoLancamento[]>(TIPOS_INICIAIS);
  const [campos, setCampos] = useState<Campo[]>(CAMPOS_INICIAIS);
  const [lideres, setLideres] = useState<LiderConfig[]>([]);
  const [carregado, setCarregado] = useState(false);

  // Carrega do localStorage no mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.tipos) && data.tipos.length > 0) setTipos(data.tipos);
        if (Array.isArray(data.campos) && data.campos.length > 0) setCampos(data.campos);
        if (Array.isArray(data.lideres)) setLideres(data.lideres);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setCarregado(true);
  }, []);

  // Auto-salva sempre que os dados mudam (somente após o carregamento inicial)
  useEffect(() => {
    if (!carregado) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tipos, campos, lideres }));
  }, [tipos, campos, lideres, carregado]);

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
    setLideres((prev) => {
      const existentes = new Set(prev.map((l) => l.nome));
      const novos = nomes.filter(Boolean).filter((n) => !existentes.has(n));
      if (novos.length === 0) return prev;
      return [...prev, ...novos.map((nome) => ({ id: genId(), nome, subcontaLider: "", subcontaLucro: "" }))];
    });
  }, []);

  const updateLider = useCallback(
    (id: string, parcial: Partial<Pick<LiderConfig, "subcontaLider" | "subcontaLucro">>) => {
      setLideres((p) => p.map((l) => (l.id === id ? { ...l, ...parcial } : l)));
    },
    []
  );

  const deleteLider = useCallback((id: string) => {
    setLideres((p) => p.filter((l) => l.id !== id));
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
