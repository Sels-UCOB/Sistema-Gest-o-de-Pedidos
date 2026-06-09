import type { Lancamento } from "@/lib/campanhas/types/lancamento";

export function calcularSaldos(linhas: Lancamento[]): number[] {
  const saldos: number[] = [];
  for (let i = 0; i < linhas.length; i++) {
    if (i === 0) {
      saldos.push(linhas[0].saldoManual ?? 0);
    } else {
      saldos.push(saldos[i - 1] + (linhas[i].valor ?? 0));
    }
  }
  return saldos;
}
