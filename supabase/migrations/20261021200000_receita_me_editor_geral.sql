-- Melhor estimativa: a Controladoria usa perfil financeiro e precisa editar todas as
-- áreas. Quem é responsável de alguma área (ex.: Wagner, financeiro e gerente de
-- Contratos) continua restrito às próprias áreas.

/** Edita todas as áreas: admin ativo, ou financeiro ativo que não é responsável de área. */
CREATE OR REPLACE FUNCTION public.receita_me_editor_geral()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_admin()
    OR (
      EXISTS (
        SELECT 1
        FROM team_members tm
        WHERE lower(tm.email) = public.receita_me_usuario_email()
          AND tm.role = 'financeiro'
          AND coalesce(tm.is_active, true) = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM receita_me_responsaveis r
        WHERE r.ativo
          AND public.receita_me_email_local(r.email)
            = public.receita_me_email_local(public.receita_me_usuario_email())
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.receita_me_editor_geral() TO authenticated;

CREATE OR REPLACE FUNCTION public.receita_me_pode_editar(p_area_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.receita_me_editor_geral()
    OR (
      public.receita_me_email_local(public.receita_me_usuario_email()) <> ''
      AND EXISTS (
        SELECT 1
        FROM receita_me_responsaveis r
        WHERE r.ativo
          AND r.area_key = p_area_key
          AND public.receita_me_email_local(r.email)
            = public.receita_me_email_local(public.receita_me_usuario_email())
      )
    );
$$;

-- Responsáveis: quem edita todas as áreas também cadastra os responsáveis.
DROP POLICY IF EXISTS receita_me_responsaveis_insert_admin ON public.receita_me_responsaveis;
DROP POLICY IF EXISTS receita_me_responsaveis_update_admin ON public.receita_me_responsaveis;
DROP POLICY IF EXISTS receita_me_responsaveis_delete_admin ON public.receita_me_responsaveis;

CREATE POLICY receita_me_responsaveis_insert_editor
  ON public.receita_me_responsaveis FOR INSERT TO authenticated
  WITH CHECK (public.receita_me_editor_geral());
CREATE POLICY receita_me_responsaveis_update_editor
  ON public.receita_me_responsaveis FOR UPDATE TO authenticated
  USING (public.receita_me_editor_geral())
  WITH CHECK (public.receita_me_editor_geral());
CREATE POLICY receita_me_responsaveis_delete_editor
  ON public.receita_me_responsaveis FOR DELETE TO authenticated
  USING (public.receita_me_editor_geral());
