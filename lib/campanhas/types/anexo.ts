export interface AcertoAnexo {
  id: string;
  nome: string;
  acerto_id: string;
  file_url: string;
  tamanho: number;
  data_upload: string;
  created_at: string;
  deleted_at?: string | null;
}

export type SheetCellValue = string | number | boolean | null;
export type SheetRow = Record<string, SheetCellValue>;

export interface PreviewSheet {
  sheetName: string;
  headers: string[];
  rows: SheetRow[];
}
