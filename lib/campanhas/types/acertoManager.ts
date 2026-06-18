export type StatusAcerto = "Criado" | "Em Aberto" | "Encerrado";

export interface AcertoMeta {
  id: string;
  nome: string;
  campo: string;
  regiao: string;
  tipoCampanha: string;
  dataCriacao: string;
  status: StatusAcerto;
  dataEncerramento?: string;
  loteAASI?: number;
}

// Mapeamento de associação → região (mirrors do backfill na migration)
const CAMPO_REGIAO_MAP: Record<string, string> = {
  ALM: "MT",
  AOM: "MT",
  ASM: "MS",
};

export function campoToRegiao(campo: string): string {
  return CAMPO_REGIAO_MAP[campo] ?? "GO";
}

// Campos disponíveis por região (para filtrar o modal por role do operador)
export const CAMPOS_POR_REGIAO: Record<string, readonly string[]> = {
  MT: ["ALM", "AOM"],
  MS: ["ASM"],
  GO: ["ABC", "APLAC", "MTO", "IDEC", "Outro"],
};

export const TODOS_CAMPOS = ["ALM", "AOM", "ASM", "ABC", "APLAC", "MTO", "IDEC", "Outro"] as const;

export interface CriarAcertoData {
  nome: string;
  campo: string;
  tipoCampanha: string;
}

export interface FiltrosAcerto {
  status: StatusAcerto | "todos";
  campo: string;
  tipoCampanha: string;
  dataInicio: string;
  dataFim: string;
}
