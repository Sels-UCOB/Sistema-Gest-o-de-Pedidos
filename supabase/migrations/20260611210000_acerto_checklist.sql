-- Checklist obrigatório antes do encerramento de um acerto
CREATE TABLE IF NOT EXISTS acerto_checklist (
  acerto_id      TEXT NOT NULL REFERENCES acertos(id) ON DELETE CASCADE,
  item_key       TEXT NOT NULL,
  descricao      TEXT NOT NULL,
  marcado        BOOLEAN NOT NULL DEFAULT FALSE,
  data_marcacao  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (acerto_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_acerto_checklist_acerto_id ON acerto_checklist(acerto_id);
