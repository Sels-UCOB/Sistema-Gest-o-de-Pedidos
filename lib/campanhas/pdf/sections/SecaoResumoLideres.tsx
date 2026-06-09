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

interface CardProps {
  resumo: ResumoLiderCalc;
  lider: LiderAcerto;
  devedores: DevedorColportor[];
  mostrarImpostos?: boolean;
}

function BlocoINSSCompacto({ d }: { d: DetalheINSS }) {
  return (
    <View style={[s.detalheBox, { marginTop: 3 }]}>
      <Text style={s.detalheTitulo}>Cálculo INSS</Text>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Base ({d.carta > 0 ? "Bonif. − Carta" : "Bonif."})</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.base)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>10% sobre base</Text>
        <Text style={[s.detalheValor, s.negativo]}>{formatarBRL(d.valor)}</Text>
      </View>
    </View>
  );
}

function BlocoIRPFCompacto({ d }: { d: DetalheIRPF }) {
  const etapa =
    d.etapa2 === "isencao"
      ? "Isento"
      : d.etapa2 === "desconto"
      ? "Desconto progressivo"
      : "Integral";
  return (
    <View style={[s.detalheBox, { marginTop: 3 }]}>
      <Text style={s.detalheTitulo}>Cálculo IRPF</Text>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Renda mensal (base ÷ 6)</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.rendaMensal)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>Base mensal tributável</Text>
        <Text style={s.detalheValor}>{formatarBRL(d.baseMensal)}</Text>
      </View>
      <View style={s.detalheLinha}>
        <Text style={s.detalheLabel}>
          Faixa {(d.faixaAliquota * 100).toFixed(1)}% / Etapa 2: {etapa}
        </Text>
        <Text style={s.detalheValor}>{formatarBRL(d.impostoBase)}</Text>
      </View>
      {d.etapa2 === "desconto" && (
        <View style={s.detalheLinha}>
          <Text style={s.detalheLabel}>Desconto</Text>
          <Text style={[s.detalheValor, s.positivo]}>−{formatarBRL(d.desconto)}</Text>
        </View>
      )}
      <View style={s.detalheLinha}>
        <Text style={[s.detalheLabel, s.bold]}>IRPF total (×6)</Text>
        <Text style={[s.detalheValor, s.bold, s.negativo]}>{formatarBRL(d.irpfTotal)}</Text>
      </View>
    </View>
  );
}

export function CardLiderDetalhado({
  resumo,
  lider,
  devedores,
  mostrarImpostos = false,
}: CardProps) {
  const pct = lider.percentualDebito ?? 0;
  const carta = resumo.carta;

  const inssDetalhe = calcularINSSDetalhe(resumo.bonificacao, carta);
  const irpfDetalhe = calcularIRPFDetalhe(resumo.bonificacao, carta);

  return (
    <View>
      <Text style={s.cardLiderNome}>{resumo.nome}</Text>

      {/* Resumo financeiro */}
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

      {/* Débitos */}
      <Text style={[s.secaoTitulo, { marginTop: 8 }]}>Débitos</Text>

      {/* Gastos diretos */}
      {resumo.gastos > 0 && (
        <View style={s.rfLinha}>
          <Text style={s.rfLabel}>Gastos do líder</Text>
          <Text style={[s.rfValor, s.negativo]}>−{formatarBRL(resumo.gastos)}</Text>
        </View>
      )}

      {/* Débitos adicionais */}
      {resumo.debitosAdicionaisTotal > 0 && (
        <View style={s.rfLinha}>
          <Text style={s.rfLabel}>Débitos adicionais</Text>
          <Text style={[s.rfValor, s.negativo]}>−{formatarBRL(resumo.debitosAdicionaisTotal)}</Text>
        </View>
      )}

      {/* Colportores devedores */}
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

      {/* Total débitos */}
      <View style={[s.rfLinha, { marginTop: 2 }]}>
        <Text style={[s.rfLabel, s.bold]}>Total Débitos</Text>
        <Text style={[s.rfValor, s.bold, s.negativo]}>−{formatarBRL(resumo.totalDebitos)}</Text>
      </View>

      <View style={s.separador} />

      {/* Descontos */}
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

      {/* Saldo final */}
      <View style={s.rfSaldo}>
        <Text style={s.rfSaldoLabel}>Saldo Final</Text>
        <Text style={[s.rfSaldoValor, resumo.saldoFinal < 0 ? s.negativo : s.positivo]}>
          {formatarBRL(resumo.saldoFinal)}
        </Text>
      </View>

      {/* Detalhes INSS/IRPF */}
      {mostrarImpostos && (
        <View style={{ marginTop: 10 }}>
          <BlocoINSSCompacto d={inssDetalhe} />
          {resumo.irpf > 0 && <BlocoIRPFCompacto d={irpfDetalhe} />}
        </View>
      )}
    </View>
  );
}

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

      {/* Tabela resumida */}
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
          <Text
            style={[
              s.tdRight,
              s.bold,
              { width: 65 },
              r.saldoFinal < 0 ? s.negativo : s.positivo,
            ]}
          >
            {formatarBRL(r.saldoFinal)}
          </Text>
        </View>
      ))}

      {/* Cards detalhados */}
      {expandirDevedores &&
        resumosLideres.map((resumo, idx) => {
          const lider = config.lideres[idx];
          if (!lider) return null;
          return (
            <View key={`card-${resumo.nome}`} style={{ marginTop: 14 }} break={idx > 0}>
              <CardLiderDetalhado
                resumo={resumo}
                lider={lider}
                devedores={devedores}
                mostrarImpostos
              />
            </View>
          );
        })}
    </View>
  );
}
