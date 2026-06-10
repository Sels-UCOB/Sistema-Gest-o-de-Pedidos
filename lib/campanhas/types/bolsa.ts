export interface ColportorBolsa {
  nome: string;
  colunas: string[];
}

export interface BolsaData {
  headers: string[];
  colportores: ColportorBolsa[];
}
