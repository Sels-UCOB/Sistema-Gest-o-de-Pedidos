import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "../styles";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import type { DadosPDF } from "../types";
import type { ResumoLiderCalc } from "@/lib/campanhas/types/debitos";
import type { LiderAcerto } from "@/lib/campanhas/types/acerto";
import type { DevedorColportor } from "@/lib/campanhas/types/debitos";
import type { DetalheINSS, DetalheIRPF } from "@/lib/campanhas/types/lancamentoLider";
import { calcularINSSDetalhe, calcularIRPFDetalhe } from "@/lib/campanhas/calcularImpostos";
import { TABELA_IRPF_MENSAL_2026 } from "@/lib/campanhas/config/impostos";

function arred(n: number) { return Math.round(n * 100) / 100; }

// ─── Blocos popup INSS / IRPF ────────────────────────────────────────────────

function BlocoINSSPopup({ d }: { d: DetalheINSS }) {
  return (
    <View style={[s.detalheBox, { marginTop: 4 }]}>
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

function BlocoIRPFPopup({ d }: { d: DetalheIRPF }) {
  const faixaIdx = TABELA_IRPF_MENSAL_2026.findIndex((f) => d.baseMensal <= f.limite);

  const etapa2Texto =
    d.etapa2 === "isencao"
      ? `Isenção total — renda mensal ${formatarBRL(d.rendaMensal)} ≤ R$ 5.000,00 → IRPF = R$ 0,00`
      : d.etapa2 === "desconto"
      ? `Desconto progressivo: ${formatarBRL(d.impostoBase)} − ${formatarBRL(d.desconto)} = ${formatarBRL(d.irpfMensal)}`
      : `Integral — IRPF mensal = ${formatarBRL(d.irpfMensal)}`;

  return (
    <View style={[s.detalheBox, { marginTop: 4 }]}>
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

// ─── Card por líder ───────────────────────────────────────────────────────────

interface CardProps {
  resumo: ResumoLiderCalc;
  lider: LiderAcerto;
  devedores: DevedorColportor[];
  mostrarImpostos?: boolean;
}

export function CardLiderDetalhado({ resumo, lider, devedores, mostrarImpostos = false }: CardProps) {
  const pct = lider.percentualDebito ?? 0;
  const carta = resumo.carta;
  const inssDetalhe = calcularINSSDetalhe(resumo.bonificacao, carta);
  const irpfDetalhe = calcularIRPFDetalhe(resumo.bonificacao, carta);

  return (
    <View>
      <Text style={s.cardLiderNome}>{resumo.nome}</Text>

      <Text style={s.secaoTitulo}>Resumo Financeiro</Text>
      <View style={s.rfLinha}>
        <Text style={s.rfLabel}>Bonificação</Text>
        <Text style={[s.rfValor, s.positivo]}>{formatarBRL(resumo.bonificacao)}</Text>
      </View>
      <View style={s.rfLinha}>
        <Text style={s.rfLabel}>Auxílio</Text>
        <Text style={[s.rfValor, s.positivo]}>{formatarBRL(resumo.auxilio)}</Text>
      </View>
      <View style={s.rfLinha}>
        <Text style={[s.rfLabel, s.bold]}>Total Bruto</Text>
        <Text style={[s.rfValor, s.bold, s.positivo]}>{formatarBRL(resumo.totalBruto)}</Text>
      </View>
      {carta > 0 && (
        <View style={s.rfLinha}>
          <Text style={s.rfLabel}>Carta de Bolsa</Text>
          <Text style={[s.rfValor, s.negativo]}>−{formatarBRL(carta)}</Text>
        </View>
      )}

      <Text style={[s.secaoTitulo, { marginTop: 8 }]}>Débitos</Text>
      {resumo.gastos > 0 && (
        <View style={s.rfLinha}>
          <Text style={s.rfLabel}>Gastos do líder</Text>
          <Text style={[s.rfValor, s.negativo]}>−{formatarBRL(resumo.gastos)}</Text>
        </View>
      )}
      {resumo.debitosAdicionaisTotal !== 0 && (
        <View style={s.rfLinha}>
          <Text style={s.rfLabel}>
            {resumo.debitosAdicionaisTotal > 0 ? "Débitos adicionais" : "Créditos adicionais"}
          </Text>
          <Text style={[s.rfValor, resumo.debitosAdicionaisTotal > 0 ? s.negativo : s.positivo]}>
            {resumo.debitosAdicionaisTotal > 0
              ? `−${formatarBRL(resumo.debitosAdicionaisTotal)}`
              : `+${formatarBRL(Math.abs(resumo.debitosAdicionaisTotal))}`}
          </Text>
        </View>
      )}
      {devedores.length > 0 && pct > 0 && (
        <View style={{ marginTop: 4 }}>
          <Text style={[s.rfLabel, s.bold, { marginBottom: 2 }]}>
            Débitos de colportores ({pct.toFixed(1)}%):
          </Text>
          {devedores.map((d) => {
            const parcela = Math.round((pct / 100) * d.valorDebito * 100) / 100;
            return (
              <View key={d.id} style={[s.rfLinha, { paddingLeft: 12 }]}>
                <Text style={s.rfLabel}>{d.nome || "—"}</Text>
                <Text style={[s.rfValor, s.negativo]}>−{formatarBRL(parcela)}</Text>
              </View>
            );
          })}
        </View>
      )}
      <View style={[s.rfLinha, { marginTop: 2 }]}>
        <Text style={[s.rfLabel, s.bold]}>Total Débitos</Text>
        <Text style={[s.rfValor, s.bold, s.negativo]}>−{formatarBRL(resumo.totalDebitos)}</Text>
      </View>

      <View style={s.separador} />

      <View style={s.rfLinha}>
        <Text style={s.rfLabel}>Dízimo (10%)</Text>
        <Text style={[s.rfValor, s.negativo]}>−{formatarBRL(resumo.dizimo)}</Text>
      </View>
      <View style={s.rfLinha}>
        <Text style={s.rfLabel}>INSS</Text>
        <Text style={[s.rfValor, s.negativo]}>−{formatarBRL(resumo.inss)}</Text>
      </View>
      {resumo.irpf > 0 && (
        <View style={s.rfLinha}>
          <Text style={s.rfLabel}>IRPF</Text>
          <Text style={[s.rfValor, s.negativo]}>−{formatarBRL(resumo.irpf)}</Text>
        </View>
      )}

      <View style={s.rfSaldo}>
        <Text style={s.rfSaldoLabel}>Saldo Final</Text>
        <Text style={[s.rfSaldoValor, resumo.saldoFinal < 0 ? s.negativo : s.positivo]}>
          {formatarBRL(resumo.saldoFinal)}
        </Text>
      </View>

      {mostrarImpostos && (
        <View style={{ marginTop: 10 }}>
          <BlocoINSSPopup d={inssDetalhe} />
          {resumo.irpf > 0 && <BlocoIRPFPopup d={irpfDetalhe} />}
        </View>
      )}
    </View>
  );
}

// ─── Card do Caixa ────────────────────────────────────────────────────────────

interface CardCaixaProps {
  dados: DadosPDF;
}

export function CardCaixaDetalhado({ dados }: CardCaixaProps) {
  const { config, gastosCaixa, dadosImportados } = dados;
  const caixa = config.caixa;
  if (!caixa.nome.trim()) return null;

  const compraBonificada = dadosImportados?.bonificado ?? 0;
  const auxilioCaixa = caixa.auxilioPercentual > 0
    ? arred((caixa.auxilioPercentual / 100) * compraBonificada)
    : 0;
  const salarioCaixa = caixa.salarioCaixa ?? 0;
  const totalBruto = arred(auxilioCaixa + salarioCaixa);
  const debitosAdicionaisTotal = gastosCaixa.debitosAdicionais.reduce((s, d) => s + d.valor, 0);
  const totalDebitos = arred(gastosCaixa.gastos + debitosAdicionaisTotal);
  const saldoFinal = arred(totalBruto - totalDebitos);

  return (
    <View>
      <Text style={s.cardLiderNome}>{caixa.nome}</Text>

      <Text style={s.secaoTitulo}>Resumo Financeiro</Text>
      {auxilioCaixa > 0 && (
        <View style={s.rfLinha}>
          <Text style={s.rfLabel}>Auxílio ({caixa.auxilioPercentual}% de {formatarBRL(compraBonificada)})</Text>
          <Text style={[s.rfValor, s.positivo]}>{formatarBRL(auxilioCaixa)}</Text>
        </View>
      )}
      {salarioCaixa > 0 && (
        <View style={s.rfLinha}>
          <Text style={s.rfLabel}>Salário Caixa</Text>
          <Text style={[s.rfValor, s.positivo]}>{formatarBRL(salarioCaixa)}</Text>
        </View>
      )}
      <View style={s.rfLinha}>
        <Text style={[s.rfLabel, s.bold]}>Total Bruto</Text>
        <Text style={[s.rfValor, s.bold, s.positivo]}>{formatarBRL(totalBruto)}</Text>
      </View>

      <Text style={[s.secaoTitulo, { marginTop: 8 }]}>Débitos</Text>
      {gastosCaixa.gastos > 0 && (
        <View style={s.rfLinha}>
          <Text style={s.rfLabel}>Gastos do caixa</Text>
          <Text style={[s.rfValor, s.negativo]}>−{formatarBRL(gastosCaixa.gastos)}</Text>
        </View>
      )}
      {gastosCaixa.debitosAdicionais.map((d) => (
        <View key={d.id} style={s.rfLinha}>
          <Text style={s.rfLabel}>{d.descricao || "Débito adicional"}</Text>
          <Text style={[s.rfValor, d.valor > 0 ? s.negativo : s.positivo]}>
            {d.valor > 0 ? `−${formatarBRL(d.valor)}` : `+${formatarBRL(Math.abs(d.valor))}`}
          </Text>
        </View>
      ))}
      {totalDebitos !== 0 && (
        <View style={[s.rfLinha, { marginTop: 2 }]}>
          <Text style={[s.rfLabel, s.bold]}>Total Débitos</Text>
          <Text style={[s.rfValor, s.bold, s.negativo]}>−{formatarBRL(totalDebitos)}</Text>
        </View>
      )}

      <View style={s.rfSaldo}>
        <Text style={s.rfSaldoLabel}>Saldo Final</Text>
        <Text style={[s.rfSaldoValor, saldoFinal < 0 ? s.negativo : s.positivo]}>
          {formatarBRL(saldoFinal)}
        </Text>
      </View>
    </View>
  );
}

// ─── Seção tabela resumo ──────────────────────────────────────────────────────

interface SecaoProps {
  dados: DadosPDF;
  expandirDevedores?: boolean;
}

export function SecaoResumoLideres({ dados, expandirDevedores = false }: SecaoProps) {
  const { resumosLideres, config, devedores } = dados;

  if (resumosLideres.length === 0) {
    return (
      <View>
        <Text style={s.secaoTitulo}>Resumo dos Líderes</Text>
        <Text style={[s.td, s.muted]}>Nenhum líder configurado.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={s.secaoTitulo}>Resumo dos Líderes</Text>

      <View style={s.thRow}>
        <Text style={[s.thCell, { flex: 2 }]}>Líder</Text>
        <Text style={[s.thCellRight, { width: 60 }]}>Bruto</Text>
        <Text style={[s.thCellRight, { width: 55 }]}>Débitos</Text>
        <Text style={[s.thCellRight, { width: 50 }]}>Dízimo</Text>
        <Text style={[s.thCellRight, { width: 50 }]}>INSS</Text>
        <Text style={[s.thCellRight, { width: 50 }]}>IRPF</Text>
        <Text style={[s.thCellRight, { width: 55 }]}>Carta</Text>
        <Text style={[s.thCellRight, { width: 65 }]}>Saldo Final</Text>
      </View>

      {resumosLideres.map((r, idx) => (
        <View key={r.nome} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}>
          <Text style={[s.td, { flex: 2 }]}>{r.nome}</Text>
          <Text style={[s.tdRight, { width: 60 }]}>{formatarBRL(r.totalBruto)}</Text>
          <Text style={[s.tdRight, { width: 55 }, s.negativo]}>
            {r.totalDebitos > 0 ? `−${formatarBRL(r.totalDebitos)}` : "—"}
          </Text>
          <Text style={[s.tdRight, { width: 50 }, s.negativo]}>−{formatarBRL(r.dizimo)}</Text>
          <Text style={[s.tdRight, { width: 50 }, s.negativo]}>−{formatarBRL(r.inss)}</Text>
          <Text style={[s.tdRight, { width: 50 }, s.negativo]}>
            {r.irpf > 0 ? `−${formatarBRL(r.irpf)}` : "—"}
          </Text>
          <Text style={[s.tdRight, { width: 55 }, r.carta > 0 ? s.negativo : {}]}>
            {r.carta > 0 ? `−${formatarBRL(r.carta)}` : "—"}
          </Text>
          <Text style={[s.tdRight, s.bold, { width: 65 }, r.saldoFinal < 0 ? s.negativo : s.positivo]}>
            {formatarBRL(r.saldoFinal)}
          </Text>
        </View>
      ))}

      {/* Cards detalhados por líder */}
      {expandirDevedores &&
        resumosLideres.map((resumo, idx) => {
          const lider = config.lideres[idx];
          if (!lider) return null;
          return (
            <View key={`card-${resumo.nome}`} style={{ marginTop: 14 }} break={idx > 0}>
              <CardLiderDetalhado resumo={resumo} lider={lider} devedores={devedores} mostrarImpostos />
            </View>
          );
        })}

      {/* Card do Caixa */}
      {expandirDevedores && config.caixa.nome.trim() && (
        <View style={{ marginTop: 14 }} break>
          <CardCaixaDetalhado dados={dados} />
        </View>
      )}
    </View>
  );
}
