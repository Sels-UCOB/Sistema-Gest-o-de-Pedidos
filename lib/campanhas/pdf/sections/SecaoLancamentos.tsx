import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "../styles";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import { calcularSaldos } from "@/lib/campanhas/calcularSaldos";
import type { DadosPDF } from "../types";

interface Props {
  dados: DadosPDF;
  somenteFpcCampo?: boolean;
  ocultarSaldoInicial?: boolean;
  ocultarColunaSaldo?: boolean;
}

export function SecaoLancamentos({
  dados,
  somenteFpcCampo = false,
  ocultarSaldoInicial = false,
  ocultarColunaSaldo = false,
}: Props) {
  const { lancamentos, tipos } = dados;
  const saldosTodos = calcularSaldos(lancamentos);

  const fpcCampoId = somenteFpcCampo
    ? tipos.find((t) => t.nome === "FPC Campo")?.id
    : undefined;

  const indicesVisiveis = lancamentos.reduce<number[]>((acc, l, i) => {
    if (i === 0 && ocultarSaldoInicial) return acc;
    if (i === 0 || !somenteFpcCampo || l.tipoLancamentoId === fpcCampoId) {
      acc.push(i);
    }
    return acc;
  }, []);

  const subtotalFpcCampo = somenteFpcCampo
    ? indicesVisiveis
        .filter((i) => i !== 0)
        .reduce((acc, i) => acc + (lancamentos[i].valor ?? 0), 0)
    : 0;

  const getNomeTipo = (id: string) => tipos.find((t) => t.id === id)?.nome ?? "—";

  const dcWidth = ocultarColunaSaldo ? 90 : 75;

  return (
    <View>
      <Text style={s.secaoTitulo}>
        {somenteFpcCampo ? "Lançamentos — FPC Campo" : "Lançamentos"}
      </Text>

      <View style={s.thRow}>
        <Text style={[s.thCell, { width: 22 }]}>#</Text>
        <Text style={[s.thCell, { flex: 2 }]}>Tipo</Text>
        <Text style={[s.thCell, { flex: 3 }]}>Histórico</Text>
        <Text style={[s.thCellRight, { width: dcWidth }]}>
          {somenteFpcCampo && ocultarColunaSaldo ? "Valor" : "D/C"}
        </Text>
        {!ocultarColunaSaldo && (
          <Text style={[s.thCellRight, { width: 75 }]}>Saldo</Text>
        )}
      </View>

      {indicesVisiveis.map((idx, posicao) => {
        const lanc = lancamentos[idx];
        const saldo = saldosTodos[idx] ?? 0;
        const isPrimeira = idx === 0;
        const isAlt = posicao % 2 === 1;

        return (
          <View key={lanc.id} style={[s.tr, isAlt ? s.trAlt : {}]}>
            <Text style={[s.td, { width: 22 }]}>{posicao + 1}</Text>
            {isPrimeira ? (
              <Text style={[s.td, { flex: 5 }]}>Saldo Inicial</Text>
            ) : (
              <>
                <Text style={[s.td, { flex: 2 }]}>{getNomeTipo(lanc.tipoLancamentoId)}</Text>
                <Text style={[s.td, { flex: 3 }]}>{lanc.historico || "—"}</Text>
              </>
            )}
            <Text
              style={[
                s.tdRight,
                { width: dcWidth },
                !isPrimeira && lanc.valor !== null && lanc.valor < 0 ? s.negativo : {},
              ]}
            >
              {isPrimeira ? "—" : lanc.valor !== null ? formatarBRL(lanc.valor) : "—"}
            </Text>
            {!ocultarColunaSaldo && (
              <Text style={[s.tdRight, { width: 75 }, saldo < 0 ? s.negativo : {}]}>
                {formatarBRL(saldo)}
              </Text>
            )}
          </View>
        );
      })}

      <View style={s.rodapeTabela}>
        {somenteFpcCampo ? (
          <>
            <Text style={[s.rodapeTabelaLabel, { flex: ocultarColunaSaldo ? 7 : 6 }]}>
              Subtotal FPC Campo
            </Text>
            <Text style={[s.rodapeTabelaValor, { width: dcWidth }]}>
              {formatarBRL(subtotalFpcCampo)}
            </Text>
            {!ocultarColunaSaldo && (
              <Text style={[s.rodapeTabelaValor, { width: 75 }]}> </Text>
            )}
          </>
        ) : (
          <>
            <Text style={[s.rodapeTabelaLabel, { flex: 6 }]}>Saldo final</Text>
            <Text style={[s.rodapeTabelaValor, { width: dcWidth }]}> </Text>
            {!ocultarColunaSaldo && (
              <Text style={[s.rodapeTabelaValor, { width: 75 }]}>
                {formatarBRL(saldosTodos[saldosTodos.length - 1] ?? 0)}
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}
