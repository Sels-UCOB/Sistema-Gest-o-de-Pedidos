import type { TipoLancamento, Campo } from "@/lib/campanhas/types/configuracao";

export const TIPOS_INICIAIS: TipoLancamento[] = [
  { id: "t1",  nome: "Lucro",        conta: "", subconta: "", departamento: "" },
  { id: "t2",  nome: "FPC Campo",              conta: "", subconta: "", departamento: "" },
  { id: "t3",  nome: "FPC UCOB",               conta: "", subconta: "", departamento: "" },
  { id: "t4",  nome: "Internet",               conta: "", subconta: "", departamento: "" },
  { id: "t5",  nome: "Fretes Campanha",        conta: "", subconta: "", departamento: "" },
  { id: "t6",  nome: "Material de Escritório", conta: "", subconta: "", departamento: "" },
  { id: "t7",  nome: "Aluguel Cielo",          conta: "", subconta: "", departamento: "" },
  { id: "t8",  nome: "Despesa a Identificar",  conta: "", subconta: "", departamento: "" },
  { id: "t9",  nome: "Transf. Saldo",          conta: "", subconta: "", departamento: "" },
  { id: "t10", nome: "Transf. Cartão",         conta: "", subconta: "", departamento: "" },
];

export const CAMPOS_INICIAIS: Campo[] = [
  { id: "c1", nome: "ALM",   codigo: "" },
  { id: "c2", nome: "AOM",   codigo: "" },
  { id: "c3", nome: "APlaC", codigo: "" },
  { id: "c4", nome: "ASM",   codigo: "" },
  { id: "c5", nome: "ABC",   codigo: "" },
  { id: "c6", nome: "MTO",   codigo: "" },
];
