import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { BolsaGlobalItem } from "@/lib/campanhas/types/bolsa";

const AZUL = "#1a4f7a";
const BORDA = "#d0d7de";
const CINZA = "#f5f5f5";
const TEXTO = "#1c2128";
const TEXTO_SEC = "#6e7781";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: TEXTO,
    paddingTop: 30,
    paddingBottom: 44,
    paddingHorizontal: 36,
  },
  titulo: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 2,
  },
  subtitulo: {
    fontSize: 8,
    color: TEXTO_SEC,
    marginBottom: 12,
  },
  theadRow: {
    flexDirection: "row",
    backgroundColor: AZUL,
  },
  theadCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 5,
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
    borderBottomColor: BORDA,
  },
  tbodyRowAlt: {
    backgroundColor: CINZA,
  },
  tbodyCell: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRightWidth: 0.5,
    borderRightColor: BORDA,
  },
  tbodyText: {
    fontSize: 7.5,
    color: TEXTO,
  },
  tbodyTextBold: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: TEXTO,
  },
  rodape: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: BORDA,
    paddingTop: 4,
  },
  rodapeTexto: {
    fontSize: 7,
    color: TEXTO_SEC,
  },
  emptyBox: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 9,
    color: TEXTO_SEC,
  },
});

interface Props {
  tipoCampanha: string;
  ano: number;
  bolsas: BolsaGlobalItem[];
  extraHeaders: string[];
}

export function DocumentoBolsasGlobalPDF({ tipoCampanha, ano, bolsas, extraHeaders }: Props) {
  const dataGeracao = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const titulo = `Bolsas - ${tipoCampanha} - ${ano}`;

  const visibleCols = extraHeaders
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.trim() !== "");

  return (
    <Document>
      <Page style={s.page} orientation="landscape" size="A4">
        {/* Cabeçalho */}
        <View style={{ marginBottom: 12 }}>
          <Text style={s.titulo}>{titulo}</Text>
          <Text style={s.subtitulo}>
            {bolsas.length} colportor{bolsas.length !== 1 ? "es" : ""} · Gerado em {dataGeracao}
          </Text>
        </View>

        {bolsas.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>Nenhuma bolsa encontrada.</Text>
          </View>
        ) : (
          <View>
            {/* Cabeçalho da tabela */}
            <View style={s.theadRow}>
              <View style={[s.theadCell, { flex: 2 }]}>
                <Text style={s.theadText}>COLPORTOR</Text>
              </View>
              {visibleCols.map(({ header, index }) => (
                <View key={index} style={s.theadCell}>
                  <Text style={s.theadText}>{header.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            {/* Linhas */}
            {bolsas.map((bolsa, ri) => (
              <View
                key={bolsa.id}
                style={[s.tbodyRow, ri % 2 === 1 ? s.tbodyRowAlt : {}]}
              >
                <View style={[s.tbodyCell, { flex: 2 }]}>
                  <Text style={s.tbodyTextBold}>{bolsa.nome}</Text>
                </View>
                {visibleCols.map(({ index }) => (
                  <View key={index} style={s.tbodyCell}>
                    <Text style={s.tbodyText}>
                      {bolsa.dados?.colunas?.[index] ?? "—"}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Rodapé fixo */}
        <View style={s.rodape} fixed>
          <Text style={s.rodapeTexto}>Sistema SELS — {titulo}</Text>
          <Text
            style={s.rodapeTexto}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
