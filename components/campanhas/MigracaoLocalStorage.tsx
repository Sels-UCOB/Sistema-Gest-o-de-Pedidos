"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const MIGRATION_KEY = "campanhas_migrated_v1";
const META_KEY = "acertos_meta_v1";
const CONFIG_KEY = "campanhas_config_global_v1";

interface AcertoMetaRaw {
  id: string;
  nome: string;
  campo: string;
  tipoCampanha: string;
  dataCriacao: string;
  status: string;
  dataEncerramento?: string;
  loteAASI?: number;
}

async function migrar(): Promise<{ migrados: number; erros: string[] }> {
  const erros: string[] = [];
  let migrados = 0;

  // ── Acertos ───────────────────────────────────────────────────────────────
  const metaRaw = localStorage.getItem(META_KEY);
  const acertos: AcertoMetaRaw[] = metaRaw ? JSON.parse(metaRaw) : [];

  for (const a of acertos) {
    try {
      // Insere o acerto (ignora se já existir)
      const { error: errA } = await supabase
        .from("acertos")
        .upsert(
          {
            id: a.id,
            nome: a.nome,
            campo: a.campo ?? "",
            tipo_campanha: a.tipoCampanha ?? "",
            status: a.status ?? "Criado",
            data_criacao: a.dataCriacao,
            data_encerramento: a.dataEncerramento ?? null,
            lote_aasi: a.loteAASI ?? null,
          },
          { onConflict: "id" }
        );
      if (errA) { erros.push(`acerto ${a.nome}: ${errA.message}`); continue; }

      // State
      const stateRaw = localStorage.getItem(`acerto_${a.id}_state`);
      if (stateRaw) {
        const st = JSON.parse(stateRaw);
        await supabase.from("acerto_state").upsert(
          { acerto_id: a.id, dados_importados: st.dadosImportados ?? null, config: st.config ?? {} },
          { onConflict: "acerto_id" }
        );
      }

      // Lançamentos
      const lancRaw = localStorage.getItem(`acerto_${a.id}_lancamentos`);
      if (lancRaw) {
        const lancs = JSON.parse(lancRaw);
        if (Array.isArray(lancs) && lancs.length > 0) {
          const rows = lancs.map((l: Record<string, unknown>, idx: number) => ({
            id: String(l.id),
            acerto_id: a.id,
            tipo_lancamento_id: String(l.tipoLancamentoId ?? ""),
            historico: String(l.historico ?? ""),
            valor: l.valor as number | null,
            saldo_manual: l.saldoManual as number | null,
            posicao: idx,
          }));
          await supabase.from("acerto_lancamentos").upsert(rows, { onConflict: "id" });
        }
      }

      // Líder
      const liderRaw = localStorage.getItem(`acerto_${a.id}_lider`);
      if (liderRaw) {
        const ld = JSON.parse(liderRaw);
        await supabase.from("acerto_lider").upsert(
          {
            acerto_id: a.id,
            carta_bolsa: ld.cartaBolsa ?? { valor: 0, liderReceptor: "" },
            juros_campanha: ld.jurosCampanha ?? null,
          },
          { onConflict: "acerto_id" }
        );
      }

      // Débitos
      const debRaw = localStorage.getItem(`acerto_${a.id}_debitos`);
      if (debRaw) {
        const db = JSON.parse(debRaw);
        await supabase.from("acerto_debitos").upsert(
          {
            acerto_id: a.id,
            devedores: db.devedores ?? [],
            gastos_lideres: db.gastosLideres ?? [],
            gastos_caixa: db.gastosCaixa ?? { gastos: 0, debitosAdicionais: [] },
          },
          { onConflict: "acerto_id" }
        );
      }

      migrados++;
    } catch (e) {
      erros.push(`acerto ${a.nome}: ${String(e)}`);
    }
  }

  // ── Configuração global ───────────────────────────────────────────────────
  const configRaw = localStorage.getItem(CONFIG_KEY);
  if (configRaw) {
    try {
      const cfg = JSON.parse(configRaw);
      await supabase
        .from("config_global")
        .update({
          tipos: cfg.tipos ?? [],
          campos: cfg.campos ?? [],
          lideres: cfg.lideres ?? [],
        })
        .eq("id", 1);
    } catch (e) {
      erros.push(`config_global: ${String(e)}`);
    }
  }

  return { migrados, erros };
}

function limparLocalStorage(acertos: AcertoMetaRaw[]) {
  for (const a of acertos) {
    localStorage.removeItem(`acerto_${a.id}_state`);
    localStorage.removeItem(`acerto_${a.id}_lancamentos`);
    localStorage.removeItem(`acerto_${a.id}_lider`);
    localStorage.removeItem(`acerto_${a.id}_debitos`);
  }
  localStorage.removeItem(META_KEY);
  localStorage.removeItem(CONFIG_KEY);
  localStorage.setItem(MIGRATION_KEY, "1");
}

export function MigracaoLocalStorage() {
  const [visivel, setVisivel] = useState(false);
  const [estado, setEstado] = useState<"aguardando" | "migrando" | "ok" | "erro">("aguardando");
  const [resumo, setResumo] = useState("");
  const [acertosRaw, setAcertosRaw] = useState<AcertoMetaRaw[]>([]);

  useEffect(() => {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    const metaRaw = localStorage.getItem(META_KEY);
    if (!metaRaw) {
      // Nada para migrar — marca como feito
      localStorage.setItem(MIGRATION_KEY, "1");
      return;
    }
    try {
      const lista = JSON.parse(metaRaw) as AcertoMetaRaw[];
      if (lista.length === 0) {
        localStorage.setItem(MIGRATION_KEY, "1");
        return;
      }
      setAcertosRaw(lista);
      setVisivel(true);
    } catch {
      localStorage.setItem(MIGRATION_KEY, "1");
    }
  }, []);

  if (!visivel) return null;

  const handleMigrar = async () => {
    setEstado("migrando");
    try {
      const { migrados, erros } = await migrar();
      if (erros.length === 0) {
        limparLocalStorage(acertosRaw);
        setEstado("ok");
        setResumo(`${migrados} acerto${migrados !== 1 ? "s" : ""} migrado${migrados !== 1 ? "s" : ""} com sucesso.`);
        setTimeout(() => setVisivel(false), 3000);
      } else {
        setEstado("erro");
        setResumo(`${migrados} migrados, ${erros.length} erro(s): ${erros.slice(0, 3).join(" | ")}`);
      }
    } catch (e) {
      setEstado("erro");
      setResumo(String(e));
    }
  };

  const handleIgnorar = () => {
    localStorage.setItem(MIGRATION_KEY, "1");
    setVisivel(false);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="rounded-2xl bg-[#1A1F2E] border border-[#6C63FF]/40 shadow-2xl p-5">
        {estado === "aguardando" && (
          <>
            <p className="text-white font-semibold text-sm mb-1">Migração de dados detectada</p>
            <p className="text-[#8B8FA8] text-xs mb-4">
              Encontramos {acertosRaw.length} acerto{acertosRaw.length !== 1 ? "s" : ""} salvos localmente.
              Deseja movê-los para o Supabase agora?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleMigrar}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-[#6C63FF] text-white hover:bg-[#5B52E8] transition-colors"
              >
                Migrar agora
              </button>
              <button
                onClick={handleIgnorar}
                className="px-4 py-2 rounded-xl text-sm text-[#8B8FA8] hover:text-white bg-[#2A2F45] transition-colors"
              >
                Ignorar
              </button>
            </div>
          </>
        )}

        {estado === "migrando" && (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-white text-sm">Migrando dados para o Supabase…</p>
          </div>
        )}

        {estado === "ok" && (
          <p className="text-green-400 text-sm font-medium">✓ {resumo}</p>
        )}

        {estado === "erro" && (
          <>
            <p className="text-red-400 text-sm font-medium mb-2">Erro na migração</p>
            <p className="text-[#8B8FA8] text-xs mb-3">{resumo}</p>
            <div className="flex gap-2">
              <button
                onClick={handleMigrar}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[#6C63FF] text-white hover:bg-[#5B52E8] transition-colors"
              >
                Tentar novamente
              </button>
              <button
                onClick={handleIgnorar}
                className="px-4 py-2 rounded-xl text-sm text-[#8B8FA8] hover:text-white bg-[#2A2F45] transition-colors"
              >
                Ignorar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
