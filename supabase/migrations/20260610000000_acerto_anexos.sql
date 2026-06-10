-- Módulo de escalas: tabela de anexos XLSX por acerto
-- Execute no Supabase SQL Editor ou via supabase db push

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS acerto_anexos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL,
  acerto_id   TEXT        NOT NULL,
  file_url    TEXT        NOT NULL,
  tamanho     INTEGER     NOT NULL,
  data_upload TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- 2. Índice para listagem por acerto (sem registros deletados)
CREATE INDEX IF NOT EXISTS idx_acerto_anexos_acerto_id
  ON acerto_anexos (acerto_id)
  WHERE deleted_at IS NULL;

-- 3. RLS — usuários autenticados têm acesso total
ALTER TABLE acerto_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on acerto_anexos"
  ON acerto_anexos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Storage ────────────────────────────────────────────────────────────────
-- Crie manualmente no Supabase Dashboard > Storage:
--   Bucket name : acerto-anexos
--   Public      : true (marcar como público)
--
-- Ou via SQL (pode exigir extensão storage habilitada):
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('acerto-anexos', 'acerto-anexos', true)
--   ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Authenticated upload"
--   ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'acerto-anexos');
--
-- CREATE POLICY "Public read"
--   ON storage.objects FOR SELECT TO public
--   USING (bucket_id = 'acerto-anexos');
--
-- CREATE POLICY "Owner delete"
--   ON storage.objects FOR DELETE TO authenticated
--   USING (bucket_id = 'acerto-anexos');
