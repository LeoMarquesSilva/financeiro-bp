-- Timestamp da última carga VIOS usada pelo módulo Receita (parcelas + itens).

CREATE OR REPLACE FUNCTION public.receita_ultima_atualizacao()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    GREATEST(
      COALESCE((SELECT MAX(updated_at) FROM financeiro_parcelas), '-infinity'::timestamptz),
      COALESCE((SELECT MAX(updated_at) FROM financeiro_parcelas_itens), '-infinity'::timestamptz)
    ),
    '-infinity'::timestamptz
  );
$$;

COMMENT ON FUNCTION public.receita_ultima_atualizacao() IS
  'Última atualização dos dados financeiros VIOS (parcelas e itens) para o painel Receita.';

GRANT EXECUTE ON FUNCTION public.receita_ultima_atualizacao() TO anon, authenticated;
