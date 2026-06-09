"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";
import { TABELA_IRPF_MENSAL_2026 } from "@/lib/campanhas/config/impostos";
import type { LinhaTabela, DetalheIRPF } from "@/lib/campanhas/types/lancamentoLider";

interface Props { linha: LinhaTabela; onFechar: () => void; }

const LABELS_FAIXA = ["Até R$ 2.428,80", "Até R$ 2.826,65", "Até R$ 3.751,05", "Até R$ 4.664,68", "Acima de R$ 4.664,68"];

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold uppercase tracking-widest text-[#6C63FF] mb-2">{children}</p>
);
const Row = ({ label, value, highlight, deducao }: { label: string; value: string; highlight?: boolean; deducao?: boolean }) => (
  <div className={cn("flex items-center justify-between py-1.5", highlight && "border-t border-[#2A2F45] mt-1 pt-2")}>
    <span className={cn("text-sm", highlight ? "font-semibold text-white" : "text-[#8B8FA8]")}>{label}</span>
    <span className={cn("text-sm font-medium tabular-nums", deducao ? "text-red-400" : highlight ? "text-white" : "text-[#8B8FA8]")}>{value}</span>
  </div>
);

function IRPFDetalhe({ d }: { d: DetalheIRPF }) {
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Base de Cálculo</SectionTitle>
        <Row label="Bonificação" value={formatarBRL(d.bonificacao)} />
        {d.carta > 0 && <Row label="Carta de Bolsa" value={`− ${formatarBRL(d.carta)}`} deducao />}
        <Row label="Rendimento bruto" value={formatarBRL(d.baseAjustada)} highlight />
        <Row label="Renda mensal bruta (÷ 6)" value={formatarBRL(d.rendaMensal)} />
      </div>

      <div>
        <SectionTitle>Etapa 0 — Dedução do INSS</SectionTitle>
        <Row label="Renda mensal bruta" value={formatarBRL(d.rendaMensal)} />
        <Row label="INSS (20% — alíquota patronal)" value={`− ${formatarBRL(d.inssDeducao)}`} deducao />
        <Row label="Base mensal (pós-INSS)" value={formatarBRL(d.baseMensal)} highlight />
      </div>

      <div>
        <SectionTitle>Etapa 1 — Tabela Progressiva</SectionTitle>
        <div className="rounded-lg overflow-hidden border border-[#2A2F45]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2A2F45]">
                {["Faixa", "Alíq.", "Dedução"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-[#8B8FA8]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABELA_IRPF_MENSAL_2026.map((faixa, i) => {
                const aplicada = faixa.aliquota === d.faixaAliquota && faixa.deducao === d.faixaDeducao;
                return (
                  <tr key={i} className={cn("border-b border-[#2A2F45]/50 last:border-0", aplicada && "bg-[#6C63FF]/10")}>
                    <td className={cn("px-3 py-2", aplicada && "text-[#6C63FF] font-medium")}>{LABELS_FAIXA[i]}</td>
                    <td className="px-3 py-2 text-[#8B8FA8]">{faixa.aliquota === 0 ? "Isento" : `${(faixa.aliquota * 100).toFixed(1)}%`}</td>
                    <td className="px-3 py-2 text-[#8B8FA8]">{faixa.deducao === 0 ? "—" : formatarBRL(faixa.deducao)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#8B8FA8] mt-2 px-1">
          {d.faixaAliquota === 0
            ? <>Faixa isenta → Imposto base = <strong className="text-white">{formatarBRL(0)}</strong></>
            : <>({formatarBRL(d.baseMensal)} × {(d.faixaAliquota * 100).toFixed(1)}%) − {formatarBRL(d.faixaDeducao)} = <strong className="text-white">{formatarBRL(d.impostoBase)}</strong></>
          }
        </p>
      </div>

      <div>
        <SectionTitle>Etapa 2 — Ajuste por Renda</SectionTitle>
        {d.etapa2 === "isencao" && (
          <p className="text-sm text-[#8B8FA8]">
            <span className="px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 text-xs font-medium mr-2">Isenção total</span>
            Renda mensal bruta {formatarBRL(d.rendaMensal)} ≤ R$ 5.000,00 → IRPF = <strong className="text-white">{formatarBRL(0)}</strong>
          </p>
        )}
        {d.etapa2 === "desconto" && (
          <div className="space-y-1.5">
            <p className="text-sm text-[#8B8FA8]">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-xs font-medium mr-2">Desconto parcial</span>
              Renda {formatarBRL(d.rendaMensal)} entre R$ 5.000,00 e R$ 7.350,00
            </p>
            <p className="text-xs text-[#8B8FA8] px-1">908,73 − (0,133 × {formatarBRL(d.rendaMensal)}) = <strong className="text-white">{formatarBRL(d.desconto)}</strong></p>
            <p className="text-xs text-white font-medium px-1">max(0, {formatarBRL(d.impostoBase)} − {formatarBRL(d.desconto)}) = <strong>{formatarBRL(d.irpfMensal)}</strong></p>
          </div>
        )}
        {d.etapa2 === "integral" && (
          <p className="text-sm text-[#8B8FA8]">
            <span className="px-1.5 py-0.5 rounded bg-[#2A2F45] text-[#8B8FA8] text-xs font-medium mr-2">Integral</span>
            Renda {formatarBRL(d.rendaMensal)} &gt; R$ 7.350,00 → sem ajuste
          </p>
        )}
      </div>

      <div>
        <SectionTitle>Resultado</SectionTitle>
        <Row label="IRPF mensal" value={formatarBRL(d.irpfMensal)} />
        <Row label={`Total (× 6 meses) = 6 × ${formatarBRL(d.irpfMensal)}`} value={formatarBRL(d.irpfTotal)} highlight />
      </div>
    </div>
  );
}

export function ModalDetalhe({ linha, onFechar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onFechar}>
      <div className="w-full max-w-lg max-h-[90vh] rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2F45] shrink-0">
          <h2 className="text-base font-semibold text-white">
            {linha.tipo === "inss" ? "Detalhamento — INSS" : "Detalhamento — IRPF"}
          </h2>
          <button type="button" onClick={onFechar} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8B8FA8] hover:text-white hover:bg-[#2A2F45] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {linha.tipo === "inss" && linha.detalheINSS && (
            <div className="space-y-1">
              <Row label="Bonificação" value={formatarBRL(linha.detalheINSS.bonificacao)} />
              {linha.detalheINSS.carta > 0 && <Row label="Carta de Bolsa" value={`− ${formatarBRL(linha.detalheINSS.carta)}`} deducao />}
              <Row label="Base utilizada" value={formatarBRL(linha.detalheINSS.base)} highlight />
              <Row label="Percentual aplicado" value={`${(linha.detalheINSS.percentual * 100).toFixed(0)}%`} />
              <Row label="Valor INSS" value={formatarBRL(linha.detalheINSS.valor)} highlight />
            </div>
          )}
          {linha.tipo === "irpf" && linha.detalheIRPF && <IRPFDetalhe d={linha.detalheIRPF} />}
        </div>
      </div>
    </div>
  );
}
