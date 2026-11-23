-- Exclusão de títulos: libera também para todos os admins ativos.
-- Continua valendo a lista por pessoa (financeiro_exclusao_autorizados), para a
-- responsável do Financeiro manter o acesso mesmo se um dia mudar de perfil.

CREATE OR REPLACE FUNCTION public.current_user_pode_excluir_titulos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND coalesce(tm.is_active, true) = true
      AND (
        tm.role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.financeiro_exclusao_autorizados a
          WHERE a.team_member_id = tm.id
        )
      )
  );
$$;

COMMENT ON FUNCTION public.current_user_pode_excluir_titulos() IS
  'True se o usuário logado é admin ativo ou está em financeiro_exclusao_autorizados.';

REVOKE ALL ON FUNCTION public.current_user_pode_excluir_titulos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_pode_excluir_titulos() TO authenticated;
