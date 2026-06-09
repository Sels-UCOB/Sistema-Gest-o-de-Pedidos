import type { ConfigCampanha, DadosImportados } from "@/lib/campanhas/types/acerto";
import type { Lancamento } from "@/lib/campanhas/types/lancamento";
import type { TipoLancamento } from "@/lib/campanhas/types/configuracao";
import type { LinhaTabela, CartaBolsa } from "@/lib/campanhas/types/lancamentoLider";
import type { DevedorColportor, GastosLider, ResumoLiderCalc } from "@/lib/campanhas/types/debitos";

export type TipoExportacao = "SELS" | "LIDERES" | "CAMPO";

export interface DiferencaCaixaCalc {
  saldoInicial: number;
  salarioCaixa: number;
  fpc: number;
  juros: number;
  base: number;
  totalDebitosLideres: number;
  totalDebitosCaixa: number;
  totalDebitos: number;
  diferenca: number;
  temJuros: boolean;
}

export interface GrupoCampanha {
  nome: string;
  total: number;
}

export interface Anexo {
  nome: string;
  tipo: string;
  url: string;
  data: string;
}

export interface DadosPDF {
  tipo: TipoExportacao;
  config: ConfigCampanha;
  dadosImportados: DadosImportados | null;
  lancamentos: Lancamento[];
  tipos: TipoLancamento[];
  linhasLider: LinhaTabela[];
  saldoInicialLider: number;
  devedores: DevedorColportor[];
  gastosLideres: GastosLider[];
  gastosCaixa: GastosLider;
  cartaBolsa: CartaBolsa;
  jurosCampanha: number | null;
  resumosLideres: ResumoLiderCalc[];
  grupoCampanha: GrupoCampanha[];
  totalGeralCampanha: number;
  diferencaCaixa: DiferencaCaixaCalc;
  anexos?: Anexo[];
}
