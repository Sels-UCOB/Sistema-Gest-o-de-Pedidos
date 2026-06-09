export type StatusAcerto = "Criado" | "Em Aberto" | "Encerrado";

export interface AcertoMeta {
  id: string;
  nome: string;
  campo: string;
  tipoCampanha: string;
  dataCriacao: string;
  status: StatusAcerto;
  dataEncerramento?: string;
}

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
