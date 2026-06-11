"use client";

import { useState } from "react";
import { X, Calculator, AlertTriangle } from "lucide-react";

// ─── Helpers de moeda BRL ─────────────────────────────────────────────────────

function parseBRL(v: string): number {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Identificação do papel de cada coluna ────────────────────────────────────

type FieldRole = "text" | "compra" | "semestre" | "calculated" | "skip";

function getRole(header: string): FieldRole {
  const h = header.trim();
  if (!h) return "skip";
  const l = h.toLowerCase();
  if (/compra|bonificad/i.test(l)) return "compra";
  if (/semestre/i.test(l)) return "semestre";
  if (/bolsa|sels|fpc|associa|cpb|excedente/i.test(l)) return "calculated";
  return "text";
}

// ─── Cálculo automático ───────────────────────────────────────────────────────

function recalculate(colunas: string[], headers: string[]): string[] {
  const result = [...colunas];

  const compraIdx = headers.findIndex((h) => /compra|bonificad/i.test(h));
  const semestreIdx = headers.findIndex((h) => /semestre/i.test(h));
  if (compraIdx === -1 || semestreIdx === -1) return result;

  const compra = parseBRL(result[compraIdx] ?? "");
  const semestre = parseBRL(result[semestreIdx] ?? "");
  const eligible = compra > 0 && semestre > 0 && compra >= semestre;

  headers.forEach((header, i) => {
    const l = header.trim().toLowerCase();
    if (/bolsa/.test(l)) {
      result[i] = eligible ? formatBRL(semestre * 0.2) : "";
    } else if (/sels|fpc/.test(l)) {
      result[i] = eligible ? formatBRL(semestre * 0.05) : "";
    } else if (/associa/.test(l)) {
      result[i] = eligible ? formatBRL(semestre * 0.05) : "";
    } else if (/cpb/.test(l)) {
      result[i] = eligible ? formatBRL(semestre * 0.1) : "";
    } else if (/excedente/.test(l)) {
      result[i] = eligible && compra > semestre
        ? formatBRL((compra - semestre) * 0.1)
        : "";
    }
  });

  return result;
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  mode?: "add" | "edit";
  initialNome?: string;
  initialColunas?: string[];
  extraHeaders: string[];
  onConfirm: (nome: string, colunas: string[]) => Promise<void>;
  onClose: () => void;
}

export function ModalAdicionarBolsa({
  mode = "add",
  initialNome = "",
  initialColunas = [],
  extraHeaders,
  onConfirm,
  onClose,
}: Props) {
  const [nome, setNome] = useState(initialNome);
  const [colunas, setColunas] = useState<string[]>(
    extraHeaders.map((_, i) => initialColunas[i] ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateColuna = (i: number, value: string) => {
    const newColunas = [...colunas];
    newColunas[i] = value;
    const role = getRole(extraHeaders[i] ?? "");
    if (role === "compra" || role === "semestre") {
      setColunas(recalculate(newColunas, extraHeaders));
    } else {
      setColunas(newColunas);
    }
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const nomeTrimmed = nome.trim();
    if (!nomeTrimmed) {
      setError("Informe o nome do colportor.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(nomeTrimmed, colunas);
      onClose();
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  // Estado do cálculo para feedback ao usuário
  const compraIdx = extraHeaders.findIndex((h) => /compra|bonificad/i.test(h));
  const semestreIdx = extraHeaders.findIndex((h) => /semestre/i.test(h));
  const hasCalcFields = compraIdx !== -1 && semestreIdx !== -1;
  const compraVal = hasCalcFields ? parseBRL(colunas[compraIdx] ?? "") : 0;
  const semestreVal = hasCalcFields ? parseBRL(colunas[semestreIdx] ?? "") : 0;
  const bothFilled = compraVal > 0 && semestreVal > 0;
  const eligible = bothFilled && compraVal >= semestreVal;

  const hasVisibleFields = extraHeaders.some((h) => getRole(h) !== "skip");
  const title = mode === "edit" ? "Editar Bolsa" : "Adicionar Bolsa Manual";
  const btnLabel = mode === "edit" ? "Salvar" : "Adicionar";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1A1F2E] border border-[#2A2F45] rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2F45] shrink-0">
          <h2 className="text-white font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8B8FA8] hover:text-white hover:bg-[#2A2F45] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8B8FA8] uppercase tracking-wider">
                Nome do colportor
              </label>
              <input
                autoFocus
                type="text"
                value={nome}
                onChange={(e) => { setNome(e.target.value); setError(null); }}
                placeholder="Ex: João da Silva"
                className="w-full px-3 py-2.5 rounded-xl bg-[#0D1117] border border-[#2A2F45] text-white placeholder-[#8B8FA8] text-sm focus:outline-none focus:border-[#6C63FF] transition-colors"
              />
            </div>

            {/* Campos dinâmicos — ignora headers vazios, calcula automaticamente */}
            {extraHeaders.map((header, i) => {
              const role = getRole(header);
              if (role === "skip") return null;
              const isCalc = role === "calculated";

              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-[#8B8FA8] uppercase tracking-wider">
                      {header}
                    </label>
                    {isCalc && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#6C63FF]/20 text-[#6C63FF]">
                        <Calculator className="w-2.5 h-2.5" />
                        Auto
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={colunas[i] ?? ""}
                    readOnly={isCalc}
                    onChange={(e) => updateColuna(i, e.target.value)}
                    placeholder={isCalc ? "Calculado automaticamente" : header}
                    className={`w-full px-3 py-2.5 rounded-xl bg-[#0D1117] border text-sm focus:outline-none transition-colors ${
                      isCalc
                        ? "border-[#2A2F45] text-[#8B8FA8] cursor-not-allowed select-none"
                        : "border-[#2A2F45] text-white placeholder-[#8B8FA8] focus:border-[#6C63FF]"
                    }`}
                  />
                </div>
              );
            })}

            {/* Aviso: sem bolsa */}
            {bothFilled && !eligible && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <p className="text-xs text-yellow-400">
                  Compra abaixo do semestre — bolsa não calculada.
                </p>
              </div>
            )}

            {!hasVisibleFields && (
              <p className="text-xs text-[#8B8FA8]">
                Reprocesse o relatório para habilitar campos adicionais.
              </p>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#2A2F45] flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#2A2F45] text-[#8B8FA8] hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !nome.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#6C63FF] text-white hover:bg-[#5B52E8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Salvando..." : btnLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
