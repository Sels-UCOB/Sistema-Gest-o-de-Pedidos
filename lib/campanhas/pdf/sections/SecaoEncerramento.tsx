import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "../styles";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import type { DadosPDF } from "../types";

export function SecaoEncerramento({ dados }: { dados: DadosPDF }) {
  const { grupoCampanha, totalGeralCampanha, resumosLideres, diferencaCaixa: dc } = dados;

  return (
    <View>
      {/* Resumo da campanha */}
      <Text style={s.secaoTitulo}>Resumo da Campanha</Text>
      <View style={s.thRow}>
        <Text style={[s.thCell, { flex: 3 }]}>Tipo de Lançamento</Text>
        <Text style={[s.thCellRight, { width: 100 }]}>Total</Text>
      </View>
      {grupoCampanha.map((g, idx) => (
        <View key={g.nome} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}>
          <Text style={[s.td, { flex: 3 }]}>{g.nome}</Text>
          <Text style={[s.tdRight, { width: 100 }, g.total < 0 ? s.negativo : {}]}>
            {formatarBRL(g.total)}
          </Text>
        </View>
      ))}
      <View style={s.rodapeTabela}>
        <Text style={[s.rodapeTabelaLabel, { flex: 3 }]}>Total Geral</Text>
        <Text style={[s.rodapeTabelaValor, { width: 100 }]}>
          {formatarBRL(totalGeralCampanha)}
        </Text>
      </View>

      {/* Resumo dos líderes (tabela compacta) */}
      {resumosLideres.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={s.secaoTitulo}>Resumo dos Líderes</Text>
          <View style={s.thRow}>
            <Text style={[s.thCell, { flex: 2 }]}>Líder</Text>
            <Text style={[s.thCellRight, { width: 60 }]}>Bruto</Text>
            <Text style={[s.thCellRight, { width: 55 }]}>Débitos</Text>
            <Text style={[s.thCellRight, { width: 48 }]}>Dízimo</Text>
            <Text style={[s.thCellRight, { width: 48 }]}>INSS</Text>
            <Text style={[s.thCellRight, { width: 48 }]}>IRPF</Text>
            <Text style={[s.thCellRight, { width: 52 }]}>Carta</Text>
            <Text style={[s.thCellRight, { width: 62 }]}>Saldo Final</Text>
          </View>
          {resumosLideres.map((r, idx) => (
            <View key={r.nome} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}>
              <Text style={[s.td, { flex: 2 }]}>{r.nome}</Text>
              <Text style={[s.tdRight, { width: 60 }]}>{formatarBRL(r.totalBruto)}</Text>
              <Text style={[s.tdRight, { width: 55 }, s.negativo]}>
                {r.totalDebitos > 0 ? `−${formatarBRL(r.totalDebitos)}` : "—"}
              </Text>
              <Text style={[s.tdRight, { width: 48 }, s.negativo]}>
                −{formatarBRL(r.dizimo)}
              </Text>
              <Text style={[s.tdRight, { width: 48 }, s.negativo]}>
                −{formatarBRL(r.inss)}
              </Text>
              <Text style={[s.tdRight, { width: 48 }, s.negativo]}>
                {r.irpf > 0 ? `−${formatarBRL(r.irpf)}` : "—"}
              </Text>
              <Text style={[s.tdRight, { width: 52 }, r.carta > 0 ? s.negativo : {}]}>
                {r.carta > 0 ? `−${formatarBRL(r.carta)}` : "—"}
              </Text>
              <Text
                style={[
                  s.tdRight,
                  s.bold,
                  { width: 62 },
                  r.saldoFinal < 0 ? s.negativo : s.positivo,
                ]}
              >
                {formatarBRL(r.saldoFinal)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Diferença de Caixa */}
      <View style={{ marginTop: 12 }}>
        <Text style={s.secaoTitulo}>Diferença de Caixa</Text>

        {/* Bloco débitos */}
        <View style={s.dcBloco}>
          <View style={s.dcLinha}>
            <Text style={s.dcLabel}>Total débitos líderes</Text>
            <Text style={[s.dcValor, dc.totalDebitosLideres > 0 ? s.negativo : s.muted]}>
              {dc.totalDebitosLideres > 0 ? formatarBRL(dc.totalDebitosLideres) : "—"}
            </Text>
          </View>
          <View style={s.dcLinha}>
            <Text style={s.dcLabel}>Total débitos caixa</Text>
            <Text style={[s.dcValor, dc.totalDebitosCaixa > 0 ? s.negativo : s.muted]}>
              {dc.totalDebitosCaixa > 0 ? formatarBRL(dc.totalDebitosCaixa) : "—"}
            </Text>
          </View>
          <View style={s.dcSubtotal}>
            <Text style={s.dcSubtotalLabel}>Total Débitos</Text>
            <Text style={[s.dcSubtotalValor, s.negativo]}>
              {formatarBRL(dc.totalDebitos)}
            </Text>
          </View>
        </View>

        {/* Bloco base */}
        <View style={s.dcBloco}>
          <View style={s.dcLinha}>
            <Text style={s.dcLabel}>Saldo Final (Lançamentos)</Text>
            <Text style={s.dcValor}>{formatarBRL(dc.saldoInicial)}</Text>
          </View>
          {dc.salarioCaixa > 0 && (
            <View style={s.dcLinha}>
              <Text style={s.dcLabel}>Salário Caixa</Text>
              <Text style={[s.dcValor, s.positivo]}>+{formatarBRL(dc.salarioCaixa)}</Text>
            </View>
          )}
          <View style={s.dcLinha}>
            <Text style={s.dcLabel}>2% Bonificação (FPC)</Text>
            <Text style={[s.dcValor, s.negativo]}>−{formatarBRL(dc.fpc)}</Text>
          </View>
          {dc.temJuros && (
            <View style={s.dcLinha}>
              <Text style={s.dcLabel}>Juros Campanha</Text>
              <Text style={[s.dcValor, dc.juros >= 0 ? s.positivo : s.negativo]}>
                {dc.juros >= 0
                  ? `+${formatarBRL(dc.juros)}`
                  : `−${formatarBRL(Math.abs(dc.juros))}`}
              </Text>
            </View>
          )}
          <View style={s.dcSubtotal}>
            <Text style={s.dcSubtotalLabel}>
              Base {dc.temJuros ? "(após Juros Campanha)" : "(após FPC)"}
            </Text>
            <Text style={[s.dcSubtotalValor, s.negativo]}>
              −{formatarBRL(dc.base)}
            </Text>
          </View>
        </View>

        {/* Resultado */}
        <View style={s.dcResultado}>
          <Text style={s.dcResultadoLabel}>Diferença de Caixa</Text>
          <Text style={s.dcResultadoValor}>{formatarBRL(dc.diferenca)}</Text>
        </View>
      </View>
    </View>
  );
}
