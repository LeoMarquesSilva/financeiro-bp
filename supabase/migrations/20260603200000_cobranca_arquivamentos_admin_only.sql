-- Apenas administradores podem arquivar/desarquivar títulos do painel de cobrança.

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND tm.role = 'admin'
      AND coalesce(tm.is_active, true) = true
  );
$$;

COMMENT ON FUNCTION public.current_user_is_admin() IS
  'True se o usuário autenticado (JWT email) é admin ativo em team_members.';

DROP POLICY IF EXISTS cobranca_arquivamentos_all_authenticated ON cobranca_arquivamentos;

DROP POLICY IF EXISTS cobranca_arquivamentos_select_authenticated ON cobranca_arquivamentos;
CREATE POLICY cobranca_arquivamentos_select_authenticated
  ON cobranca_arquivamentos FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS cobranca_arquivamentos_insert_admin ON cobranca_arquivamentos;
CREATE POLICY cobranca_arquivamentos_insert_admin
  ON cobranca_arquivamentos FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS cobranca_arquivamentos_delete_admin ON cobranca_arquivamentos;
CREATE POLICY cobranca_arquivamentos_delete_admin
  ON cobranca_arquivamentos FOR DELETE TO authenticated
  USING (public.current_user_is_admin());
