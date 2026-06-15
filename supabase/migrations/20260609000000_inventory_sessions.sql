-- Módulo de contagem de inventário: sessões e registros por item.
-- Documentada retroativamente — tabelas criadas via dashboard do Supabase.

-- ─── inventory_sessions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  campo         TEXT,
  counter_name  TEXT        NOT NULL,
  location      TEXT,
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed')),
  item_count    INTEGER     NOT NULL DEFAULT 0,
  counted_items INTEGER     NOT NULL DEFAULT 0,
  items         JSONB       NOT NULL DEFAULT '[]',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados_inventory_sessions" ON inventory_sessions;
CREATE POLICY "autenticados_inventory_sessions"
  ON inventory_sessions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─── inventory_counts ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_counts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  item_code   TEXT        NOT NULL,
  item_name   TEXT        NOT NULL,
  group_name  TEXT,
  saldo       NUMERIC     NOT NULL DEFAULT 0,
  custo       NUMERIC     NOT NULL DEFAULT 0,
  counted_qty INTEGER     NOT NULL DEFAULT 0,
  counted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, item_code)
);

ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados_inventory_counts" ON inventory_counts;
CREATE POLICY "autenticados_inventory_counts"
  ON inventory_counts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
