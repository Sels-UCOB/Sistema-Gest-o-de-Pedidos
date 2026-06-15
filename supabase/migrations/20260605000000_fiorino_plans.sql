-- Módulo Fiorino: planos de carregamento (máx 5 por campo).
-- Documentada retroativamente — tabela criada via dashboard do Supabase.

CREATE TABLE IF NOT EXISTS fiorino_plans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    UUID        REFERENCES auth.users(id),
  date          TEXT        NOT NULL,
  campo         TEXT,
  campaign_code TEXT,
  type          TEXT        NOT NULL,
  notes         TEXT,
  boxes         JSONB       NOT NULL DEFAULT '[]',
  occupancy_pct NUMERIC     NOT NULL DEFAULT 0,
  box_count     INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fiorino_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados_fiorino_plans" ON fiorino_plans;
CREATE POLICY "autenticados_fiorino_plans"
  ON fiorino_plans FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
