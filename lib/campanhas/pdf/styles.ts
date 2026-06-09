import { StyleSheet } from "@react-pdf/renderer";

const AZUL = "#1a4f7a";
const AZUL_CLARO = "#e8f0f7";
const CINZA = "#f5f5f5";
const BORDA = "#d0d7de";
const TEXTO = "#1c2128";
const TEXTO_SEC = "#6e7781";
const VERMELHO = "#c0392b";
const VERDE = "#1a7a4f";

export const s = StyleSheet.create({
  // Página
  page: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: TEXTO,
    paddingTop: 30,
    paddingBottom: 50,
    paddingLeft: 40,
    paddingRight: 40,
  },

  // Capa
  capaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  capaBadge: {
    fontSize: 10,
    color: TEXTO_SEC,
    fontFamily: "Helvetica",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  capaTipo: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 6,
  },
  capaCampanha: {
    fontSize: 14,
    color: TEXTO_SEC,
    marginBottom: 4,
  },
  capaData: {
    fontSize: 10,
    color: TEXTO_SEC,
  },

  // Títulos de página/seção
  tituloPagina: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: AZUL,
  },
  secaoTitulo: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 6,
    marginTop: 10,
  },

  // Cabeçalho campanha
  cabGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  cabItem: {
    width: "50%",
    flexDirection: "row",
    marginBottom: 3,
    paddingRight: 8,
  },
  cabRotulo: {
    fontSize: 7.5,
    color: TEXTO_SEC,
    fontFamily: "Helvetica-Bold",
    width: 90,
    flexShrink: 0,
  },
  cabValor: {
    fontSize: 7.5,
    color: TEXTO,
    flex: 1,
  },

  // Tabelas genéricas
  thRow: {
    flexDirection: "row",
    backgroundColor: AZUL,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  thCell: {
    color: "white",
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
  },
  thCellRight: {
    color: "white",
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    textAlign: "right",
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDA,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  trAlt: {
    backgroundColor: CINZA,
  },
  trHeader: {
    flexDirection: "row",
    backgroundColor: AZUL_CLARO,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  td: {
    fontSize: 7.5,
    color: TEXTO,
    flex: 1,
  },
  tdRight: {
    fontSize: 7.5,
    color: TEXTO,
    textAlign: "right",
  },
  tdBold: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: TEXTO,
    flex: 1,
  },
  rodapeTabela: {
    flexDirection: "row",
    backgroundColor: AZUL,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  rodapeTabelaLabel: {
    color: "white",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    flex: 1,
  },
  rodapeTabelaValor: {
    color: "white",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textAlign: "right",
  },

  // Saldo herdado
  saldoBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: AZUL_CLARO,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AZUL,
  },
  saldoLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: AZUL,
  },
  saldoValor: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: AZUL,
  },

  // Card líder (por página, export LÍDERES)
  cardLiderNome: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1.5,
    borderBottomColor: AZUL,
  },

  // Bloco detalhe INSS/IRPF
  detalheBox: {
    marginTop: 6,
    marginBottom: 6,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: AZUL,
  },
  detalheTitulo: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    marginBottom: 3,
  },
  detalheLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
  },
  detalheLabel: {
    fontSize: 7,
    color: TEXTO_SEC,
    flex: 1,
  },
  detalheValor: {
    fontSize: 7,
    color: TEXTO,
    textAlign: "right",
  },
  detalheDestaque: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: TEXTO,
    textAlign: "right",
  },

  // Diferença de caixa
  dcBloco: {
    marginBottom: 8,
  },
  dcLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDA,
  },
  dcSubtotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: CINZA,
    borderTopWidth: 1,
    borderTopColor: BORDA,
  },
  dcLabel: {
    fontSize: 8,
    color: TEXTO,
  },
  dcValor: {
    fontSize: 8,
    textAlign: "right",
  },
  dcSubtotalLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: TEXTO,
  },
  dcSubtotalValor: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  dcResultado: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: AZUL,
    marginTop: 4,
  },
  dcResultadoLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "white",
  },
  dcResultadoValor: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "white",
    textAlign: "right",
  },

  // Separador
  separador: {
    borderTopWidth: 0.5,
    borderTopColor: BORDA,
    marginVertical: 8,
  },

  // Resumo financeiro líder
  rfLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDA,
  },
  rfLabel: {
    fontSize: 7.5,
    color: TEXTO,
  },
  rfValor: {
    fontSize: 7.5,
    textAlign: "right",
  },
  rfSaldo: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: CINZA,
    borderTopWidth: 1,
    borderTopColor: BORDA,
    marginTop: 2,
  },
  rfSaldoLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: TEXTO,
  },
  rfSaldoValor: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },

  // Cores
  negativo: { color: VERMELHO },
  positivo: { color: VERDE },
  muted: { color: TEXTO_SEC },
  bold: { fontFamily: "Helvetica-Bold" },

  // Rodapé fixo da página
  rodapePagina: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
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
});
