import type { LiderAcerto } from "@/lib/campanhas/types/acerto";
import type { DevedorColportor, GastosLider, ResumoLiderCalc } from "@/lib/campanhas/types/debitos";
import { calcularINSSDetalhe, calcularIRPFDetalhe } from "@/lib/campanhas/calcularImpostos";
import { DIZIMO_PERCENTUAL } from "@/lib/campanhas/config/impostos";

function arred(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcularPercentuaisProporcional(
  lideres: LiderAcerto[],
  numLideres: 1 | 2 | 3 | 4
): number[] {
  const result = [0, 0, 0, 0];
  const ativos = Array.from({ length: numLideres }, (_, i) => lideres[i]);
  const totalBonif = ativos.reduce((s, l) => s + l.bonificacaoPercentual, 0);
  if (totalBonif === 0) return result;

  let acc = 0;
  ativos.forEach((l, i) => {
    if (i === numLideres - 1) {
      result[i] = arred(100 - acc);
    } else {
      const pct = arred((l.bonificacaoPercentual / totalBonif) * 100);
      result[i] = pct;
      acc += pct;
    }
  });
  return result;
}

export function calcularTotalDevedores(devedores: DevedorColportor[]): number {
  return arred(devedores.reduce((s, d) => s + d.valorDebito, 0));
}

export function calcularResumoLider(params: {
  lider: LiderAcerto;
  percentualDebito: number;
  totalDevedores: number;
  gastosLider: GastosLider;
  compraBonificada: number;
  cartaBolsaValor: number;
  cartaBolsaReceptor: string;
}): ResumoLiderCalc {
  const {
    lider,
    percentualDebito,
    totalDevedores,
    gastosLider,
    compraBonificada,
    cartaBolsaValor,
    cartaBolsaReceptor,
  } = params;

  const bonificacao = arred((lider.bonificacaoPercentual / 100) * compraBonificada);
  const auxilio = arred((lider.auxilioPercentual / 100) * compraBonificada);
  const totalBruto = arred(bonificacao + auxilio);
  const carta = cartaBolsaReceptor === lider.nome ? cartaBolsaValor : 0;

  const dizimo = arred(bonificacao * DIZIMO_PERCENTUAL);
  const inssDetalhe = calcularINSSDetalhe(bonificacao, carta);
  const irpfDetalhe = calcularIRPFDetalhe(bonificacao, carta);

  const debitoColportores = arred((percentualDebito / 100) * totalDevedores);
  const debitosAdicionaisTotal = arred(
    gastosLider.debitosAdicionais.reduce((s, d) => s + d.valor, 0)
  );
  const totalDebitos = arred(gastosLider.gastos + debitoColportores + debitosAdicionaisTotal);

  const saldoFinal = arred(
    totalBruto - carta - totalDebitos - dizimo - inssDetalhe.valor - irpfDetalhe.irpfTotal
  );

  return {
    nome: lider.nome,
    bonificacao,
    auxilio,
    totalBruto,
    carta,
    debitoColportores,
    gastos: gastosLider.gastos,
    debitosAdicionaisTotal,
    totalDebitos,
    dizimo,
    inss: inssDetalhe.valor,
    irpf: irpfDetalhe.irpfTotal,
    saldoFinal,
  };
}
