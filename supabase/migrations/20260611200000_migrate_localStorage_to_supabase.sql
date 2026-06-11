-- ─── Acertos ────────────────────────────────────────────────────────────────
-- Mantém id TEXT no formato ac_... existente para preservar referências em
-- acerto_anexos e acerto_bolsas que já usam acerto_id TEXT.

CREATE TABLE IF NOT EXISTS acertos (
  id              TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  campo           TEXT NOT NULL DEFAULT '',
  tipo_campanha   TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'Criado'
                  CHECK (status IN ('Criado', 'Em Aberto', 'Encerrado')),
  data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_encerramento TIMESTAMPTZ,
  lote_aasi       INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Estado do acerto (dados importados + configuração) ──────────────────────

CREATE TABLE IF NOT EXISTS acerto_state (
  acerto_id         TEXT PRIMARY KEY REFERENCES acertos(id) ON DELETE CASCADE,
  dados_importados  JSONB,         -- DadosImportados | null
  config            JSONB NOT NULL DEFAULT '{}',  -- ConfigCampanha
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Lançamentos contábeis ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS acerto_lancamentos (
  id                  TEXT PRIMARY KEY,
  acerto_id           TEXT NOT NULL REFERENCES acertos(id) ON DELETE CASCADE,
  tipo_lancamento_id  TEXT NOT NULL DEFAULT '',
  historico           TEXT NOT NULL DEFAULT '',
  valor               NUMERIC,
  saldo_manual        NUMERIC,
  posicao             INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acerto_lancamentos_acerto
  ON acerto_lancamentos(acerto_id, posicao);

-- ─── Carta de bolsa e juros (por acerto) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS acerto_lider (
  acerto_id       TEXT PRIMARY KEY REFERENCES acertos(id) ON DELETE CASCADE,
  carta_bolsa     JSONB NOT NULL DEFAULT '{"valor":0,"liderReceptor":""}',
  juros_campanha  NUMERIC,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Débitos (devedores, gastos líderes, gastos caixa) ──────────────────────

CREATE TABLE IF NOT EXISTS acerto_debitos (
  acerto_id       TEXT PRIMARY KEY REFERENCES acertos(id) ON DELETE CASCADE,
  devedores       JSONB NOT NULL DEFAULT '[]',
  gastos_lideres  JSONB NOT NULL DEFAULT '[]',
  gastos_caixa    JSONB NOT NULL DEFAULT '{"gastos":0,"debitosAdicionais":[]}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Configuração global (tipos de lançamento, campos, líderes) ─────────────
-- Linha única (id=1). Todos os usuários compartilham a mesma configuração.

CREATE TABLE IF NOT EXISTS config_global (
  id      INTEGER PRIMARY KEY DEFAULT 1,
  tipos   JSONB NOT NULL DEFAULT '[]',
  campos  JSONB NOT NULL DEFAULT '[]',
  lideres JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT config_global_single_row CHECK (id = 1)
);

-- Garante que sempre existe a linha padrão
INSERT INTO config_global (id, tipos, campos, lideres)
VALUES (1, '[]', '[]', '[]')
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE acertos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE acerto_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE acerto_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acerto_lider      ENABLE ROW LEVEL SECURITY;
ALTER TABLE acerto_debitos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_global     ENABLE ROW LEVEL SECURITY;

-- Acesso total a usuários autenticados (dados compartilhados entre todos)
CREATE POLICY "autenticados_acertos"
  ON acertos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "autenticados_acerto_state"
  ON acerto_state FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "autenticados_acerto_lancamentos"
  ON acerto_lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "autenticados_acerto_lider"
  ON acerto_lider FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "autenticados_acerto_debitos"
  ON acerto_debitos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "autenticados_config_global"
  ON config_global FOR ALL TO authenticated USING (true) WITH CHECK (true);
