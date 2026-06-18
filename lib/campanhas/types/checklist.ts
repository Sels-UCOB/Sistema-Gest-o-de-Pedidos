export interface ChecklistItem {
  itemKey: string;
  acertoId: string;
  descricao: string;
  marcado: boolean;
  dataMarcacao?: string;
}

export interface ChecklistProgresso {
  marcados: number;
  total: number;
}

// Ordem e descrição canônica dos itens — nunca alterar item_key existente
export const CHECKLIST_PADRAO: { itemKey: string; descricao: string; grupo: "verificacao" | "anexo" }[] = [
  { itemKey: "conferiu_saldo_razao",      descricao: "Conferiu o saldo final do Razão?",  grupo: "verificacao" },
  { itemKey: "conferiu_promocional",      descricao: "Conferiu Promocional?",              grupo: "verificacao" },
  { itemKey: "conferiu_despesa_campanha", descricao: "Conferiu Despesa de Campanha?",      grupo: "verificacao" },
  { itemKey: "conferiu_despesas_sels",    descricao: "Conferiu Despesas SELS?",            grupo: "verificacao" },
  { itemKey: "cobrou_aluguel_maquinas",   descricao: "Cobrou Aluguel de Máquinas?",        grupo: "verificacao" },
  { itemKey: "apurou_gastos_lider",       descricao: "Apurou Gastos de Líder?",            grupo: "verificacao" },
  { itemKey: "pegou_notas_avisos",        descricao: "Pegou TODAS as Notas para Avisos?",  grupo: "verificacao" },
  { itemKey: "anexou_conta_lider",        descricao: "Conta do Líder (Excel)",             grupo: "anexo" },
  { itemKey: "anexou_despesa_campanha",   descricao: "Despesa de Campanha",                grupo: "anexo" },
  { itemKey: "anexou_promocional",        descricao: "Promocional",                        grupo: "anexo" },
  { itemKey: "anexou_fluxo_caixa",        descricao: "Fluxo de Caixa",                    grupo: "anexo" },
  { itemKey: "anexou_saldo_colportores",  descricao: "Saldo dos Colportores",              grupo: "anexo" },
  { itemKey: "anexou_despesas_sels",      descricao: "Despesas SELS",                      grupo: "anexo" },
  { itemKey: "anexou_vendas_campanha",    descricao: "Vendas da Campanha",                 grupo: "anexo" },
  { itemKey: "anexou_bolsas",             descricao: "Bolsas",                             grupo: "anexo" },
  { itemKey: "anexou_razao_aasi_pdf",     descricao: "Razão AASI em PDF",                  grupo: "anexo" },
];
