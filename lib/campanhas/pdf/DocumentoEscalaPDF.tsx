import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { PreviewSheet } from "@/lib/campanhas/types/anexo";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: "#1c2128",
    paddingTop: 28,
    paddingBottom: 44,
    paddingHorizontal: 30,
  },
  titulo: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1a4f7a",
    marginBottom: 2,
  },
  subtitulo: {
    fontSize: 8,
    color: "#6e7781",
    marginBottom: 10,
  },
  theadRow: {
    flexDirection: "row",
    backgroundColor: "#1a4f7a",
  },
  theadCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
    borderRightColor: "#0f3157",
  },
  theadText: {
    color: "#ffffff",
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
  },
  tbodyRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#d0d7de",
  },
  tbodyCell: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
    borderRightColor: "#d0d7de",
  },
  tbodyCellAlt: {
    backgroundColor: "#f5f5f5",
  },
  tbodyText: {
    fontSize: 7,
    color: "#1c2128",
  },
  rodape: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rodapeTexto: {
    fontSize: 7,
    color: "#6e7781",
  },
});

interface Props {
  nomeAnexo: string;
  sheets: PreviewSheet[];
}

export function DocumentoEscalaPDF({ nomeAnexo, sheets }: Props) {
  const dataGeracao = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Document>
      {sheets.map((sheet, si) => (
        <Page key={si} style={s.page} orientation="landscape" size="A4">
          <View style={{ marginBottom: 10 }}>
            <Text style={s.titulo}>{nomeAnexo}</Text>
            <Text style={s.subtitulo}>
              {sheets.length > 1 ? `Aba: ${sheet.sheetName} · ` : ""}
              {sheet.rows.length} linha{sheet.rows.length !== 1 ? "s" : ""} · Gerado em {dataGeracao}
            </Text>
          </View>

          {sheet.headers.length === 0 ? (
            <Text style={{ fontSize: 8, color: "#6e7781" }}>Aba sem dados.</Text>
          ) : (
            <View>
              <View style={s.theadRow}>
                {sheet.headers.map((h, hi) => (
                  <View key={hi} style={s.theadCell}>
                    <Text style={s.theadText}>{h}</Text>
                  </View>
                ))}
              </View>
              {sheet.rows.map((row, ri) => (
                <View
                  key={ri}
                  style={[s.tbodyRow, ...(ri % 2 !== 0 ? [s.tbodyCellAlt] : [])]}
                >
                  {sheet.headers.map((h, hi) => (
                    <View
                      key={hi}
                      style={[s.tbodyCell, ...(ri % 2 !== 0 ? [s.tbodyCellAlt] : [])]}
                    >
                      <Text style={s.tbodyText}>
                        {row[h] == null ? "" : String(row[h])}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          <View style={s.rodape} fixed>
            <Text style={s.rodapeTexto}>Sistema SELS — Escalas</Text>
            <Text
              style={s.rodapeTexto}
              render={({ pageNumber, totalPages }) =>
                `Página ${pageNumber} de ${totalPages}`
              }
            />
          </View>
        </Page>
      ))}
    </Document>
  );
}
