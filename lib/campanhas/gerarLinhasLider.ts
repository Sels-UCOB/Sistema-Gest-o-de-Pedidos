import type { ConfigLider, CartaBolsa, LinhaTabela } from "@/lib/campanhas/types/lancamentoLider";
import { calcularINSSDetalhe, calcularIRPFDetalhe } from "@/lib/campanhas/calcularImpostos";
import { DIZIMO_PERCENTUAL, FPC_PERCENTUAL } from "@/lib/campanhas/config/impostos";

function arred(n: number): number {
  return Math.round(n * 100) / 100;
}

const mk = (tipo: string, lider: string | null) =>
  `${tipo}-${lider ?? "global"}`;

interface Params {
  configs: ConfigLider[];
  cartaBolsa: CartaBolsa;
  compraBonificada: number;
  jurosCampanha: number | null;
  salarioCaixa: number | null;
  caixaConfig: { nome: string; auxilioPercentual: number } | null;
}

export function gerarLinhasLider({
  configs,
  cartaBolsa,
  compraBonificada,
  jurosCampanha,
  salarioCaixa,
  caixaConfig,
}: Params): LinhaTabela[] {
  const linhas: LinhaTabela[] = [];

  // Lançamentos de campanha aparecem antes das seções por líder
  const fpc = arred(compraBonificada * FPC_PERCENTUAL);
  linhas.push({
    id: mk("fpc", null),
    tipo: "fpc",
    liderNome: null,
    descricao: "2% Bonificação (FPC)",
    valor: -fpc,
    excluirDoSaldo: false,
    clicavel: false,
  });

  if (jurosCampanha !== null) {
    linhas.push({
      id: mk("juros", null),
      tipo: "jurosCampanha",
      liderNome: null,
      descricao: "Juros Campanha",
      valor: jurosCampanha,
      excluirDoSaldo: false,
      clicavel: false,
    });
  }

  for (const config of configs) {
    if (!config.nome) continue;

    const carta =
      cartaBolsa.liderReceptor === config.nome ? cartaBolsa.valor : 0;

    const bonificacao = arred(
      (config.bonificacaoPercentual / 100) * compraBonificada
    );
    const auxilio = arred(
      (config.auxilioPercentual / 100) * compraBonificada
    );
    const dizimo = arred(bonificacao * DIZIMO_PERCENTUAL);
    const inssDetalhe = calcularINSSDetalhe(bonificacao, carta);
    const irpfDetalhe = calcularIRPFDetalhe(bonificacao, carta);

    linhas.push({
      id: mk("header", config.nome),
      tipo: "header",
      liderNome: config.nome,
      descricao: config.nome,
      valor: 0,
      excluirDoSaldo: true,
      clicavel: false,
    });

    linhas.push({
      id: mk("bonificacao", config.nome),
      tipo: "bonificacao",
      liderNome: config.nome,
      descricao: `Bonificação – ${config.nome}`,
      valor: -bonificacao,
      excluirDoSaldo: false,
      clicavel: false,
    });

    linhas.push({
      id: mk("auxilio", config.nome),
      tipo: "auxilio",
      liderNome: config.nome,
      descricao: `Auxílio – ${config.nome}`,
      valor: -auxilio,
      excluirDoSaldo: false,
      clicavel: false,
    });

    linhas.push({
      id: mk("dizimo", config.nome),
      tipo: "dizimo",
      liderNome: config.nome,
      descricao: `Dízimo – ${config.nome}`,
      valor: dizimo,
      excluirDoSaldo: false,
      clicavel: false,
    });

    if (carta > 0) {
      linhas.push({
        id: mk("cartaBolsa", config.nome),
        tipo: "cartaBolsa",
        liderNome: config.nome,
        descricao: `Carta de Bolsa – ${config.nome}`,
        valor: carta,
        excluirDoSaldo: false,
        clicavel: false,
      });
    }

    linhas.push({
      id: mk("inss", config.nome),
      tipo: "inss",
      liderNome: config.nome,
      descricao: `INSS – ${config.nome}`,
      valor: inssDetalhe.valor,
      excluirDoSaldo: false,
      clicavel: true,
      detalheINSS: inssDetalhe,
    });

    linhas.push({
      id: mk("irpf", config.nome),
      tipo: "irpf",
      liderNome: config.nome,
      descricao: `IRPF – ${config.nome}`,
      valor: irpfDetalhe.irpfTotal,
      excluirDoSaldo: false,
      clicavel: true,
      detalheIRPF: irpfDetalhe,
    });
  }

  const temItensCaixa =
    (caixaConfig && caixaConfig.nome.trim() && caixaConfig.auxilioPercentual > 0) ||
    salarioCaixa !== null;

  if (temItensCaixa) {
    const nomeCaixa = caixaConfig?.nome.trim() || "Caixa";
    linhas.push({
      id: mk("header", "caixa"),
      tipo: "header",
      liderNome: null,
      descricao: nomeCaixa,
      valor: 0,
      excluirDoSaldo: true,
      clicavel: false,
    });
  }

  if (caixaConfig && caixaConfig.nome.trim() && caixaConfig.auxilioPercentual > 0) {
    const auxilioCaixa = arred((caixaConfig.auxilioPercentual / 100) * compraBonificada);
    linhas.push({
      id: mk("auxilio", "caixa"),
      tipo: "auxilio",
      liderNome: null,
      descricao: `Auxílio – ${caixaConfig.nome}`,
      valor: -auxilioCaixa,
      excluirDoSaldo: false,
      clicavel: false,
    });
  }

  if (salarioCaixa !== null) {
    linhas.push({
      id: mk("salarioCaixa", null),
      tipo: "salarioCaixa",
      liderNome: null,
      descricao: "Salário Caixa",
      valor: -salarioCaixa,
      excluirDoSaldo: true,
      clicavel: false,
    });
  }

  return linhas;
}
