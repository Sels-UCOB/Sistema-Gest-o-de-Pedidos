export type CampoId = "GO" | "MT" | "MS";

export const WAREHOUSES = [
  { id: "SEDE_EXT",   campo: "GO" as CampoId, label: "Sede — Externo" },
  { id: "SEDE_UNION", campo: "GO" as CampoId, label: "Sede — The Union" },
  { id: "SEDE_CONT",  campo: "GO" as CampoId, label: "Sede — Container" },
  { id: "MT_EST",     campo: "MT" as CampoId, label: "MT — Estoque" },
  { id: "MT_ALM",     campo: "MT" as CampoId, label: "MT — Externo ALM" },
  { id: "MS_EST",     campo: "MS" as CampoId, label: "MS — Estoque" },
  { id: "MS_ALM",     campo: "MS" as CampoId, label: "MS — Depósito Novo ALM" },
] as const;

export type WarehouseId =
  | "SEDE_EXT" | "SEDE_UNION" | "SEDE_CONT"
  | "MT_EST" | "MT_ALM"
  | "MS_EST" | "MS_ALM";

export const CAMPO_MAP: Record<string, CampoId> = {
  "ABC - 9386":      "GO",
  "APLAC - 9386":    "GO",
  "APLAC SA - 9402": "GO",
  "CABC - 9482":     "GO",
  "MTO - 9390":      "GO",
  "MTO SA - 9426":   "GO",

  "ALM - 9381":      "MT",
  "ALM SA - 9405":   "MT",
  "AOM - 9492":      "MT",
  "AOM SA - 9375":   "MT",

  "ASM - 9418":      "MS",
  "ASM SA - 9471":   "MS",
};
