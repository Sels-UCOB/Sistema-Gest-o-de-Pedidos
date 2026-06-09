import type { DetalheINSS, DetalheIRPF } from "@/lib/campanhas/types/lancamentoLider";
import {
  INSS_PERCENTUAL,
  INSS_PERCENTUAL_IRPF,
  TABELA_IRPF_MENSAL_2026,
} from "@/lib/campanhas/config/impostos";

function arred(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcularINSSDetalhe(
  bonificacao: number,
  carta: number
): DetalheINSS {
  const base = arred(bonificacao - carta);
  const valor = arred(base * INSS_PERCENTUAL);
  return { bonificacao, carta, base, percentual: INSS_PERCENTUAL, valor };
}

function etapa1(baseMensal: number): { aliquota: number; deducao: number; impostoBase: number } {
  for (const faixa of TABELA_IRPF_MENSAL_2026) {
    if (baseMensal <= faixa.limite) {
      return {
        aliquota: faixa.aliquota,
        deducao: faixa.deducao,
        impostoBase: Math.max(0, arred(baseMensal * faixa.aliquota - faixa.deducao)),
      };
    }
  }
  return { aliquota: 0, deducao: 0, impostoBase: 0 };
}

export function calcularIRPFDetalhe(
  bonificacao: number,
  carta: number
): DetalheIRPF {
  const baseAjustada = arred(bonificacao - carta);
  const rendaMensal = arred(baseAjustada / 6);
  const inssDeducao = arred(rendaMensal * INSS_PERCENTUAL_IRPF);
  const baseMensal = arred(rendaMensal - inssDeducao);
  const { aliquota: faixaAliquota, deducao: faixaDeducao, impostoBase } = etapa1(baseMensal);

  let etapa2: "isencao" | "desconto" | "integral";
  let desconto = 0;
  let irpfMensal: number;

  if (rendaMensal <= 5000) {
    etapa2 = "isencao";
    irpfMensal = 0;
  } else if (rendaMensal <= 7350) {
    etapa2 = "desconto";
    desconto = arred(908.73 - 0.133 * rendaMensal);
    irpfMensal = Math.max(0, arred(impostoBase - desconto));
  } else {
    etapa2 = "integral";
    irpfMensal = impostoBase;
  }

  return {
    bonificacao,
    carta,
    baseAjustada,
    inssDeducao,
    baseMensal,
    rendaMensal,
    faixaAliquota,
    faixaDeducao,
    impostoBase,
    etapa2,
    desconto,
    irpfMensal,
    irpfTotal: arred(irpfMensal * 6),
  };
}
