import type { LinhaTabela } from "@/lib/campanhas/types/lancamentoLider";

function arred(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcularSaldosLider(
  linhas: LinhaTabela[],
  saldoInicial: number
): number[] {
  const saldos: number[] = [];
  let saldoAtual = saldoInicial;

  for (const linha of linhas) {
    if (linha.tipo === "header" || linha.excluirDoSaldo) {
      saldos.push(saldoAtual);
    } else {
      saldoAtual = arred(saldoAtual + linha.valor);
      saldos.push(saldoAtual);
    }
  }

  return saldos;
}
