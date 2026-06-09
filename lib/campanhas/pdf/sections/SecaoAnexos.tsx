import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "../styles";
import type { Anexo } from "../types";

interface Props {
  anexos?: Anexo[];
}

export function SecaoAnexos({ anexos }: Props) {
  if (!anexos || anexos.length === 0) return null;

  return (
    <View>
      <Text style={s.secaoTitulo}>Anexos da Campanha</Text>

      <View style={s.thRow}>
        <Text style={[s.thCell, { flex: 3 }]}>Nome</Text>
        <Text style={[s.thCell, { width: 60 }]}>Tipo</Text>
        <Text style={[s.thCell, { width: 80 }]}>Data</Text>
      </View>

      {anexos.map((a, idx) => (
        <View key={idx} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}>
          <Text style={[s.td, { flex: 3 }]}>{a.nome}</Text>
          <Text style={[s.td, { width: 60 }]}>{a.tipo}</Text>
          <Text style={[s.td, { width: 80 }]}>{a.data}</Text>
        </View>
      ))}
    </View>
  );
}

export function renderAnexosSection(anexos?: Anexo[]) {
  return <SecaoAnexos anexos={anexos} />;
}
