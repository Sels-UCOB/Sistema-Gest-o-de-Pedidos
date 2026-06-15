-- Adiciona coluna campanhas em config_global para gerenciamento pelo admin.
-- Pré-populada com os valores atualmente hardcoded em lib/campos.ts.

ALTER TABLE config_global
  ADD COLUMN IF NOT EXISTS campanhas JSONB NOT NULL DEFAULT '[]';

UPDATE config_global SET campanhas = '[
  {"code": "ABC - 9386",      "campo": "GO"},
  {"code": "APLAC - 9386",    "campo": "GO"},
  {"code": "APLAC SA - 9402", "campo": "GO"},
  {"code": "CABC - 9482",     "campo": "GO"},
  {"code": "MTO - 9390",      "campo": "GO"},
  {"code": "MTO SA - 9426",   "campo": "GO"},
  {"code": "ALM - 9381",      "campo": "MT"},
  {"code": "ALM SA - 9405",   "campo": "MT"},
  {"code": "AOM - 9492",      "campo": "MT"},
  {"code": "AOM SA - 9375",   "campo": "MT"},
  {"code": "ASM - 9418",      "campo": "MS"},
  {"code": "ASM SA - 9471",   "campo": "MS"}
]'::jsonb
WHERE id = 1;
