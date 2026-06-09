export interface DevedorColportor {
  id: string;
  nome: string;
  valorDebito: number;
}

export interface DebitoAdicional {
  id: string;
  descricao: string;
  valor: number;
}

export interface GastosLider {
  gastos: number;
  debitosAdicionais: DebitoAdicional[];
}

export interface ResumoLiderCalc {
  nome: string;
  bonificacao: number;
  auxilio: number;
  totalBruto: number;
  carta: number;
  debitoColportores: number;
  gastos: number;
  debitosAdicionaisTotal: number;
  totalDebitos: number;
  dizimo: number;
  inss: number;
  irpf: number;
  saldoFinal: number;
}
