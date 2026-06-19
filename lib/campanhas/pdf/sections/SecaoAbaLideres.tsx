import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "../styles";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import { calcularSaldosLider } from "@/lib/campanhas/calcularSaldosLider";
import { TABELA_IRPF_MENSAL_2026 } from "@/lib/campanhas/config/impostos";
import type { DadosPDF } from "../types";
import type { DetalheINSS, DetalheIRPF } from "@/lib/campanhas/types/lancamentoLider";

interface Props {
  dados: DadosPDF;
  mostrarIRPFDetalhe?: boolean;
  ocultarSaldoHerdado?: boolean;
}

function fmtDC(valor: number): string {
  if (valor === 0) return "—";
  return valor > 0 ? `+${formatarBRL(valor)}` : `-${formatarBRL(Math.abs(valor))}`;
}

function BlocoINSSPopup({ d, nome }: { d: DetalheINSS; nome: string }) {
  return (
    <View style={s.detalheBox}>
      <Text style={s.detalheTitulo}>INSS — {nome}</Text>

      <Text style={s.detalheSecaoTitulo}>BASE DE CÁLCULO</Text>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Bonificação</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.bonificacao)}</Text>
      </View>
      {d.carta > 0 && (
        <View style={s.detalheLinha}>
          <Text style={s.detalheLabel}>− Carta de Bolsa</Text>
          <Text style={[s.detalheValor, s.negativo]}>{formatarBRL(d.carta)}</Text>
        </View>
      )}
      <View style={[s.detalheLinha, s.detalheLinhaBold]}>
        <Text style={[s.detalheLabel, s.bold]}>Base INSS</Text>
        <Text style={[s.detalheValor, s.bold]}>{formatarBRL(d.base)}</Text>
      </View>

      <Text style={s.detalheSecaoTitulo}>RESULTADO</Text>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Alíquota ({(d.percentual * 100).toFixed(0)}%)</Text>
        <Text style={[s.detalheValor, s.negativo]}>−{formatarBRL(d.valor)}</Text>
      </View>
    </View>
  );
}

function BlocoIRPFPopup({ d, nome }: { d: DetalheIRPF; nome: string }) {
  const faixaIdx = TABELA_IRPF_MENSAL_2026.findIndex((f) => d.baseMensal <= f.limite);

  const etapa2Texto =
    d.etapa2 === "isencao"
      ? `Isenção total — renda mensal ${formatarBRL(d.rendaMensal)} ≤ R$ 5.000,00 → IRPF = R$ 0,00`
      : d.etapa2 === "desconto"
      ? `Desconto progressivo: ${formatarBRL(d.impostoBase)} − ${formatarBRL(d.desconto)} = ${formatarBRL(d.irpfMensal)}`
      : `Integral — IRPF mensal = ${formatarBRL(d.irpfMensal)}`;

  return (
    <View style={s.detalheBox}>
      <Text style={s.detalheTitulo}>IRPF — {nome}</Text>

      {/* BASE DE CÁLCULO */}
      <Text style={s.detalheSecaoTitulo}>BASE DE CÁLCULO</Text>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Bonificação</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.bonificacao)}</Text>
      </View>
      {d.carta > 0 && (
        <View style={s.detalheLinha}>
          <Text style={s.detalheLabel}>− Carta de Bolsa</Text>
          <Text style={[s.detalheValor, s.negativo]}>{formatarBRL(d.carta)}</Text>
        </View>
      )}
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Rendimento bruto</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.baseAjustada)}</Text>
      </View>
      <View style={[s.detalheLinha, s.detalheLinhaBold]}>
        <Text style={[s.detalheLabel, s.bold]}>Renda mensal bruta (÷ 6)</Text>
        <Text style={[s.detalheValor, s.bold]}>{formatarBRL(d.rendaMensal)}</Text>
      </View>

      {/* ETAPA 0 */}
      <Text style={s.detalheSecaoTitulo}>ETAPA 0 — DEDUÇÃO DO INSS</Text>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Renda mensal bruta</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.rendaMensal)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>INSS (20% — alíquota patronal)</Text>
        <Text style={[s.detalheValor, s.negativo]}>−{formatarBRL(d.inssDeducao)}</Text>
      </View>
      <View style={[s.detalheLinha, s.detalheLinhaBold]}>
        <Text style={[s.detalheLabel, s.bold]}>Base mensal (pós-INSS)</Text>
        <Text style={[s.detalheValor, s.bold]}>{formatarBRL(d.baseMensal)}</Text>
      </View>

      {/* ETAPA 1 */}
      <Text style={s.detalheSecaoTitulo}>ETAPA 1 — TABELA PROGRESSIVA</Text>
      <View style={s.irpfTabelaHeader}>
        <Text style={[s.irpfTabelaCell, { flex: 3 }]}>Faixa</Text>
        <Text style={[s.irpfTabelaCell, { width: 32 }]}>Alíq.</Text>
        <Text style={[s.irpfTabelaCell, { width: 52, textAlign: "right" }]}>Dedução</Text>
      </View>
      {TABELA_IRPF_MENSAL_2026.map((faixa, idx) => {
        const isAtiva = idx === faixaIdx;
        const limiteLabel =
          faixa.limite === Infinity
            ? `Acima de ${formatarBRL(TABELA_IRPF_MENSAL_2026[idx - 1]?.limite ?? 0)}`
            : `Até ${formatarBRL(faixa.limite)}`;
        const aliqLabel = faixa.aliquota === 0 ? "Isento" : `${(faixa.aliquota * 100).toFixed(1)}%`;
        const dedLabel = faixa.deducao === 0 ? "—" : formatarBRL(faixa.deducao);
        return (
          <View key={idx} style={[s.irpfTabelaRow, isAtiva ? s.irpfFaixaAtiva : {}]}>
            <Text style={[s.irpfTabelaTexto, { flex: 3 }, isAtiva ? s.bold : {}]}>{limiteLabel}</Text>
            <Text style={[s.irpfTabelaTexto, { width: 32 }, isAtiva ? s.bold : {}]}>{aliqLabel}</Text>
            <Text style={[s.irpfTabelaTexto, { width: 52, textAlign: "right" }, isAtiva ? s.bold : {}]}>{dedLabel}</Text>
          </View>
        );
      })}
      {d.faixaAliquota > 0 ? (
        <Text style={s.irpfFormula}>
          ({formatarBRL(d.baseMensal)} × {(d.faixaAliquota * 100).toFixed(1)}%) − {formatarBRL(d.faixaDeducao)} = {formatarBRL(d.impostoBase)}
        </Text>
      ) : (
        <Text style={s.irpfFormula}>Base ≤ R$ 2.428,80 → Isento</Text>
      )}

      {/* ETAPA 2 */}
      <Text style={s.detalheSecaoTitulo}>ETAPA 2 — AJUSTE POR RENDA</Text>
      <View style={s.detalheLinha}>
        <Text style={[s.detalheLabel, d.etapa2 === "isencao" ? s.positivo : {}]}>{etapa2Texto}</Text>
      </View>

      {/* RESULTADO */}
      <Text style={s.detalheSecaoTitulo}>RESULTADO</Text>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>IRPF mensal</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.irpfMensal)}</Text>
      </View>
      <View style={[s.detalheLinha, s.detalheLinhaBold]}>
        <Text style={[s.detalheLabel, s.bold]}>
          Total (× 6 meses) = 6 × {formatarBRL(d.irpfMensal)}
        </Text>
        <Text style={[s.detalheValor, s.bold, d.irpfTotal > 0 ? s.negativo : {}]}>
          {formatarBRL(d.irpfTotal)}
        </Text>
      </View>
    </View>
  );
}

export function SecaoAbaLideres({ dados, mostrarIRPFDetalhe = false, ocultarSaldoHerdado = false }: Props) {
  const { linhasLider, saldoInicialLider, devedores } = dados;
  const saldos = calcularSaldosLider(linhasLider, saldoInicialLider);
  const saldoFinal = saldos.length > 0 ? saldos[saldos.length - 1] : saldoInicialLider;

  const compraBonificada = dados.dadosImportados?.bonificado ?? 0;
  const liderConfigMap = new Map(
    dados.config.lideres.filter((l) => l.nome.trim()).map((l) => [l.nome, l])
  );

  function getDisplayDesc(linha: (typeof linhasLider)[number]): string {
    if (linha.tipo === "bonificacao" && linha.liderNome) {
      const pct = liderConfigMap.get(linha.liderNome)?.bonificacaoPercentual ?? 0;
      return `${pct}% · Bonificação · ${formatarBRL(compraBonificada)} · ${linha.liderNome}`;
    }
    if (linha.tipo === "auxilio") {
      if (linha.liderNome) {
        const pct = liderConfigMap.get(linha.liderNome)?.auxilioPercentual ?? 0;
        return `${pct}% · Auxílio · ${formatarBRL(compraBonificada)} · ${linha.liderNome}`;
      } else {
        const pct = dados.config.caixa.auxilioPercentual ?? 0;
        const nomeCaixa = dados.config.caixa.nome || "Caixa";
        return `${pct}% · Auxílio · ${formatarBRL(compraBonificada)} · ${nomeCaixa}`;
      }
    }
    return linha.descricao;
  }

  return (
    <View>
      {/* Saldo herdado */}
      {!ocultarSaldoHerdado && (
        <View style={s.saldoBox}>
          <Text style={s.saldoLabel}>Saldo Herdado da Campanha</Text>
          <Text style={[s.saldoValor, saldoInicialLider < 0 ? s.negativo : {}]}>
            {formatarBRL(saldoInicialLider)}
          </Text>
        </View>
      )}

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
        const displayDesc = getDisplayDesc(linha);

        return (
          <View key={linha.id} style={[s.tr, isAlt ? s.trAlt : {}]}>
            <Text style={[s.td, { flex: 4 }]}>
              {displayDesc}
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

      {/* INSS/IRPF popup */}
      {mostrarIRPFDetalhe && (
        <View style={{ marginTop: 10 }}>
          <Text style={s.secaoTitulo}>Detalhamento INSS / IRPF por Líder</Text>
          {linhasLider
            .filter((l) => l.tipo === "inss" || l.tipo === "irpf")
            .map((l) => (
              <View key={l.id} style={{ marginBottom: 6 }}>
                {l.tipo === "inss" && l.detalheINSS && (
                  <BlocoINSSPopup d={l.detalheINSS} nome={l.liderNome ?? ""} />
                )}
                {l.tipo === "irpf" && l.detalheIRPF && (
                  <BlocoIRPFPopup d={l.detalheIRPF} nome={l.liderNome ?? ""} />
                )}
              </View>
            ))}
        </View>
      )}
    </View>
  );
}
