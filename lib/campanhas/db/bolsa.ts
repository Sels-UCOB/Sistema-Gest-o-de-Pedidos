import { supabase } from "@/lib/supabase";
import * as XLSX from "@e965/xlsx";
import type { AcertoAnexo } from "@/lib/campanhas/types/anexo";
import type { BolsaData, ColportorBolsa } from "@/lib/campanhas/types/bolsa";

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

  // Find header row: first cell contains "colportor" (case-insensitive)
  let headerRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (raw(sheet, r, range.s.c).trim().toLowerCase() === "colportor") {
      headerRow = r;
      break;
    }
  }
  if (headerRow === -1) return { headers: [], colportores: [] };

  // Extract column headers
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    headers.push(raw(sheet, headerRow, c));
  }

  // Read data rows until stop keyword or end of sheet
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
