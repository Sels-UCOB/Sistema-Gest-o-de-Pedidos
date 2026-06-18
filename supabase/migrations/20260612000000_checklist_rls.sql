-- Habilita RLS na tabela acerto_checklist (criada sem RLS na migration anterior)
ALTER TABLE acerto_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados_acerto_checklist"
  ON acerto_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);
