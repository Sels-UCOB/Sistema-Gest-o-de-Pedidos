-- Adiciona campo_regiao a acertos para que a RLS possa comparar com profiles.campo
-- (que armazena 'GO'/'MT'/'MS'), já que acertos.campo armazena nomes de associações
-- ('AOM', 'ALM', 'ASM', 'ABC', etc.) que são incompatíveis com a coluna profiles.campo.

ALTER TABLE acertos
  ADD COLUMN IF NOT EXISTS campo_regiao TEXT NOT NULL DEFAULT 'GO';

-- Backfill: deriva a região a partir do nome da associação
UPDATE acertos SET campo_regiao = CASE
  WHEN campo IN ('ALM', 'AOM') THEN 'MT'
  WHEN campo IN ('ASM')        THEN 'MS'
  ELSE 'GO'
END;

-- ─── RLS: acertos ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "acertos_por_campo" ON acertos;

CREATE POLICY "acertos_por_campo"
  ON acertos FOR ALL TO authenticated
  USING     (is_admin() OR campo_regiao = my_campo())
  WITH CHECK (is_admin() OR campo_regiao = my_campo());

-- ─── RLS: tabelas filhas — usa campo_regiao via JOIN em acertos ───────────────

DROP POLICY IF EXISTS "acerto_state_por_campo" ON acerto_state;
CREATE POLICY "acerto_state_por_campo"
  ON acerto_state FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_state.acerto_id AND a.campo_regiao = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_state.acerto_id AND a.campo_regiao = my_campo()
  ));

DROP POLICY IF EXISTS "acerto_lancamentos_por_campo" ON acerto_lancamentos;
CREATE POLICY "acerto_lancamentos_por_campo"
  ON acerto_lancamentos FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_lancamentos.acerto_id AND a.campo_regiao = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_lancamentos.acerto_id AND a.campo_regiao = my_campo()
  ));

DROP POLICY IF EXISTS "acerto_lider_por_campo" ON acerto_lider;
CREATE POLICY "acerto_lider_por_campo"
  ON acerto_lider FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_lider.acerto_id AND a.campo_regiao = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_lider.acerto_id AND a.campo_regiao = my_campo()
  ));

DROP POLICY IF EXISTS "acerto_debitos_por_campo" ON acerto_debitos;
CREATE POLICY "acerto_debitos_por_campo"
  ON acerto_debitos FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_debitos.acerto_id AND a.campo_regiao = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_debitos.acerto_id AND a.campo_regiao = my_campo()
  ));

DROP POLICY IF EXISTS "acerto_bolsas_por_campo" ON acerto_bolsas;
CREATE POLICY "acerto_bolsas_por_campo"
  ON acerto_bolsas FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_bolsas.acerto_id AND a.campo_regiao = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_bolsas.acerto_id AND a.campo_regiao = my_campo()
  ));

DROP POLICY IF EXISTS "acerto_anexos_por_campo" ON acerto_anexos;
CREATE POLICY "acerto_anexos_por_campo"
  ON acerto_anexos FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_anexos.acerto_id AND a.campo_regiao = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_anexos.acerto_id AND a.campo_regiao = my_campo()
  ));

-- ─── RLS: acerto_checklist — substituí a policy aberta por restrição de campo ─

DROP POLICY IF EXISTS "autenticados_acerto_checklist" ON acerto_checklist;
CREATE POLICY "acerto_checklist_por_campo"
  ON acerto_checklist FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_checklist.acerto_id AND a.campo_regiao = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_checklist.acerto_id AND a.campo_regiao = my_campo()
  ));
