import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "../styles";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import type { DadosPDF } from "../types";

export function SecaoCabecalho({ dados }: { dados: DadosPDF }) {
  const { config, dadosImportados } = dados;
  const campanha =
    config.tipoCampanha === "Outro" ? config.tipoCampanhaOutro : config.tipoCampanha;
  const campo = config.campo === "Outro" ? config.campoOutro : config.campo;
  const lideres = config.lideres.filter((l) => l.nome.trim()).map((l) => l.nome);

  const itens: [string, string][] = [
    ["Campanha", campanha || "—"],
    ["Subconta", config.subContaCampanha || "—"],
    ["Departamento", config.departamento || "—"],
    ["Campo", campo || "—"],
    ["Caixa", config.caixa.nome || "—"],
    ["Líderes", lideres.length > 0 ? lideres.join(" · ") : "—"],
    ["Compra Total", dadosImportados ? formatarBRL(dadosImportados.compraTotal) : "—"],
    ["Compra Bonificada", dadosImportados ? formatarBRL(dadosImportados.bonificado) : "—"],
  ];

  return (
    <View style={s.cabGrid}>
      {itens.map(([rotulo, valor]) => (
        <View key={rotulo} style={s.cabItem}>
          <Text style={s.cabRotulo}>{rotulo}</Text>
          <Text style={s.cabValor}>{valor}</Text>
        </View>
      ))}
    </View>
  );
}
