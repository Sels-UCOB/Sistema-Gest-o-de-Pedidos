export type CampanhaType =
  | "Verão"
  | "Inverno"
  | "Sonhando Alto 1"
  | "Sonhando Alto 2"
  | "Outro";

export type CampoType =
  | "ALM"
  | "AOM"
  | "ASM"
  | "ABC"
  | "APLAC"
  | "MTO"
  | "IDEC"
  | "Outro";

export interface DadosImportados {
  nomes: string[];
  saldos: number[];
  compraTotal: number;
  bonificado: number;
}

export interface LiderAcerto {
  nome: string;
  bonificacaoPercentual: number;
  auxilioPercentual: number;
  percentualDebito: number;
  possuiVeiculoSPA: boolean;
}

export interface CaixaAcerto {
  nome: string;
  salarioCaixa: number | null;
  auxilioPercentual: number;
  percentualDiferencaCaixa: number;
}

const LIDER_VAZIO: LiderAcerto = { nome: "", bonificacaoPercentual: 0, auxilioPercentual: 0, percentualDebito: 0, possuiVeiculoSPA: false };

export interface ConfigCampanha {
  tipoCampanha: CampanhaType;
  tipoCampanhaOutro: string;
  numLideres: 1 | 2 | 3 | 4;
  lideres: [LiderAcerto, LiderAcerto, LiderAcerto, LiderAcerto];
  caixa: CaixaAcerto;
  subContaCampanha: string;
  departamento: string;
  campo: CampoType;
  campoOutro: string;
}

export interface AcertoState {
  dadosImportados: DadosImportados | null;
  config: ConfigCampanha;
}

export const CONFIG_INICIAL: ConfigCampanha = {
  tipoCampanha: "Sonhando Alto 1",
  tipoCampanhaOutro: "",
  numLideres: 1,
  lideres: [
    { nome: "", bonificacaoPercentual: 14, auxilioPercentual: 2, percentualDebito: 100, possuiVeiculoSPA: false },
    { ...LIDER_VAZIO },
    { ...LIDER_VAZIO },
    { ...LIDER_VAZIO },
  ],
  caixa: { nome: "", salarioCaixa: null, auxilioPercentual: 0, percentualDiferencaCaixa: 0 },
  subContaCampanha: "",
  departamento: "",
  campo: "AOM",
  campoOutro: "",
};
