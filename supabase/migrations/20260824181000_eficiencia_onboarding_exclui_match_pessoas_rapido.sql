-- Match razão→grupo via pessoas só se o grupo/prefixo não casar (COALESCE short-circuit).

CREATE OR REPLACE FUNCTION public.eficiencia_onboarding_exclui(p_grupo text, p_data date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_data IS NULL OR public.eficiencia_onboarding_grupo_chave(p_grupo) = '' THEN false
    ELSE COALESCE(
      (
        SELECT true
        FROM public.eficiencia_onboarding_exclusoes e
        WHERE p_data BETWEEN e.vigencia_inicio AND e.vigencia_fim
          AND (
            public.eficiencia_onboarding_grupo_chave(e.grupo_cliente)
              = public.eficiencia_onboarding_grupo_chave(p_grupo)
            OR public.eficiencia_onboarding_grupo_chave(p_grupo)
              LIKE public.eficiencia_onboarding_grupo_chave(e.grupo_cliente) || ' %'
            OR public.eficiencia_onboarding_grupo_chave(e.grupo_cliente)
              LIKE public.eficiencia_onboarding_grupo_chave(p_grupo) || ' %'
          )
        LIMIT 1
      ),
      (
        SELECT true
        FROM public.eficiencia_onboarding_exclusoes e
        JOIN public.pessoas p ON p.grupo_cliente = e.grupo_cliente
        WHERE p_data BETWEEN e.vigencia_inicio AND e.vigencia_fim
          AND public.eficiencia_onboarding_grupo_chave(p.nome)
            = public.eficiencia_onboarding_grupo_chave(p_grupo)
        LIMIT 1
      ),
      false
    )
  END;
$$;
