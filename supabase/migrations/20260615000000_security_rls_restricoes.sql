-- ─── Funções auxiliares ───────────────────────────────────────────────────────
-- SECURITY DEFINER: executam como o dono da função (ignora RLS internamente),
-- evitando recursão ao consultar `profiles` dentro de outras policies.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION my_campo()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT campo FROM profiles WHERE id = auth.uid();
$$;

-- ─── 1. profiles ──────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select"   ON profiles;
DROP POLICY IF EXISTS "profiles_insert"   ON profiles;
DROP POLICY IF EXISTS "profiles_update"   ON profiles;
DROP POLICY IF EXISTS "profiles_delete"   ON profiles;
-- nomes comuns gerados pelo dashboard do Supabase:
DROP POLICY IF EXISTS "Users can view their own profile."      ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users"       ON profiles;

-- Leitura: cada usuário vê só o próprio perfil; admins veem todos
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin());

-- Inserção: usuário cria apenas o próprio perfil (trigger de sign-up)
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Atualização: somente admin altera role/campo de qualquer perfil
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE TO authenticated
  USING     (is_admin())
  WITH CHECK (is_admin());

-- ─── 2. acertos — restrito por campo ─────────────────────────────────────────

DROP POLICY IF EXISTS "autenticados_acertos" ON acertos;

CREATE POLICY "acertos_por_campo"
  ON acertos FOR ALL TO authenticated
  USING     (is_admin() OR campo = my_campo())
  WITH CHECK (is_admin() OR campo = my_campo());

-- ─── 3. Tabelas filhas — filtro via JOIN em acertos ──────────────────────────

DROP POLICY IF EXISTS "autenticados_acerto_state" ON acerto_state;

CREATE POLICY "acerto_state_por_campo"
  ON acerto_state FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_state.acerto_id AND a.campo = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_state.acerto_id AND a.campo = my_campo()
  ));

DROP POLICY IF EXISTS "autenticados_acerto_lancamentos" ON acerto_lancamentos;

CREATE POLICY "acerto_lancamentos_por_campo"
  ON acerto_lancamentos FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_lancamentos.acerto_id AND a.campo = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_lancamentos.acerto_id AND a.campo = my_campo()
  ));

DROP POLICY IF EXISTS "autenticados_acerto_lider" ON acerto_lider;

CREATE POLICY "acerto_lider_por_campo"
  ON acerto_lider FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_lider.acerto_id AND a.campo = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_lider.acerto_id AND a.campo = my_campo()
  ));

DROP POLICY IF EXISTS "autenticados_acerto_debitos" ON acerto_debitos;

CREATE POLICY "acerto_debitos_por_campo"
  ON acerto_debitos FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_debitos.acerto_id AND a.campo = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_debitos.acerto_id AND a.campo = my_campo()
  ));

DROP POLICY IF EXISTS "Authenticated full access on acerto_bolsas" ON acerto_bolsas;

CREATE POLICY "acerto_bolsas_por_campo"
  ON acerto_bolsas FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_bolsas.acerto_id AND a.campo = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_bolsas.acerto_id AND a.campo = my_campo()
  ));

DROP POLICY IF EXISTS "Authenticated full access on acerto_anexos" ON acerto_anexos;

CREATE POLICY "acerto_anexos_por_campo"
  ON acerto_anexos FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_anexos.acerto_id AND a.campo = my_campo()
  ))
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM acertos a
    WHERE a.id = acerto_anexos.acerto_id AND a.campo = my_campo()
  ));

-- ─── 4. config_global — leitura pública, escrita apenas admin ────────────────

DROP POLICY IF EXISTS "autenticados_config_global" ON config_global;

-- Todos autenticados leem (configuração compartilhada)
CREATE POLICY "config_global_select"
  ON config_global FOR SELECT TO authenticated
  USING (true);

-- Só admin modifica (UPDATE único permitido pelo app — tabela tem 1 linha fixa)
CREATE POLICY "config_global_update"
  ON config_global FOR UPDATE TO authenticated
  USING     (is_admin())
  WITH CHECK (is_admin());
