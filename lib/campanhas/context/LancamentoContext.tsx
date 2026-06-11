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
import { supabase } from "@/lib/supabase";
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

function lancamentosToRows(acertoId: string, lancamentos: Lancamento[]) {
  return lancamentos.map((l, idx) => ({
    id: l.id,
    acerto_id: acertoId,
    tipo_lancamento_id: l.tipoLancamentoId,
    historico: l.historico,
    valor: l.valor,
    saldo_manual: l.saldoManual,
    posicao: idx,
  }));
}

function rowToLancamento(row: Record<string, unknown>): Lancamento {
  return {
    id: row.id as string,
    tipoLancamentoId: (row.tipo_lancamento_id as string) ?? "",
    historico: (row.historico as string) ?? "",
    valor: row.valor as number | null,
    saldoManual: row.saldo_manual as number | null,
  };
}

export function LancamentoProvider({ children }: { children: ReactNode }) {
  const { state } = useAcerto();
  const { tipos } = useConfiguracao();
  const manager = useAcertosManagerOptional();
  const activeId = manager?.activeId ?? null;
  const encerrado = manager?.activeAcerto?.status === "Encerrado";

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [inicializado, setInicializado] = useState(false);
  const lastActiveIdRef = useRef<string | null | undefined>(undefined);
  const activeIdForSave = useRef(activeId);
  // Ref para detectar re-importação dentro do mesmo acerto
  const dadosRef = useRef(state.dadosImportados);

  // Carrega do Supabase quando o acerto ativo muda
  useEffect(() => {
    if (lastActiveIdRef.current === activeId) return;
    lastActiveIdRef.current = activeId;
    activeIdForSave.current = activeId;

    if (!activeId) {
      setInicializado(false);
      setLancamentos([linhaVazia()]);
      return;
    }

    supabase
      .from("acerto_lancamentos")
      .select("*")
      .eq("acerto_id", activeId)
      .order("posicao", { ascending: true })
      .then(({ data }) => {
        if (activeIdForSave.current !== activeId) return;
        if (data && data.length > 0) {
          setLancamentos(data.map(rowToLancamento));
          setInicializado(true);
        } else {
          setInicializado(false);
          setLancamentos([linhaVazia()]);
        }
      });
  }, [activeId]);

  // Inicializa a partir dos dados importados quando não há dados no Supabase
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

  // Detecta re-importação dentro do mesmo acerto e reseta
  useEffect(() => {
    if (!inicializado) return;
    if (!state.dadosImportados) return;
    if (state.dadosImportados === dadosRef.current) return;
    dadosRef.current = state.dadosImportados;

    const tipoLucro = tipos.find((t) => t.nome === "Lucro");
    const linhas: Lancamento[] = [linhaVazia()];
    state.dadosImportados.nomes.forEach((nome, idx) => {
      if (state.dadosImportados!.saldos[idx] > 0) {
        linhas.push({
          id: genId(),
          tipoLancamentoId: tipoLucro?.id ?? "",
          historico: nome,
          valor: state.dadosImportados!.saldos[idx],
          saldoManual: null,
        });
      }
    });
    setLancamentos(linhas);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dadosImportados]);

  // Persiste no Supabase sempre que a lista muda (após inicialização)
  useEffect(() => {
    const id = activeIdForSave.current;
    if (!id || !inicializado) return;

    const rows = lancamentosToRows(id, lancamentos);
    // Substitui todos os lançamentos do acerto (delete + insert)
    supabase
      .from("acerto_lancamentos")
      .delete()
      .eq("acerto_id", id)
      .then(() => {
        if (rows.length > 0) {
          supabase.from("acerto_lancamentos").insert(rows).then(() => {});
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lancamentos, inicializado]);

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
      { id: genId(), tipoLancamentoId: "", historico: "", valor: null, saldoManual: null },
    ]);
  }, [encerrado]);

  const updateLancamento = useCallback(
    (id: string, parcial: Partial<Omit<Lancamento, "id">>) => {
      if (encerrado) return;
      setLancamentos((prev) => prev.map((l) => (l.id === id ? { ...l, ...parcial } : l)));
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
  if (!ctx) throw new Error("useLancamento deve ser usado dentro de LancamentoProvider");
  return ctx;
}
