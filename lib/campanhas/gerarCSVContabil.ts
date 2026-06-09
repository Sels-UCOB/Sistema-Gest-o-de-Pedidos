import type { Lancamento } from "@/lib/campanhas/types/lancamento";
import type { TipoLancamento, LiderConfig, Campo } from "@/lib/campanhas/types/configuracao";
import type { ConfigCampanha, DadosImportados, LiderAcerto } from "@/lib/campanhas/types/acerto";
import type { CartaBolsa } from "@/lib/campanhas/types/lancamentoLider";
import type { DevedorColportor, GastosLider } from "@/lib/campanhas/types/debitos";
import { calcularResumoLider } from "@/lib/campanhas/calcularDebitos";
import { calcularINSSDetalhe, calcularIRPFDetalhe } from "@/lib/campanhas/calcularImpostos";
import { FPC_PERCENTUAL, DIZIMO_PERCENTUAL } from "@/lib/campanhas/config/impostos";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";

export interface ParamsCSV {
  lancamentos: Lancamento[];
  tipos: TipoLancamento[];
  lideresConfig: LiderConfig[];
  campos: Campo[];
  config: ConfigCampanha;
  cartaBolsa: CartaBolsa;
  jurosCampanha: number | null;
  devedores: DevedorColportor[];
  gastosLideres: GastosLider[];
  gastosCaixa: GastosLider;
  dadosImportados: DadosImportados;
}

// ─── helpers de formatação ───────────────────────────────────────────────────

function arred(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Primeiro dígito da conta → restrição */
function restricaoDe(conta: string): string {
  const first = conta.charAt(0);
  if (first === "3") return "2";
  if (first === "4") return "0E";
  return "0A"; // 1 e 2
}

/** Valor × 100, mantendo sinal, sem decimais */
function fmtValor(v: number): string {
  return String(Math.round(v * 100));
}

/** Força texto no Excel: ="valor" com escape CSV correto */
function subTexto(s: string): string {
  return '"=""' + s.replace(/"/g, '""') + '"""';
}

/** Escapa campo CSV genérico */
function csvCampo(s: string): string {
  if (/[;"'\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ─── tipos internos ───────────────────────────────────────────────────────────

interface Linha {
  conta: string;
  subconta: string;
  departamento: string;
  valor: number;
  historico: string;
}

function linhaToCsv(l: Linha): string {
  return [
    l.conta,
    subTexto(l.subconta),
    "10",
    l.departamento,
    restricaoDe(l.conta),
    fmtValor(l.valor),
    l.conta === "1136001" ? "Y" : "N",
    csvCampo(l.historico),
  ].join(";");
}

// ─── geração principal ────────────────────────────────────────────────────────

export function gerarCSVContabil(p: ParamsCSV): string {
  const linhas: Linha[] = [];
  const { config, dadosImportados } = p;
  const subCamp = config.subContaCampanha;
  const deptoPadrao = config.departamento;
  const compraBonificada = dadosImportados.bonificado;
  const campanha =
    config.tipoCampanha === "Outro" ? config.tipoCampanhaOutro : config.tipoCampanha;
  const campo = config.campo === "Outro" ? config.campoOutro : config.campo;
  const ano = new Date().getFullYear();
  const numLideres = config.numLideres;
  const codigoCampo = p.campos.find((c) => c.nome === campo)?.codigo ?? "";

  /** Contas iniciadas em "2" sempre departamento 139811; demais usam configuração */
  function depto(conta: string): string {
    return conta.startsWith("2") ? "139811" : deptoPadrao;
  }

  function mk(conta: string, sub: string, valor: number, hist: string): Linha {
    return { conta, subconta: sub, departamento: depto(conta), valor, historico: hist };
  }

  /**
   * Gera um par de lançamentos (partida dobrada).
   *
   * A conta 1134002 (campanha) recebe o valor EXATAMENTE como no sistema (appValor).
   * A conta de origem recebe o valor INVERTIDO (-appValor).
   */
  function addPar(conta: string, sub: string, appValor: number, hist: string) {
    linhas.push(mk(conta, sub, -appValor, hist));                                                              // origem: invertido
    linhas.push({ conta: "1134002", subconta: subCamp, departamento: "139811", valor: appValor, historico: hist }); // campanha: original
  }

  // ── PARTE 1 – Lançamentos Campanha ────────────────────────────────────────

  const tipoMap = new Map(p.tipos.map((t) => [t.id, t]));

  for (const l of p.lancamentos) {
    if (!l.tipoLancamentoId || l.valor === null || l.valor === 0) continue;
    const tipo = tipoMap.get(l.tipoLancamentoId);
    if (!tipo || !tipo.conta.trim()) continue;

    let hist: string;
    if (tipo.nome === "Lucro") {
      hist = `${l.historico} - Lucro ${campanha} ${campo} ${ano}`;
    } else if (tipo.nome === "FPC Campo") {
      hist = `${codigoCampo} - FPC Campo - ${l.historico}`;
    } else if (tipo.nome === "FPC UCOB") {
      hist = `141111 - FPC UCOB - ${l.historico}`;
    } else {
      hist = l.historico.trim() ? `${tipo.nome} - ${l.historico}` : tipo.nome;
    }
    addPar(tipo.conta, tipo.subconta, l.valor, hist);
  }

  // ── PARTE 2 – Lançamentos Líderes ─────────────────────────────────────────

  // 2.1 FPC – 4 entradas: 4142055 | 1134002 | 3192240 | 1136001
  const fpc = arred(compraBonificada * FPC_PERCENTUAL);
  const histFpc = `2% Bonific. Brindes - ${formatarBRL(compraBonificada)} - ${campanha} ${campo} ${ano}`;
  const histFpcUCOB = `141111 - FPC - ${histFpc}`;

  // appValor = -fpc (campo paga: 1134002 diminui; 4142055 recebe +fpc)
  addPar("4142055", "2%", -fpc, histFpc);                          // entradas 1 + 2
  linhas.push(mk("3192240", "141111", -fpc, histFpcUCOB));         // entrada 3 (invertida)
  linhas.push(mk("1136001", "141111", fpc, histFpcUCOB));          // entrada 4 (original, Flag=Y)

  // 2.2 Juros Campanha
  if (p.jurosCampanha !== null && p.jurosCampanha !== 0) {
    const hist = `Juros Campanha - ${campanha} ${campo} ${ano}`;
    addPar("4129510", "4", p.jurosCampanha, hist);
  }

  const lcMap = new Map(p.lideresConfig.map((l) => [l.nome, l]));

  // 2.3 Bonificação por líder  (appValor = -bonif → campo paga)
  for (let i = 0; i < numLideres; i++) {
    const lider = config.lideres[i];
    if (!lider.nome.trim() || lider.bonificacaoPercentual === 0) continue;
    const bonif = arred((lider.bonificacaoPercentual / 100) * compraBonificada);
    const hist = `${lider.bonificacaoPercentual}% - Bonificação s/ Compra ${formatarBRL(compraBonificada)} - ${lider.nome}`;
    addPar("4119525", "3", -bonif, hist);
  }

  // 2.4 Auxílio por líder  (appValor = -aux → campo paga)
  for (let i = 0; i < numLideres; i++) {
    const lider = config.lideres[i];
    if (!lider.nome.trim() || lider.auxilioPercentual === 0) continue;
    const aux = arred((lider.auxilioPercentual / 100) * compraBonificada);
    const hist = `${lider.auxilioPercentual}% - Auxílio p/ Relatório ${formatarBRL(aux)} - ${lider.nome}`;
    addPar("4119525", "3", -aux, hist);
  }

  // 2.4 Auxílio caixa (salário NÃO entra aqui)
  const caixa = config.caixa;
  if (caixa.nome.trim() && caixa.auxilioPercentual > 0) {
    const auxCaixa = arred((caixa.auxilioPercentual / 100) * compraBonificada);
    if (auxCaixa > 0) {
      const hist = `${caixa.auxilioPercentual}% - Auxílio p/ Relatório ${formatarBRL(auxCaixa)} - ${caixa.nome}`;
      addPar("4119525", "3", -auxCaixa, hist);
    }
  }

  // 2.5 Impostos por líder  (appValor = +imposto → campo retém / recupera)
  for (let i = 0; i < numLideres; i++) {
    const lider = config.lideres[i];
    if (!lider.nome.trim()) continue;
    const subLider = lcMap.get(lider.nome)?.subcontaLider ?? "";
    const bonif = arred((lider.bonificacaoPercentual / 100) * compraBonificada);
    const carta = p.cartaBolsa.liderReceptor === lider.nome ? p.cartaBolsa.valor : 0;
    const dizimo = arred(bonif * DIZIMO_PERCENTUAL);
    const inssD = calcularINSSDetalhe(bonif, carta);
    const irpfD = calcularIRPFDetalhe(bonif, carta);

    if (dizimo > 0)
      addPar("2134002", subLider, dizimo, `Dízimo Bonificação 10% - ${lider.nome}`);
    if (inssD.valor > 0)
      addPar("2134002", subLider, inssD.valor, `INSS 10% Contr Participante - ${lider.nome}`);
    if (irpfD.irpfTotal > 0)
      addPar("2134002", subLider, irpfD.irpfTotal, `IRPF a Recolher - ${lider.nome}`);
  }

  // 2.6 Carta de Bolsa  (appValor = +carta → campo recebe da CPB)
  if (p.cartaBolsa.valor > 0 && p.cartaBolsa.liderReceptor.trim()) {
    const hist = `Carta de Bolsa CPB - ${p.cartaBolsa.liderReceptor}`;
    addPar("4119525", "3", p.cartaBolsa.valor, hist);
  }

  // ── A PARTIR DAQUI: SEM INVERSO ───────────────────────────────────────────

  const totalDevedores = arred(p.devedores.reduce((s, d) => s + d.valorDebito, 0));

  // 2.7 Débitos Colportores – individual por colportor, por líder (sem inverso)
  for (let i = 0; i < numLideres; i++) {
    const lider = config.lideres[i];
    if (!lider.nome.trim() || !lider.percentualDebito) continue;
    const subLucro = lcMap.get(lider.nome)?.subcontaLucro ?? "";
    const pct = lider.percentualDebito;

    for (const dev of p.devedores) {
      const valor = arred((pct / 100) * dev.valorDebito);
      if (valor === 0) continue;
      linhas.push(mk("2134002", subLucro, valor, `Débito ${pct}% - ${dev.nome}`));
    }
  }

  // 2.8 Salário do líder – três etapas por líder (sem inverso)
  for (let i = 0; i < numLideres; i++) {
    const lider = config.lideres[i];
    if (!lider.nome.trim()) continue;
    const gastosLider = p.gastosLideres[i] ?? { gastos: 0, debitosAdicionais: [] };

    const resumo = calcularResumoLider({
      lider,
      percentualDebito: lider.percentualDebito ?? 0,
      totalDevedores,
      gastosLider,
      compraBonificada,
      cartaBolsaValor: p.cartaBolsa.valor,
      cartaBolsaReceptor: p.cartaBolsa.liderReceptor,
    });

    const hist = `Salário Líder ${lider.nome}`;

    // 2.8a – Débito na campanha: valor exato do saldo final (sem recalcular)
    linhas.push({
      conta: "1134002",
      subconta: subCamp,
      departamento: "139811",
      valor: resumo.saldoFinal,
      historico: hist,
    });

    // 2.8b – Crédito do líder: inverso de (saldoFinal + débitos de colportores)
    const subLider = lcMap.get(lider.nome)?.subcontaLider ?? "";
    const valorCredito = arred(resumo.saldoFinal + resumo.debitoColportores);
    linhas.push(mk("2134002", subLider, -valorCredito, hist));
  }

  // 2.8 Salário do caixa (sem débitos de colportores)
  if (caixa.nome.trim()) {
    // Calcula saldo usando mesma lógica dos líderes (bonificação = 0)
    const liderCaixa: LiderAcerto = {
      nome: caixa.nome,
      bonificacaoPercentual: 0,
      auxilioPercentual: caixa.auxilioPercentual,
      percentualDebito: 0,
      possuiVeiculoSPA: false,
    };
    const resumoCaixa = calcularResumoLider({
      lider: liderCaixa,
      percentualDebito: 0,
      totalDevedores: 0,
      gastosLider: p.gastosCaixa,
      compraBonificada,
      cartaBolsaValor: 0,
      cartaBolsaReceptor: "",
    });

    // Inclui salarioCaixa no saldo total (não está no calcularResumoLider)
    const saldoCaixa = arred(resumoCaixa.saldoFinal - (caixa.salarioCaixa ?? 0));

    if (saldoCaixa !== 0) {
      const hist = `Salário Caixa ${caixa.nome}`;
      const subCaixaLucro = p.tipos.find((t) => t.nome === "Lucro")?.subconta ?? "";

      // 2.8a – Débito na campanha
      linhas.push({
        conta: "1134002",
        subconta: subCamp,
        departamento: "139811",
        valor: saldoCaixa,
        historico: hist,
      });

      // 2.8b – Crédito do caixa: inverso do saldoCaixa (debitoColportores = 0)
      linhas.push(mk("2134002", subCaixaLucro, -saldoCaixa, hist));
    }
  }

  // ── Serializa CSV ─────────────────────────────────────────────────────────
  const csvLinhas = ["141113", ...linhas.map(linhaToCsv)];
  return csvLinhas.join("\n");
}
