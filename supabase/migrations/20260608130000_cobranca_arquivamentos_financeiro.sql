-- Admin e financeiro podem arquivar/desarquivar títulos do painel de cobrança.

CREATE OR REPLACE FUNCTION public.current_user_can_arquivar_cobranca()
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
      AND tm.role IN ('admin', 'financeiro')
      AND coalesce(tm.is_active, true) = true
  );
$$;

COMMENT ON FUNCTION public.current_user_can_arquivar_cobranca() IS
  'True se o usuário autenticado é admin ou financeiro ativo em team_members.';

DROP POLICY IF EXISTS cobranca_arquivamentos_insert_admin ON cobranca_arquivamentos;
CREATE POLICY cobranca_arquivamentos_insert_financeiro
  ON cobranca_arquivamentos FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_arquivar_cobranca());

DROP POLICY IF EXISTS cobranca_arquivamentos_delete_admin ON cobranca_arquivamentos;
CREATE POLICY cobranca_arquivamentos_delete_financeiro
  ON cobranca_arquivamentos FOR DELETE TO authenticated
  USING (public.current_user_can_arquivar_cobranca());
