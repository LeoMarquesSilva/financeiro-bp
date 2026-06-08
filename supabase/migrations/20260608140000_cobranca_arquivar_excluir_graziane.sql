-- Graziane (financeiro) não pode arquivar títulos; demais financeiros e admins sim.

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
      AND coalesce(tm.is_active, true) = true
      AND (
        tm.role = 'admin'
        OR (
          tm.role = 'financeiro'
          AND lower(tm.email) <> 'graziane.brito@bismarchipires.com.br'
        )
      )
  );
$$;

COMMENT ON FUNCTION public.current_user_can_arquivar_cobranca() IS
  'Admin e financeiro ativos podem arquivar, exceto graziane.brito@bismarchipires.com.br.';
