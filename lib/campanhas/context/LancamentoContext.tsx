"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Lancamento } from "@/lib/campanhas/types/lancamento";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { useConfiguracao } from "@/lib/campanhas/context/ConfiguracaoContext";
import { useAcertosManagerOptional } from "@/lib/campanhas/context/AcertosManagerContext";

interface LancamentoContextValue {
  lancamentos: Lancamento[];
  encerrado: boolean;
  addLancamento: () => void;
  updateLancamento: (id: string, parcial: Partial<Omit<Lancamento, "id">>) => void;
  removeLancamento: (id: string) => void;
}

const LancamentoContext = createContext<LancamentoContextValue | null>(null);

let _seq = 3000;
const genId = () => `l${_seq++}`;

const linhaVazia = (): Lancamento => ({
  id: genId(),
  tipoLancamentoId: "",
  historico: "",
  valor: null,
  saldoManual: 0,
});

export function LancamentoProvider({ children }: { children: ReactNode }) {
  const { state } = useAcerto();
  const { tipos } = useConfiguracao();
  const manager = useAcertosManagerOptional();
  const activeId = manager?.activeId ?? null;

  const encerrado = manager?.activeAcerto?.status === "Encerrado";

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [inicializado, setInicializado] = useState(false);
  const lastActiveIdRef = useRef<string | null | undefined>(undefined);

  // Carrega/reseta quando o acerto ativo muda
  useEffect(() => {
    if (lastActiveIdRef.current === activeId) return;
    lastActiveIdRef.current = activeId;

    if (activeId) {
      const saved = localStorage.getItem(`acerto_${activeId}_lancamentos`);
      if (saved) {
        try {
          setLancamentos(JSON.parse(saved));
          setInicializado(true);
          return;
        } catch {
          localStorage.removeItem(`acerto_${activeId}_lancamentos`);
        }
      }
    }
    // Sem dados salvos: reinicia para deixar o efeito de inicialização agir
    setInicializado(false);
    setLancamentos([linhaVazia()]);
  }, [activeId]);

  // Inicializa a partir dos dados importados (quando não há dados salvos)
  useEffect(() => {
    if (inicializado) return;

    const tipoLucro = tipos.find((t) => t.nome === "Lucro");
    const dados = state.dadosImportados;

    const linhas: Lancamento[] = [linhaVazia()];

    if (dados) {
      dados.nomes.forEach((nome, idx) => {
        if (dados.saldos[idx] > 0) {
          linhas.push({
            id: genId(),
            tipoLancamentoId: tipoLucro?.id ?? "",
            historico: nome,
            valor: dados.saldos[idx],
            saldoManual: null,
          });
        }
      });
      setInicializado(true);
    }

    setLancamentos(linhas);
  }, [inicializado, state.dadosImportados, tipos]);

  // Auto-salva
  useEffect(() => {
    if (!activeId || !inicializado) return;
    localStorage.setItem(`acerto_${activeId}_lancamentos`, JSON.stringify(lancamentos));
  }, [lancamentos, activeId, inicializado]);

  // Marca "Em Aberto" ao primeiro lançamento preenchido
  useEffect(() => {
    if (!activeId || !manager) return;
    const temConteudo = lancamentos.some((l) => l.valor !== null);
    if (temConteudo) manager.marcarEmAberto(activeId);
  }, [lancamentos, activeId, manager]);

  const addLancamento = useCallback(() => {
    if (encerrado) return;
    setLancamentos((prev) => [
      ...prev,
      {
        id: genId(),
        tipoLancamentoId: "",
        historico: "",
        valor: null,
        saldoManual: null,
      },
    ]);
  }, [encerrado]);

  const updateLancamento = useCallback(
    (id: string, parcial: Partial<Omit<Lancamento, "id">>) => {
      if (encerrado) return;
      setLancamentos((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...parcial } : l))
      );
    },
    [encerrado]
  );

  const removeLancamento = useCallback((id: string) => {
    if (encerrado) return;
    setLancamentos((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === 0) return prev;
      return prev.filter((l) => l.id !== id);
    });
  }, [encerrado]);

  return (
    <LancamentoContext.Provider
      value={{ lancamentos, encerrado, addLancamento, updateLancamento, removeLancamento }}
    >
      {children}
    </LancamentoContext.Provider>
  );
}

export function useLancamento() {
  const ctx = useContext(LancamentoContext);
  if (!ctx)
    throw new Error("useLancamento deve ser usado dentro de LancamentoProvider");
  return ctx;
}
