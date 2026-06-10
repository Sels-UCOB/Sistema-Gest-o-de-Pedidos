import { supabase } from "@/lib/supabase";
import type { AcertoAnexo, PreviewSheet, SheetRow } from "@/lib/campanhas/types/anexo";
import * as XLSX from "@e965/xlsx";

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
        file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });

  return wb.SheetNames.map((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: null });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { sheetName, headers, rows };
  });
}
