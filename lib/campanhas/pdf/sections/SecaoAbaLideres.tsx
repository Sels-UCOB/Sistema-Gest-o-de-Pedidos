import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "../styles";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import { calcularSaldosLider } from "@/lib/campanhas/calcularSaldosLider";
import type { DadosPDF } from "../types";
import type { DetalheINSS, DetalheIRPF } from "@/lib/campanhas/types/lancamentoLider";

interface Props {
  dados: DadosPDF;
  mostrarIRPFDetalhe?: boolean;
}

function fmtDC(valor: number): string {
  if (valor === 0) return "—";
  return valor > 0 ? `+${formatarBRL(valor)}` : `-${formatarBRL(Math.abs(valor))}`;
}

function BlocoINSS({ d }: { d: DetalheINSS }) {
  return (
    <View style={s.detalheBox}>
      <Text style={s.detalheTitulo}>Cálculo INSS</Text>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Bonificação</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.bonificacao)}</Text>
      </View>
      {d.carta > 0 && (
        <View style={s.detalheLinha}>
          <Text style={s.detalheLabel}>− Carta de Bolsa</Text>
          <Text style={s.detalheValor}>{formatarBRL(d.carta)}</Text>
        </View>
      )}
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Base INSS</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.base)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Alíquota ({(d.percentual * 100).toFixed(0)}%)</Text>
        <Text style={[s.detalheValor, s.negativo]}>{formatarBRL(d.valor)}</Text>
      </View>
    </View>
  );
}

function BlocoIRPF({ d }: { d: DetalheIRPF }) {
  const etapaLabel =
    d.etapa2 === "isencao"
      ? "Isenção (renda ≤ R$ 5.000)"
      : d.etapa2 === "desconto"
      ? "Desconto progressivo"
      : "Integral";

  return (
    <View style={s.detalheBox}>
      <Text style={s.detalheTitulo}>Cálculo IRPF</Text>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Bonificação</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.bonificacao)}</Text>
      </View>
      {d.carta > 0 && (
        <View style={s.detalheLinha}>
          <Text style={s.detalheLabel}>− Carta de Bolsa</Text>
          <Text style={s.detalheValor}>{formatarBRL(d.carta)}</Text>
        </View>
      )}
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Base ajustada</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.baseAjustada)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Renda mensal (÷6)</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.rendaMensal)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>20% INSS p/ IRPF</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.inssDeducao)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Base mensal tributável</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.baseMensal)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>
          Faixa: {(d.faixaAliquota * 100).toFixed(1)}% − Ded. {formatarBRL(d.faixaDeducao)}
        </Text>
        <Text style={s.detalheValor}>{formatarBRL(d.impostoBase)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Etapa 2: {etapaLabel}</Text>
        <Text style={s.detalheValor}> </Text>
      </View>
      {d.etapa2 === "desconto" && (
        <View style={s.detalheLinha}>
          <Text style={s.detalheLabel}>Desconto</Text>
          <Text style={[s.detalheValor, s.positivo]}>−{formatarBRL(d.desconto)}</Text>
        </View>
      )}
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>IRPF mensal</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.irpfMensal)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={[s.detalheLabel, s.bold]}>IRPF total (×6)</Text>
        <Text style={[s.detalheValor, s.bold, s.negativo]}>{formatarBRL(d.irpfTotal)}</Text>
      </View>
    </View>
  );
}

export function SecaoAbaLideres({ dados, mostrarIRPFDetalhe = false }: Props) {
  const { linhasLider, saldoInicialLider, devedores } = dados;
  const saldos = calcularSaldosLider(linhasLider, saldoInicialLider);
  const saldoFinal = saldos.length > 0 ? saldos[saldos.length - 1] : saldoInicialLider;

  return (
    <View>
      {/* Saldo herdado */}
      <View style={s.saldoBox}>
        <Text style={s.saldoLabel}>Saldo Herdado da Campanha</Text>
        <Text style={[s.saldoValor, saldoInicialLider < 0 ? s.negativo : {}]}>
          {formatarBRL(saldoInicialLider)}
        </Text>
      </View>

      {/* Tabela de lançamentos de líderes */}
      <Text style={s.secaoTitulo}>Lançamentos dos Líderes</Text>
      <View style={s.thRow}>
        <Text style={[s.thCell, { flex: 4 }]}>Descrição</Text>
        <Text style={[s.thCellRight, { width: 85 }]}>D/C</Text>
        <Text style={[s.thCellRight, { width: 85 }]}>Saldo</Text>
      </View>

      {linhasLider.map((linha, idx) => {
        const saldo = saldos[idx] ?? saldoInicialLider;
        const isAlt = idx % 2 === 1;

        if (linha.tipo === "header") {
          return (
            <View key={linha.id} style={s.trHeader}>
              <Text style={[s.tdBold, { flex: 4 }]}>{linha.descricao}</Text>
              <Text style={[s.thCellRight, { width: 85, color: "#1c2128" }]}> </Text>
              <Text style={[s.thCellRight, { width: 85, color: "#1c2128" }]}> </Text>
            </View>
          );
        }

        const isNeg = linha.valor < 0;
        const excluido = linha.excluirDoSaldo;

        return (
          <View key={linha.id} style={[s.tr, isAlt ? s.trAlt : {}]}>
            <Text style={[s.td, { flex: 4 }]}>
              {linha.descricao}
              {excluido ? "  (fora do saldo)" : ""}
            </Text>
            <Text style={[s.tdRight, { width: 85 }, isNeg ? s.negativo : s.positivo]}>
              {fmtDC(linha.valor)}
            </Text>
            <Text style={[s.tdRight, { width: 85 }, saldo < 0 ? s.negativo : {}]}>
              {excluido ? "—" : formatarBRL(saldo)}
            </Text>
          </View>
        );
      })}

      {/* Rodapé saldo final */}
      <View style={s.rodapeTabela}>
        <Text style={[s.rodapeTabelaLabel, { flex: 4 }]}>Saldo Final</Text>
        <Text style={[s.rodapeTabelaValor, { width: 85 }]}> </Text>
        <Text style={[s.rodapeTabelaValor, { width: 85 }]}>{formatarBRL(saldoFinal)}</Text>
      </View>

      {/* Devedores */}
      {devedores.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={s.secaoTitulo}>Colportores com Débito</Text>
          <View style={s.thRow}>
            <Text style={[s.thCell, { flex: 3 }]}>Nome</Text>
            <Text style={[s.thCellRight, { width: 90 }]}>Valor do Débito</Text>
          </View>
          {devedores.map((d, idx) => (
            <View key={d.id} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}>
              <Text style={[s.td, { flex: 3 }]}>{d.nome || "—"}</Text>
              <Text style={[s.tdRight, { width: 90 }, s.negativo]}>
                {formatarBRL(d.valorDebito)}
              </Text>
            </View>
          ))}
          <View style={s.rodapeTabela}>
            <Text style={[s.rodapeTabelaLabel, { flex: 3 }]}>Total</Text>
            <Text style={[s.rodapeTabelaValor, { width: 90 }]}>
              {formatarBRL(devedores.reduce((acc, d) => acc + d.valorDebito, 0))}
            </Text>
          </View>
        </View>
      )}

      {/* INSS/IRPF detalhado */}
      {mostrarIRPFDetalhe && (
        <View style={{ marginTop: 10 }}>
          <Text style={s.secaoTitulo}>Detalhamento INSS / IRPF por Líder</Text>
          {linhasLider
            .filter((l) => l.tipo === "inss" || l.tipo === "irpf")
            .map((l) => (
              <View key={l.id} style={{ marginBottom: 4 }}>
                {l.tipo === "inss" && l.detalheINSS && (
                  <>
                    <Text style={[s.td, s.bold]}>{l.descricao}</Text>
                    <BlocoINSS d={l.detalheINSS} />
                  </>
                )}
                {l.tipo === "irpf" && l.detalheIRPF && (
                  <>
                    <Text style={[s.td, s.bold]}>{l.descricao}</Text>
                    <BlocoIRPF d={l.detalheIRPF} />
                  </>
                )}
              </View>
            ))}
        </View>
      )}
    </View>
  );
}
