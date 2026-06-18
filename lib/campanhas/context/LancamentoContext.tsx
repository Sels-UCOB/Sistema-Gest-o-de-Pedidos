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
  salvar: () => Promise<void>;
}

const LancamentoContext = createContext<LancamentoContextValue | null>(null);

const genId = () => crypto.randomUUID();

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
  const dadosRef = useRef<typeof state.dadosImportados | null>(null);
  const saveGenRef = useRef(0);

  // Carrega do Supabase quando o acerto ativo muda
  useEffect(() => {
    if (lastActiveIdRef.current === activeId) return;
    lastActiveIdRef.current = activeId;
    activeIdForSave.current = activeId;
    dadosRef.current = null; // sentinel: baseline ainda não estabelecido para este acerto
    saveGenRef.current = 0;  // invalida saves pendentes do acerto anterior

    // Reset imediato garante que o save effect não dispare com dados do acerto anterior
    // enquanto o novo ainda está carregando (inicializado=false bloqueia o save)
    setInicializado(false);
    setLancamentos([linhaVazia()]);

    if (!activeId) return;

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

  // Detecta re-importação dentro do mesmo acerto e reseta.
  // Usa sentinel null: enquanto dadosRef.current === null apenas estabelece o baseline
  // (carregamento inicial do acerto), sem resetar lançamentos.
  useEffect(() => {
    if (!inicializado) return;
    if (!state.dadosImportados) return;

    if (dadosRef.current === null) {
      // Primeira vez que dados chegam para este acerto — apenas fixa o baseline
      dadosRef.current = state.dadosImportados;
      return;
    }

    if (state.dadosImportados === dadosRef.current) return;

    // Captura nomes do import anterior antes de atualizar o ref
    const previousImport = dadosRef.current;
    dadosRef.current = state.dadosImportados;

    const tipoLucroId = tipos.find((t) => t.nome === "Lucro")?.id ?? "";
    const dados = state.dadosImportados;

    // Nomes de colportores que vieram do import anterior (essas linhas serão substituídas)
    const nomesDoImportAnterior = new Set(
      previousImport?.nomes.filter((_, idx) => (previousImport.saldos[idx] ?? 0) > 0) ?? []
    );

    setLancamentos((prev) => {
      // Mantém: linhas não-lucro e lucros que NÃO vieram do import anterior (manuais)
      const mantidas = prev.filter((l) => {
        if (l.tipoLancamentoId !== tipoLucroId) return true;
        if (!l.historico) return true;
        return !nomesDoImportAnterior.has(l.historico);
      });

      // Linhas do novo import
      const novas: Lancamento[] = [];
      dados.nomes.forEach((nome, idx) => {
        if (dados.saldos[idx] > 0) {
          novas.push({
            id: genId(),
            tipoLancamentoId: tipoLucroId,
            historico: nome,
            valor: dados.saldos[idx],
            saldoManual: null,
          });
        }
      });

      return [...mantidas, ...novas];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dadosImportados, inicializado]);

  // Persiste no Supabase sempre que a lista muda (após inicialização).
  // Usa gerador de versão para cancelar saves obsoletos: se o usuário edita
  // rapidamente, apenas o último delete+insert completa o insert.
  useEffect(() => {
    const id = activeIdForSave.current;
    if (!id || !inicializado) return;

    const gen = ++saveGenRef.current;
    const rows = lancamentosToRows(id, lancamentos);

    supabase
      .from("acerto_lancamentos")
      .delete()
      .eq("acerto_id", id)
      .then(() => {
        if (saveGenRef.current !== gen) return; // save mais recente já substituiu este
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

  const salvar = useCallback(async () => {
    const id = activeIdForSave.current;
    if (!id) return;
    const gen = ++saveGenRef.current;
    const rows = lancamentosToRows(id, lancamentos);
    await supabase.from("acerto_lancamentos").delete().eq("acerto_id", id);
    if (saveGenRef.current !== gen) return;
    if (rows.length > 0) {
      await supabase.from("acerto_lancamentos").insert(rows);
    }
  }, [lancamentos]);

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
      value={{ lancamentos, encerrado, addLancamento, updateLancamento, removeLancamento, salvar }}
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
