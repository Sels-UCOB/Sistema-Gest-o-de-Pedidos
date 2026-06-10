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

export interface GridCell {
  value: string;
  rowSpan: number;
  colSpan: number;
  hidden: boolean;
  bold?: boolean;
  italic?: boolean;
}

export interface PdfCell {
  value: string;
  flex: number;
  bold?: boolean;
  italic?: boolean;
}

export interface PreviewSheet {
  sheetName: string;
  numCols: number;
  grid: GridCell[][];
  pdfRows: PdfCell[][];
}
