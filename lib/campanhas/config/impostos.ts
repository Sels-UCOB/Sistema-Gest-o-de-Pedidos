export const INSS_PERCENTUAL = 0.10;
export const INSS_PERCENTUAL_IRPF = 0.20;
export const DIZIMO_PERCENTUAL = 0.10;
export const FPC_PERCENTUAL = 0.02;

export interface FaixaIRPF {
  limite: number;
  aliquota: number;
  deducao: number;
}

export const TABELA_IRPF_MENSAL_2026: FaixaIRPF[] = [
  { limite: 2428.80,  aliquota: 0,     deducao: 0      },
  { limite: 2826.65,  aliquota: 0.075, deducao: 182.16 },
  { limite: 3751.05,  aliquota: 0.15,  deducao: 394.16 },
  { limite: 4664.68,  aliquota: 0.225, deducao: 675.49 },
  { limite: Infinity, aliquota: 0.275, deducao: 908.73 },
];
