export interface Lancamento {
  id: string;
  tipoLancamentoId: string;
  historico: string;
  valor: number | null;
  saldoManual: number | null;
}
