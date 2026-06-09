import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { s } from "./styles";
import { SecaoCabecalho } from "./sections/SecaoCabecalho";
import { SecaoLancamentos } from "./sections/SecaoLancamentos";
import { SecaoAbaLideres } from "./sections/SecaoAbaLideres";
import { SecaoResumoLideres, CardLiderDetalhado } from "./sections/SecaoResumoLideres";
import { SecaoEncerramento } from "./sections/SecaoEncerramento";
import { SecaoAnexos } from "./sections/SecaoAnexos";
import type { DadosPDF, TipoExportacao } from "./types";

const LABEL: Record<TipoExportacao, string> = {
  SELS: "Exportar SELS",
  LIDERES: "Exportar Líderes",
  CAMPO: "Exportar Campo",
};

function RodapePDF() {
  return (
    <View style={s.rodapePagina} fixed>
      <Text style={s.rodapeTexto}>Sistema SELS — Acerto de Campanhas</Text>
      <Text
        style={s.rodapeTexto}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  );
}

function Capa({ tipo, campanha, data }: { tipo: TipoExportacao; campanha: string; data: string }) {
  return (
    <View style={s.capaContainer}>
      <Text style={s.capaBadge}>Acerto de Campanha</Text>
      <Text style={s.capaTipo}>{LABEL[tipo]}</Text>
      <Text style={s.capaCampanha}>{campanha || "Campanha não informada"}</Text>
      <Text style={s.capaData}>Gerado em {data}</Text>
    </View>
  );
}

export function DocumentoPDF({ dados }: { dados: DadosPDF }) {
  const { tipo, config } = dados;
  const campanha =
    config.tipoCampanha === "Outro" ? config.tipoCampanhaOutro : config.tipoCampanha;
  const data = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Document
      title={`${LABEL[tipo]} — ${campanha}`}
      author="Sistema SELS"
      subject="Acerto de Campanha"
    >
      {/* ─── CAPA ─── */}
      <Page size="A4" style={s.page}>
        <Capa tipo={tipo} campanha={campanha} data={data} />
        <RodapePDF />
      </Page>

      {/* ════════════════════════════════════════
          SELS: Lançamentos + Líderes + Encerramento
          ════════════════════════════════════════ */}
      {tipo === "SELS" && (
        <>
          {/* Lançamentos */}
          <Page size="A4" style={s.page}>
            <Text style={s.tituloPagina}>Lançamentos</Text>
            <SecaoCabecalho dados={dados} />
            <SecaoLancamentos dados={dados} />
            <RodapePDF />
          </Page>

          {/* Aba Líderes */}
          <Page size="A4" style={s.page}>
            <Text style={s.tituloPagina}>Aba Líderes</Text>
            <SecaoAbaLideres dados={dados} mostrarIRPFDetalhe />
            <SecaoAnexos anexos={dados.anexos} />
            <RodapePDF />
          </Page>

          {/* Resumo dos Líderes */}
          <Page size="A4" style={s.page}>
            <Text style={s.tituloPagina}>Resumo dos Líderes</Text>
            <SecaoResumoLideres dados={dados} expandirDevedores />
            <RodapePDF />
          </Page>

          {/* Encerramento */}
          <Page size="A4" style={s.page}>
            <Text style={s.tituloPagina}>Encerramento</Text>
            <SecaoEncerramento dados={dados} />
            <RodapePDF />
          </Page>
        </>
      )}

      {/* ════════════════════════════════════════
          LÍDERES: Aba completa + 1 página por líder
          ════════════════════════════════════════ */}
      {tipo === "LIDERES" && (
        <>
          {/* Cabeçalho + Aba Líderes */}
          <Page size="A4" style={s.page}>
            <Text style={s.tituloPagina}>Aba Líderes</Text>
            <SecaoCabecalho dados={dados} />
            <SecaoAbaLideres dados={dados} mostrarIRPFDetalhe={false} />
            <RodapePDF />
          </Page>

          {/* Uma página por líder */}
          {dados.resumosLideres.map((resumo, idx) => {
            const lider = dados.config.lideres[idx];
            if (!lider) return null;
            return (
              <Page key={resumo.nome} size="A4" style={s.page}>
                <CardLiderDetalhado
                  resumo={resumo}
                  lider={lider}
                  devedores={dados.devedores}
                  mostrarImpostos
                />
                <RodapePDF />
              </Page>
            );
          })}

          {/* Anexos (futuro) */}
          {dados.anexos && dados.anexos.length > 0 && (
            <Page size="A4" style={s.page}>
              <Text style={s.tituloPagina}>Anexos</Text>
              <SecaoAnexos anexos={dados.anexos} />
              <RodapePDF />
            </Page>
          )}
        </>
      )}

      {/* ════════════════════════════════════════
          CAMPO: FPC Campo + Líderes + Encerramento
          ════════════════════════════════════════ */}
      {tipo === "CAMPO" && (
        <>
          {/* FPC Campo */}
          <Page size="A4" style={s.page}>
            <Text style={s.tituloPagina}>Lançamentos — FPC Campo</Text>
            <SecaoCabecalho dados={dados} />
            <SecaoLancamentos dados={dados} somenteFpcCampo />
            <RodapePDF />
          </Page>

          {/* Aba Líderes */}
          <Page size="A4" style={s.page}>
            <Text style={s.tituloPagina}>Aba Líderes</Text>
            <SecaoAbaLideres dados={dados} mostrarIRPFDetalhe />
            <RodapePDF />
          </Page>

          {/* Resumo dos Líderes */}
          <Page size="A4" style={s.page}>
            <Text style={s.tituloPagina}>Resumo dos Líderes</Text>
            <SecaoResumoLideres dados={dados} expandirDevedores />
            <RodapePDF />
          </Page>

          {/* Encerramento */}
          <Page size="A4" style={s.page}>
            <Text style={s.tituloPagina}>Encerramento</Text>
            <SecaoEncerramento dados={dados} />
            <RodapePDF />
          </Page>

          {/* Anexos (futuro) */}
          {dados.anexos && dados.anexos.length > 0 && (
            <Page size="A4" style={s.page}>
              <Text style={s.tituloPagina}>Anexos</Text>
              <SecaoAnexos anexos={dados.anexos} />
              <RodapePDF />
            </Page>
          )}
        </>
      )}
    </Document>
  );
}
