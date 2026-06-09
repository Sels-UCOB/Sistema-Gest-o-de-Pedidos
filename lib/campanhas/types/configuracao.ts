export interface TipoLancamento {
  id: string;
  nome: string;
  conta: string;
  subconta: string;
  departamento: string;
}

export interface Campo {
  id: string;
  nome: string;
  codigo: string;
}

export interface LiderConfig {
  id: string;
  nome: string;
  subcontaLider: string;
  subcontaLucro: string;
}
