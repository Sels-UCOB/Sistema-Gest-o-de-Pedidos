"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CHECKLIST_PADRAO, type ChecklistItem, type ChecklistProgresso } from "@/lib/campanhas/types/checklist";

export interface UseAcertoChecklistReturn {
  itens: ChecklistItem[];
  loading: boolean;
  todosMarcados: boolean;
  progresso: ChecklistProgresso;
  toggleItem: (itemKey: string) => Promise<void>;
}

export function useAcertoChecklist(acertoId: string | null): UseAcertoChecklistReturn {
  const [itens, setItens] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!acertoId) {
      setItens([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      const { data, error } = await supabase
        .from("acerto_checklist")
        .select("*")
        .eq("acerto_id", acertoId);

      if (cancelled) return;
      if (error) { setLoading(false); return; }

      const existingMap = new Map((data ?? []).map((r) => [r.item_key as string, r]));

      // Insere itens ausentes (upsert não usado para não sobrescrever marcado existente)
      const missing = CHECKLIST_PADRAO.filter((p) => !existingMap.has(p.itemKey));
      if (missing.length > 0) {
        const rows = missing.map((p) => ({
          acerto_id: acertoId,
          item_key: p.itemKey,
          descricao: p.descricao,
          marcado: false,
        }));
        const { error: insertError } = await supabase.from("acerto_checklist").insert(rows);
        if (cancelled) return;
        if (!insertError) {
          rows.forEach((r) => existingMap.set(r.item_key, { ...r, data_marcacao: null, created_at: null, updated_at: null }));
        }
      }

      const sorted = CHECKLIST_PADRAO.map((p): ChecklistItem => {
        const row = existingMap.get(p.itemKey);
        return {
          itemKey: p.itemKey,
          acertoId: acertoId!,
          descricao: p.descricao,
          marcado: (row?.marcado as boolean) ?? false,
          dataMarcacao: (row?.data_marcacao as string | null) ?? undefined,
        };
      });

      setItens(sorted);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [acertoId]);

  const toggleItem = useCallback(async (itemKey: string) => {
    if (!acertoId) return;

    setItens((prev) => {
      const item = prev.find((i) => i.itemKey === itemKey);
      if (!item) return prev;
      const novoMarcado = !item.marcado;
      const now = new Date().toISOString();
      return prev.map((i) =>
        i.itemKey === itemKey
          ? { ...i, marcado: novoMarcado, dataMarcacao: novoMarcado ? now : undefined }
          : i
      );
    });

    const item = itens.find((i) => i.itemKey === itemKey);
    if (!item) return;

    const novoMarcado = !item.marcado;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("acerto_checklist")
      .update({
        marcado: novoMarcado,
        data_marcacao: novoMarcado ? now : null,
        updated_at: now,
      })
      .eq("acerto_id", acertoId)
      .eq("item_key", itemKey);

    // Reverte em caso de erro
    if (error) {
      setItens((prev) =>
        prev.map((i) =>
          i.itemKey === itemKey
            ? { ...i, marcado: item.marcado, dataMarcacao: item.dataMarcacao }
            : i
        )
      );
    }
  }, [acertoId, itens]);

  const marcados = itens.filter((i) => i.marcado).length;
  const total = itens.length;
  const todosMarcados = total > 0 && marcados === total;

  return {
    itens,
    loading,
    todosMarcados,
    progresso: { marcados, total },
    toggleItem,
  };
}
