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

export type AcertoTransitionState = "idle" | "salvando" | "carregando";

interface LancamentoContextValue {
  lancamentos: Lancamento[];
  encerrado: boolean;
  transitionState: AcertoTransitionState;
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

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function LancamentoProvider({ children }: { children: ReactNode }) {
  const { state } = useAcerto();
  const { tipos } = useConfiguracao();
  const manager = useAcertosManagerOptional();
  const activeId = manager?.activeId ?? null;
  const encerrado = manager?.activeAcerto?.status === "Encerrado";

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [inicializado, setInicializado] = useState(false);
  const [transitionState, setTransitionState] = useState<AcertoTransitionState>("idle");

  const lastActiveIdRef = useRef<string | null | undefined>(undefined);
  const activeIdForSave = useRef(activeId);
  const dadosRef = useRef<typeof state.dadosImportados | null>(null);
  const saveGenRef = useRef(0);
  // True durante toda a transição (save → load): bloqueia o auto-save debounced
  const isSwitchingRef = useRef(false);

  // Refs que sempre refletem o estado mais recente — acessíveis em closures async
  const lancamentosRef = useRef(lancamentos);
  lancamentosRef.current = lancamentos;
  const inicializadoRef = useRef(inicializado);
  inicializadoRef.current = inicializado;

  // Auto-save com debounce de 1.5s após a última alteração.
  // Bloqueado durante a transição de acerto para evitar race conditions.
  const debouncedLancamentos = useDebounce(lancamentos, 1500);

  // ─── Troca de acerto: save (bloqueante) → load (bloqueante) ─────────────────
  // O switch é sequencial e assíncrono. A UI mostra o estado via transitionState.
  // Enquanto isSwitchingRef.current = true, o auto-save debounced não dispara.
  useEffect(() => {
    if (lastActiveIdRef.current === activeId) return;

    const oldId = lastActiveIdRef.current;
    lastActiveIdRef.current = activeId;
    isSwitchingRef.current = true;

    const doSwitch = async () => {
      // Fase 1: persiste o acerto anterior antes de sair
      if (oldId && inicializadoRef.current) {
        setTransitionState("salvando");
        const rows = lancamentosToRows(oldId, lancamentosRef.current);
        const { error: delErr } = await supabase
          .from("acerto_lancamentos")
          .delete()
          .eq("acerto_id", oldId);
        if (delErr) {
          console.error("[lancamentos] erro ao salvar ao trocar acerto:", delErr);
        } else if (rows.length > 0) {
          const { error: insErr } = await supabase
            .from("acerto_lancamentos")
            .insert(rows);
          if (insErr) console.error("[lancamentos] erro ao inserir ao trocar acerto:", insErr);
        }
      }

      // Fase 2: reseta o estado local
      activeIdForSave.current = activeId;
      dadosRef.current = null;
      saveGenRef.current = 0;
      setInicializado(false);
      setLancamentos([linhaVazia()]);

      if (!activeId) {
        isSwitchingRef.current = false;
        setTransitionState("idle");
        return;
      }

      // Fase 3: carrega o novo acerto
      setTransitionState("carregando");
      const { data, error } = await supabase
        .from("acerto_lancamentos")
        .select("*")
        .eq("acerto_id", activeId)
        .order("posicao", { ascending: true });

      if (error) console.error("[lancamentos] erro ao carregar acerto:", activeId, error);

      // Guarda se outro switch aconteceu enquanto carregávamos
      if (activeIdForSave.current !== activeId) {
        isSwitchingRef.current = false;
        setTransitionState("idle");
        return;
      }

      if (data && data.length > 0) {
        setLancamentos(data.map(rowToLancamento));
        setInicializado(true);
      } else {
        setInicializado(false);
        setLancamentos([linhaVazia()]);
      }

      isSwitchingRef.current = false;
      setTransitionState("idle");
    };

    doSwitch();
  }, [activeId]);

  // ─── Inicialização a partir dos dados importados ─────────────────────────────
  // Fallback quando o Supabase não retorna dados para o acerto (novo acerto).
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

  // ─── Detecta re-importação dentro do mesmo acerto ────────────────────────────
  useEffect(() => {
    if (!inicializado) return;
    if (!state.dadosImportados) return;

    if (dadosRef.current === null) {
      dadosRef.current = state.dadosImportados;
      return;
    }

    if (state.dadosImportados === dadosRef.current) return;

    const previousImport = dadosRef.current;
    dadosRef.current = state.dadosImportados;

    const tipoLucroId = tipos.find((t) => t.nome === "Lucro")?.id ?? "";
    const dados = state.dadosImportados;

    const nomesDoImportAnterior = new Set(
      previousImport?.nomes.filter((_, idx) => (previousImport.saldos[idx] ?? 0) > 0) ?? []
    );

    setLancamentos((prev) => {
      const mantidas = prev.filter((l) => {
        if (l.tipoLancamentoId !== tipoLucroId) return true;
        if (!l.historico) return true;
        return !nomesDoImportAnterior.has(l.historico);
      });

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

  // ─── Auto-save debounced ─────────────────────────────────────────────────────
  // Dispara 1.5s após a última alteração. Bloqueado durante troca de acerto
  // (isSwitchingRef.current) para não conflitar com o save-before-switch.
  // Gen-check cancela apenas saves do mesmo acerto quando um mais recente existe;
  // se o acerto trocou (activeIdForSave !== id), o insert sempre completa para
  // não deixar dados apagados sem reinserção.
  useEffect(() => {
    const id = activeIdForSave.current;
    if (!id || !inicializado || isSwitchingRef.current) return;

    const gen = ++saveGenRef.current;
    const rows = lancamentosToRows(id, debouncedLancamentos);

    supabase
      .from("acerto_lancamentos")
      .delete()
      .eq("acerto_id", id)
      .then(({ error }) => {
        if (error) { console.error("[lancamentos] erro no delete (auto-save):", error); return; }
        if (activeIdForSave.current === id && saveGenRef.current !== gen) return;
        if (rows.length > 0) {
          supabase.from("acerto_lancamentos").insert(rows).then(({ error: e }) => {
            if (e) console.error("[lancamentos] erro no insert (auto-save):", e);
          });
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLancamentos, inicializado]);

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
    const { error: delErr } = await supabase.from("acerto_lancamentos").delete().eq("acerto_id", id);
    if (delErr) { console.error("[lancamentos] erro no delete (salvar):", delErr); return; }
    if (activeIdForSave.current === id && saveGenRef.current !== gen) return;
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("acerto_lancamentos").insert(rows);
      if (insErr) console.error("[lancamentos] erro no insert (salvar):", insErr);
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
      value={{ lancamentos, encerrado, transitionState, addLancamento, updateLancamento, removeLancamento, salvar }}
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
