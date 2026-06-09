import type { CampanhaType, CampoType, ConfigCampanha } from "@/lib/campanhas/types/acerto";

// ─── Opções de campanha ───────────────────────────────────────────────────────
export const CAMPANHAS: CampanhaType[] = [
  "Verão",
  "Inverno",
  "Sonhando Alto 1",
  "Sonhando Alto 2",
  "Outro",
];

// ─── Opções de campo ──────────────────────────────────────────────────────────
export const CAMPOS: CampoType[] = [
  "ALM",
  "AOM",
  "ASM",
  "ABC",
  "APLAC",
  "MTO",
  "IDEC",
  "Outro",
];

// ─── Defaults de bonificação/auxílio por nº de líderes ───────────────────────
export interface DefaultLider {
  bonificacaoPercentual: number;
  auxilioPercentual: number;
  percentualDebito: number;
}

export const DEFAULTS_LIDERES: Record<1 | 2 | 3 | 4, DefaultLider[]> = {
  1: [{ bonificacaoPercentual: 14, auxilioPercentual: 2, percentualDebito: 100 }],
  2: [
    { bonificacaoPercentual: 11, auxilioPercentual: 3, percentualDebito: 61.11 },
    { bonificacaoPercentual: 7,  auxilioPercentual: 0, percentualDebito: 38.89 },
  ],
  3: [
    { bonificacaoPercentual: 9, auxilioPercentual: 4, percentualDebito: 45 },
    { bonificacaoPercentual: 6, auxilioPercentual: 0, percentualDebito: 30 },
    { bonificacaoPercentual: 5, auxilioPercentual: 0, percentualDebito: 25 },
  ],
  4: [
    { bonificacaoPercentual: 0, auxilioPercentual: 0, percentualDebito: 0 },
    { bonificacaoPercentual: 0, auxilioPercentual: 0, percentualDebito: 0 },
    { bonificacaoPercentual: 0, auxilioPercentual: 0, percentualDebito: 0 },
    { bonificacaoPercentual: 0, auxilioPercentual: 0, percentualDebito: 0 },
  ],
};

// ─── Totais esperados para validação (4 líderes = sem validação) ──────────────
export const TOTAIS_ESPERADOS: Partial<Record<1 | 2 | 3 | 4, { bonificacao: number; auxilio: number }>> = {
  1: { bonificacao: 14, auxilio: 2 },
  2: { bonificacao: 18, auxilio: 3 },
  3: { bonificacao: 20, auxilio: 4 },
};

// ─── Mínimo de colportores por líder por tipo de campanha ─────────────────────
export const MIN_COLPORTORES_POR_LIDER: Partial<Record<CampanhaType, number>> = {
  "Verão":         20,
  "Sonhando Alto 1": 20,
  "Sonhando Alto 2": 20,
  "Inverno":       25,
};

// ─── Valores padrão do formulário ─────────────────────────────────────────────
const LIDER_VAZIO = { nome: "", bonificacaoPercentual: 0, auxilioPercentual: 0, percentualDebito: 0, possuiVeiculoSPA: false } as const;

export const CONFIG_PADRAO: ConfigCampanha = {
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

// ─── Configurações de exibição ────────────────────────────────────────────────
export const EXIBICAO = {
  previewMaxLinhas: 5,
  numLideres: 4,
};

// ─── Identidade da organização ────────────────────────────────────────────────
export const ORGANIZACAO = {
  nome: process.env.NEXT_PUBLIC_NOME_ORGANIZACAO ?? "SELS UCOB ME",
  versao: process.env.NEXT_PUBLIC_VERSAO ?? "0.1.0",
};
