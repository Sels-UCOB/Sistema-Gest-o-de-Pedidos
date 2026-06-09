"use client";

import { useAcerto } from "@/lib/campanhas/context/AcertoContext";
import { formatarBRL } from "@/lib/campanhas/parseRelatorioSaldo";

export function CabecalhoLider() {
  const { state } = useAcerto();
  const { config, dadosImportados } = state;

  const campanha = config.tipoCampanha === "Outro" ? config.tipoCampanhaOutro : config.tipoCampanha;
  const campo = config.campo === "Outro" ? config.campoOutro : config.campo;
  const lideres = config.lideres.filter((l) => l.nome.trim()).map((l) => l.nome);

  const items = [
    { label: "Campanha", value: campanha || "—" },
    { label: "Subconta", value: config.subContaCampanha || "—" },
    { label: "Departamento", value: config.departamento || "—" },
    { label: "Campo", value: campo || "—" },
    { label: "Caixa", value: config.caixa.nome || "—" },
    { label: "Líderes", value: lideres.length > 0 ? lideres.join(" · ") : "—" },
    { label: "Compra Total", value: dadosImportados ? formatarBRL(dadosImportados.compraTotal) : "—", highlight: true },
    { label: "Compra Bonificada", value: dadosImportados ? formatarBRL(dadosImportados.bonificado) : "—", highlight: true },
  ];

  return (
    <section className="rounded-2xl bg-[#1A1F2E] border border-[#2A2F45] p-5">
      <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
        {items.map(({ label, value, highlight }) => (
          <div key={label} className="space-y-1">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8FA8]">{label}</dt>
            <dd className={`text-sm font-medium truncate ${highlight ? "text-[#6C63FF]" : "text-white"}`} title={value}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
