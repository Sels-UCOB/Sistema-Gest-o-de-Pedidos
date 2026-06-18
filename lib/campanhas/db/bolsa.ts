import { supabase } from "@/lib/supabase";
import * as XLSX from "@e965/xlsx";
import type { AcertoAnexo } from "@/lib/campanhas/types/anexo";
import type { AcertoBolsa, BolsaData, BolsaGlobalItem, ColportorBolsa } from "@/lib/campanhas/types/bolsa";
import type { AcertoMeta } from "@/lib/campanhas/types/acertoManager";

const BAG_PREFIX = "bagcolporteurreport";
const STOP_KEYWORDS = ["total", "quantidade", "subtotal"];

function raw(sheet: XLSX.WorkSheet, r: number, c: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return "";
  return cell.w ?? (cell.v != null ? String(cell.v) : "");
}

export function parseBagColporteurReport(buffer: ArrayBuffer): BolsaData {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return extractColportoresBolsa(sheet);
}

export function extractColportoresBolsa(sheet: XLSX.WorkSheet): BolsaData {
  const ref = sheet["!ref"];
  if (!ref) return { headers: [], colportores: [] };

  const range = XLSX.utils.decode_range(ref);

  let headerRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (raw(sheet, r, range.s.c).trim().toLowerCase() === "colportor") {
      headerRow = r;
      break;
    }
  }
  if (headerRow === -1) return { headers: [], colportores: [] };

  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    headers.push(raw(sheet, headerRow, c));
  }

  const colportores: ColportorBolsa[] = [];
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const nome = raw(sheet, r, range.s.c).trim();
    if (!nome) continue;
    if (STOP_KEYWORDS.some((k) => nome.toLowerCase().startsWith(k))) break;

    const colunas: string[] = [];
    for (let c = range.s.c + 1; c <= range.e.c; c++) {
      colunas.push(raw(sheet, r, c));
    }
    colportores.push({ nome, colunas });
  }

  return { headers, colportores };
}

export async function findBagReportAttachment(acertoId: string): Promise<AcertoAnexo | null> {
  const { data, error } = await supabase
    .from("acerto_anexos")
    .select("*")
    .eq("acerto_id", acertoId)
    .is("deleted_at", null);

  if (error) throw error;

  return (
    (data as AcertoAnexo[]).find((a) =>
      a.nome.toLowerCase().startsWith(BAG_PREFIX)
    ) ?? null
  );
}

export async function getBolsaData(
  acertoId: string
): Promise<{ anexo: AcertoAnexo | null; data: BolsaData | null }> {
  const anexo = await findBagReportAttachment(acertoId);
  if (!anexo) return { anexo: null, data: null };

  const res = await fetch(anexo.file_url);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const data = parseBagColporteurReport(buffer);

  return { anexo, data };
}

// ─── Funções híbridas (DB) ────────────────────────────────────────────────────

export async function getBolsaList(acertoId: string): Promise<AcertoBolsa[]> {
  const { data, error } = await supabase
    .from("acerto_bolsas")
    .select("*")
    .eq("acerto_id", acertoId)
    .eq("removido", false)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as AcertoBolsa[];
}

export async function addManualBolsa(
  acertoId: string,
  nome: string,
  dados: import("@/lib/campanhas/types/bolsa").AcertoBolsaDados | null = null
): Promise<AcertoBolsa> {
  const { data, error } = await supabase
    .from("acerto_bolsas")
    .insert({ acerto_id: acertoId, nome: nome.trim(), dados, origem: "MANUAL", removido: false })
    .select()
    .single();
  if (error) throw error;
  return data as AcertoBolsa;
}

export async function removeBolsa(id: string): Promise<void> {
  const { error } = await supabase
    .from("acerto_bolsas")
    .update({ removido: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function updateBolsa(
  id: string,
  nome: string,
  dados?: import("@/lib/campanhas/types/bolsa").AcertoBolsaDados | null
): Promise<void> {
  const payload: Record<string, unknown> = { nome: nome.trim(), updated_at: new Date().toISOString() };
  if (dados !== undefined) payload.dados = dados;
  const { error } = await supabase
    .from("acerto_bolsas")
    .update(payload)
    .eq("id", id)
    .eq("origem", "MANUAL");
  if (error) throw error;
}

export async function loadBolsaFromReport(acertoId: string): Promise<{
  headers: string[];
  inserted: number;
  removed: number;
}> {
  const { data: reportData } = await getBolsaData(acertoId);

  const { data: existing, error: fetchError } = await supabase
    .from("acerto_bolsas")
    .select("*")
    .eq("acerto_id", acertoId)
    .eq("origem", "AUTO");
  if (fetchError) throw fetchError;

  const existingAuto = existing as AcertoBolsa[];

  if (!reportData || reportData.colportores.length === 0) {
    // Marcar todos os AUTO ativos como removidos
    const idsAtivos = existingAuto.filter((b) => !b.removido).map((b) => b.id);
    if (idsAtivos.length > 0) {
      const { error } = await supabase
        .from("acerto_bolsas")
        .update({ removido: true, updated_at: new Date().toISOString() })
        .in("id", idsAtivos);
      if (error) throw error;
    }
    return { headers: [], inserted: 0, removed: idsAtivos.length };
  }

  // Headers do relatório (sem a coluna "Colportor")
  const extraHeaders = reportData.headers.slice(1);
  const reportNomes = new Set(reportData.colportores.map((c) => c.nome.toLowerCase()));

  // Remover AUTO ativos que não estão mais no relatório
  let removed = 0;
  const toRemove = existingAuto.filter((b) => !b.removido && !reportNomes.has(b.nome.toLowerCase()));
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("acerto_bolsas")
      .update({ removido: true, updated_at: new Date().toISOString() })
      .in("id", toRemove.map((b) => b.id));
    if (error) throw error;
    removed = toRemove.length;
  }

  // Separar em lotes: atualizações e inserções
  const now = new Date().toISOString();
  const toUpsert: Record<string, unknown>[] = [];
  const toInsert: Record<string, unknown>[] = [];
  let inserted = 0;

  for (const col of reportData.colportores) {
    const nomeLower = col.nome.toLowerCase();
    const ativo = existingAuto.find((b) => b.nome.toLowerCase() === nomeLower && !b.removido);
    const dados = { headers: extraHeaders, colunas: col.colunas };

    if (ativo) {
      toUpsert.push({
        id: ativo.id,
        acerto_id: ativo.acerto_id,
        nome: ativo.nome,
        dados,
        origem: "AUTO",
        removido: false,
        updated_at: now,
      });
    } else {
      // Não reativar registros que foram removidos manualmente
      const foiRemovidoManualmente = existingAuto.some(
        (b) => b.nome.toLowerCase() === nomeLower && b.removido
      );
      if (!foiRemovidoManualmente) {
        toInsert.push({ acerto_id: acertoId, nome: col.nome, dados, origem: "AUTO", removido: false });
        inserted++;
      }
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("acerto_bolsas").upsert(toUpsert, { onConflict: "id" });
    if (error) throw error;
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("acerto_bolsas").insert(toInsert);
    if (error) throw error;
  }

  return { headers: reportData.headers, inserted, removed };
}

// ─── Consulta global (cross-acerto) ──────────────────────────────────────────

function extractCampo(dados: AcertoBolsa["dados"], regex: RegExp): string {
  if (!dados) return "";
  const idx = dados.headers.findIndex((h) => regex.test(h));
  return idx !== -1 ? (dados.colunas[idx] ?? "") : "";
}

export async function getBolsasParaAcertos(
  acertos: AcertoMeta[]
): Promise<BolsaGlobalItem[]> {
  if (acertos.length === 0) return [];

  const ids = acertos.map((a) => a.id);

  const { data, error } = await supabase
    .from("acerto_bolsas")
    .select("*")
    .in("acerto_id", ids)
    .eq("removido", false)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data as AcertoBolsa[]).map((b) => ({
    id: b.id,
    acertoId: b.acerto_id,
    nome: b.nome,
    universidade: extractCampo(b.dados, /universidade/i),
    curso: extractCampo(b.dados, /curso/i),
    dados: b.dados,
  }));
}
