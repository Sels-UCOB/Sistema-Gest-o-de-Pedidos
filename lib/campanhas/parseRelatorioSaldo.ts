import * as XLSX from "xlsx";
import type { DadosImportados } from "@/lib/campanhas/types/acerto";

function parseBRL(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") {
    const limpo = valor
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

interface LinhaRelatorio {
  nome: string;
  compraTotal: number;
  bonificado: number;
  saldo: number;
}

function encontrarColunas(cabecalho: string[]): {
  idxNome: number;
  idxCompraTotal: number;
  idxBonificado: number;
  idxSaldo: number;
} {
  const normalizar = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const idx = (termos: string[]) => {
    for (const t of termos) {
      const i = cabecalho.findIndex((h) => normalizar(h).includes(t));
      if (i !== -1) return i;
    }
    return -1;
  };

  return {
    idxNome: idx(["nome"]),
    idxCompraTotal: idx(["compra total"]),
    idxBonificado: idx(["bonificado"]),
    idxSaldo: idx(["saldo"]),
  };
}

export function parseRelatorioSaldo(arquivo: File): Promise<DadosImportados> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const linhas: string[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        // Encontrar linha de cabeçalho (contém "Nome")
        let idxCabecalho = -1;
        for (let i = 0; i < linhas.length; i++) {
          const linha = linhas[i].map((c) => String(c).toLowerCase().trim());
          if (linha.some((c) => c === "nome")) {
            idxCabecalho = i;
            break;
          }
        }

        if (idxCabecalho === -1) {
          throw new Error(
            'Cabeçalho com coluna "Nome" não encontrado no arquivo.'
          );
        }

        const cabecalho = linhas[idxCabecalho].map((c) => String(c));
        const { idxNome, idxCompraTotal, idxBonificado, idxSaldo } =
          encontrarColunas(cabecalho);

        if (idxNome === -1 || idxCompraTotal === -1 || idxSaldo === -1) {
          throw new Error(
            "Colunas obrigatórias não encontradas: Nome, Compra Total, Saldo."
          );
        }

        const linhasDados: LinhaRelatorio[] = [];
        let linhaTotalIdx = -1;

        for (let i = idxCabecalho + 1; i < linhas.length; i++) {
          const linha = linhas[i];
          const nome = String(linha[idxNome] ?? "").trim();

          if (!nome) continue;

          // Detectar linha de totais (Quantidade de Colportores ou TOTAL)
          const nomeNorm = nome.toLowerCase();
          if (
            nomeNorm.includes("quantidade de colportor") ||
            nomeNorm.includes("total")
          ) {
            linhaTotalIdx = i;
            continue;
          }

          linhasDados.push({
            nome,
            compraTotal: parseBRL(linha[idxCompraTotal]),
            bonificado:
              idxBonificado !== -1 ? parseBRL(linha[idxBonificado]) : 0,
            saldo: parseBRL(linha[idxSaldo]),
          });
        }

        // Extrair compraTotal e bonificado da linha de totais
        let compraTotal = 0;
        let bonificado = 0;

        if (linhaTotalIdx !== -1) {
          const linhaTotais = linhas[linhaTotalIdx];
          compraTotal = parseBRL(linhaTotais[idxCompraTotal]);
          bonificado =
            idxBonificado !== -1
              ? parseBRL(linhaTotais[idxBonificado])
              : compraTotal;
        } else {
          // Fallback: somar das linhas
          compraTotal = linhasDados.reduce((s, l) => s + l.compraTotal, 0);
          bonificado = linhasDados.reduce((s, l) => s + l.bonificado, 0);
        }

        resolve({
          nomes: linhasDados.map((l) => l.nome),
          saldos: linhasDados.map((l) => l.saldo),
          compraTotal,
          bonificado,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(arquivo);
  });
}

export function formatarBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}
