export interface ColportorBolsa {
  nome: string;
  colunas: string[];
}

export interface BolsaData {
  headers: string[];
  colportores: ColportorBolsa[];
}

export type BolsaOrigem = "AUTO" | "MANUAL";

export interface AcertoBolsaDados {
  headers: string[];
  colunas: string[];
}

export interface AcertoBolsa {
  id: string;
  acerto_id: string;
  nome: string;
  dados: AcertoBolsaDados | null;
  origem: BolsaOrigem;
  removido: boolean;
  created_at: string;
  updated_at: string;
}

export interface BolsaGlobalItem {
  id: string;
  acertoId: string;
  nome: string;
  universidade: string;
  curso: string;
  dados: AcertoBolsaDados | null;
}
