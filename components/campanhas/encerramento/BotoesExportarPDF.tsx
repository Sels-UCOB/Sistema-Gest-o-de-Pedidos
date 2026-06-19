"use client";

import React, { useState, useCallback } from "react";
import { Download } from "lucide-react";
import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { useAcertosManagerOptional } from "@/lib/campanhas/context/AcertosManagerContext";
import { useLancamento } from "@/lib/campanhas/context/LancamentoContext";
import { useLancamentoLider } from "@/lib/campanhas/context/LancamentoLiderContext";
import { useDebitos } from "@/lib/campanhas/context/DebitosContext";
import { useConfiguracao } from "@/lib/campanhas/context/ConfiguracaoContext";
import { calcularSaldos } from "@/lib/campanhas/calcularSaldos";
import { gerarLinhasLider } from "@/lib/campanhas/gerarLinhasLider";
import { calcularResumoLider, calcularTotalDevedores } from "@/lib/campanhas/calcularDebitos";
import { FPC_PERCENTUAL } from "@/lib/campanhas/config/impostos";
import { pdf } from "@react-pdf/renderer";
import { DocumentoPDF } from "@/lib/campanhas/pdf/DocumentoPDF";
import type { TipoExportacao, DadosPDF, DiferencaCaixaCalc, GrupoCampanha } from "@/lib/campanhas/pdf/types";

function arred(n: number) { return Math.round(n * 100) / 100; }

export function BotoesExportarPDF() {
  const { state } = useAcerto();
  const { lancamentos } = useLancamento();
  const { cartaBolsa, jurosCampanha } = useLancamentoLider();
  const { devedores, gastosLideres, gastosCaixa } = useDebitos();
  const { tipos } = useConfiguracao();

  const manager = useAcertosManagerOptional();
  const [carregando, setCarregando] = useState<TipoExportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const montarDados = useCallback((tipo: TipoExportacao): DadosPDF => {
    const { config, dadosImportados } = state;
    const compraBonificada = dadosImportados?.bonificado ?? 0;
    const numLideres = config.numLideres ?? 1;
    const salarioCaixa = config.caixa.salarioCaixa ?? 0;

    const saldosLanc = calcularSaldos(lancamentos);
    const saldoInicialLider = saldosLanc.length > 0 ? saldosLanc[saldosLanc.length - 1] : 0;

    const configs = config.lideres.filter((l) => l.nome.trim()).map((l) => ({ nome: l.nome, bonificacaoPercentual: l.bonificacaoPercentual, auxilioPercentual: l.auxilioPercentual }));
    const caixaConfig = config.caixa.nome.trim() ? { nome: config.caixa.nome, auxilioPercentual: config.caixa.auxilioPercentual } : null;
    const linhasLider = gerarLinhasLider({ configs, cartaBolsa, compraBonificada, jurosCampanha, salarioCaixa: config.caixa.salarioCaixa, caixaConfig });

    const totalDevedores = calcularTotalDevedores(devedores);
    const lideres = Array.from({ length: numLideres }, (_, i) => config.lideres[i]).filter((l): l is (typeof config.lideres)[number] => !!l?.nome?.trim());
    const resumosLideres = lideres.map((lider, idx) => calcularResumoLider({ lider, percentualDebito: lider.percentualDebito ?? 0, totalDevedores, gastosLider: gastosLideres[idx], compraBonificada, cartaBolsaValor: cartaBolsa.valor, cartaBolsaReceptor: cartaBolsa.liderReceptor }));

    const mapa = new Map<string, number>();
    for (const l of lancamentos) {
      if (!l.tipoLancamentoId || l.valor === null) continue;
      mapa.set(l.tipoLancamentoId, (mapa.get(l.tipoLancamentoId) ?? 0) + l.valor);
    }
    const grupoCampanha: GrupoCampanha[] = Array.from(mapa.entries()).map(([id, total]) => ({ nome: tipos.find((t) => t.id === id)?.nome ?? id, total }));
    const totalGeralCampanha = grupoCampanha.reduce((s, g) => s + g.total, 0);

    const fpc = arred(compraBonificada * FPC_PERCENTUAL);
    const juros = jurosCampanha ?? 0;
    const base = arred(saldoInicialLider + salarioCaixa - fpc + juros);
    const totalDebitosLideres = arred(resumosLideres.reduce((s, r) => s + r.totalDebitos, 0));
    const totalDebitosCaixa = arred(gastosCaixa.gastos + gastosCaixa.debitosAdicionais.reduce((s, d) => s + d.valor, 0));
    const totalDebitos = arred(totalDebitosLideres + totalDebitosCaixa);

    const diferencaCaixa: DiferencaCaixaCalc = { saldoInicial: saldoInicialLider, salarioCaixa, fpc, juros, base, totalDebitosLideres, totalDebitosCaixa, totalDebitos, diferenca: arred(totalDebitos - base), temJuros: jurosCampanha !== null };

    return { tipo, config, dadosImportados, lancamentos, tipos, linhasLider, saldoInicialLider, devedores, gastosLideres, gastosCaixa, cartaBolsa, jurosCampanha, resumosLideres, grupoCampanha, totalGeralCampanha, diferencaCaixa };
  }, [state, lancamentos, cartaBolsa, jurosCampanha, devedores, gastosLideres, gastosCaixa, tipos]);

  const handleExportar = useCallback(async (tipo: TipoExportacao) => {
    setCarregando(tipo);
    setErro(null);
    try {
      const dados: DadosPDF = { ...montarDados(tipo), acertoNome: manager?.activeAcerto?.nome ?? "" };
      const blob = await pdf(<DocumentoPDF dados={dados} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const campanha = dados.config.tipoCampanha === "Outro" ? dados.config.tipoCampanhaOutro : dados.config.tipoCampanha;
      a.href = url;
      const nomeArquivo = (dados.acertoNome || campanha || "campanha")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9\s-]/gi, "").replace(/\s+/g, "-").toLowerCase();
      a.download = `acerto-${tipo.toLowerCase()}-${nomeArquivo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro("Erro ao gerar PDF. Tente novamente.");
      console.error(e);
    } finally {
      setCarregando(null);
    }
  }, [montarDados, manager]);

  const botoes: { tipo: TipoExportacao; label: string; title: string }[] = [
    { tipo: "SELS",    label: "Exportar SELS",    title: "Lançamentos + Líderes + Encerramento" },
    { tipo: "LIDERES", label: "Exportar Líderes", title: "Aba Líderes completa — 1 página por líder" },
    { tipo: "CAMPO",   label: "Exportar Campo",   title: "FPC Campo + Líderes + Encerramento" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {botoes.map(({ tipo, label, title }) => (
        <button
          key={tipo}
          type="button"
          title={title}
          disabled={carregando !== null}
          onClick={() => handleExportar(tipo)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {carregando === tipo ? (
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          {carregando === tipo ? "Gerando..." : label}
        </button>
      ))}
      {erro && <p className="text-sm text-red-400">{erro}</p>}
    </div>
  );
}
