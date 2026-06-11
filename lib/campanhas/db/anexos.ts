import { supabase } from "@/lib/supabase";
import type { AcertoAnexo, GridCell, PdfCell, PreviewSheet } from "@/lib/campanhas/types/anexo";
import * as XLSX from "@e965/xlsx";

interface XlsxCellRef { r: number; c: number }
interface XlsxRange { s: XlsxCellRef; e: XlsxCellRef }

function cellValue(sheet: XLSX.WorkSheet, r: number, c: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return "";
  return cell.w ?? (cell.v != null ? String(cell.v) : "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cellFont(sheet: XLSX.WorkSheet, r: number, c: number): { bold: boolean; italic: boolean } {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })] as any;
  return {
    bold: cell?.s?.font?.bold === true,
    italic: cell?.s?.font?.italic === true,
  };
}

function parseSheet(sheet: XLSX.WorkSheet): { numCols: number; grid: GridCell[][]; pdfRows: PdfCell[][] } {
  const ref = sheet["!ref"];
  if (!ref) return { numCols: 0, grid: [], pdfRows: [] };

  const range = XLSX.utils.decode_range(ref) as { s: XlsxCellRef; e: XlsxCellRef };
  const merges: XlsxRange[] = ((sheet as Record<string, unknown>)["!merges"] as XlsxRange[]) ?? [];

  // Map each covered cell to its merge entry
  const mergeOf = new Map<string, XlsxRange>();
  for (const m of merges) {
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        mergeOf.set(`${r},${c}`, m);
      }
    }
  }

  const numCols = range.e.c - range.s.c + 1;
  const grid: GridCell[][] = [];
  const pdfRows: PdfCell[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const gridRow: GridCell[] = [];
    const pdfRow: PdfCell[] = [];
    let c = range.s.c;

    while (c <= range.e.c) {
      const m = mergeOf.get(`${r},${c}`);

      if (!m) {
        // Normal cell
        const value = cellValue(sheet, r, c);
        const { bold, italic } = cellFont(sheet, r, c);
        gridRow.push({ value, rowSpan: 1, colSpan: 1, hidden: false, bold, italic });
        pdfRow.push({ value, flex: 1, bold, italic });
        c++;
      } else if (m.s.r === r && m.s.c === c) {
        // Merge origin — render with full span
        const rowSpan = m.e.r - m.s.r + 1;
        const colSpan = m.e.c - m.s.c + 1;
        const value = cellValue(sheet, r, c);
        const { bold, italic } = cellFont(sheet, r, c);
        gridRow.push({ value, rowSpan, colSpan, hidden: false, bold, italic });
        for (let cc = c + 1; cc <= m.e.c; cc++) {
          gridRow.push({ value: "", rowSpan: 1, colSpan: 1, hidden: true });
        }
        pdfRow.push({ value, flex: colSpan, bold, italic });
        c = m.e.c + 1;
      } else if (m.s.c === c) {
        // Covered by rowspan (leftmost col, non-origin row) — empty placeholder
        const colSpan = m.e.c - m.s.c + 1;
        for (let cc = c; cc <= m.e.c; cc++) {
          gridRow.push({ value: "", rowSpan: 1, colSpan: 1, hidden: true });
        }
        pdfRow.push({ value: "", flex: colSpan });
        c = m.e.c + 1;
      } else {
        // Interior of colspan in non-origin row — already pushed above, skip
        c++;
      }
    }

    grid.push(gridRow);
    pdfRows.push(pdfRow);
  }

  return { numCols, grid, pdfRows };
}

const BUCKET = "acerto-anexos";
const DEFAULT_PAGE_SIZE = 10;

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadAnexo(acertoId: string, file: File): Promise<AcertoAnexo> {
  const ts = Date.now();
  const path = `acertos/${acertoId}/${ts}-${sanitize(file.name)}`;

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType:
        file.type ||
        (file.name.match(/\.pdf$/i)
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      upsert: false,
    });
  if (storageError) throw storageError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data, error: dbError } = await supabase
    .from("acerto_anexos")
    .insert({
      nome: file.name,
      acerto_id: acertoId,
      file_url: publicUrl,
      tamanho: file.size,
      data_upload: new Date().toISOString(),
    })
    .select()
    .single();

  if (dbError) throw dbError;
  return data as AcertoAnexo;
}

export async function listAnexos(
  acertoId: string,
  page = 0,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<{ data: AcertoAnexo[]; total: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("acerto_anexos")
    .select("*", { count: "exact" })
    .eq("acerto_id", acertoId)
    .is("deleted_at", null)
    .order("data_upload", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: (data ?? []) as AcertoAnexo[], total: count ?? 0 };
}

export async function softDeleteAnexo(id: string): Promise<void> {
  const { error } = await supabase
    .from("acerto_anexos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function loadAttachmentForPreview(attachmentId: string): Promise<PreviewSheet[]> {
  const { data, error } = await supabase
    .from("acerto_anexos")
    .select("file_url")
    .eq("id", attachmentId)
    .single();
  if (error) throw error;

  const res = await fetch(data.file_url);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellStyles: true });

  return wb.SheetNames.map((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const { numCols, grid, pdfRows } = parseSheet(sheet);
    return { sheetName, numCols, grid, pdfRows };
  });
}
