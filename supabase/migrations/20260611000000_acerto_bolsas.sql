-- Módulo de bolsas: tabela híbrida (AUTO + MANUAL) por acerto
-- Execute no Supabase SQL Editor ou via supabase db push

CREATE TABLE IF NOT EXISTS acerto_bolsas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  acerto_id  TEXT        NOT NULL,
  nome       TEXT        NOT NULL,
  dados      JSONB,
  origem     TEXT        NOT NULL CHECK (origem IN ('AUTO', 'MANUAL')),
  removido   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acerto_bolsas_acerto_id
  ON acerto_bolsas (acerto_id)
  WHERE removido = FALSE;

ALTER TABLE acerto_bolsas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on acerto_bolsas"
  ON acerto_bolsas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
