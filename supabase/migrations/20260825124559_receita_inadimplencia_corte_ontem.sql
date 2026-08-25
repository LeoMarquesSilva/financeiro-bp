-- Vencimento de hoje ainda não é inadimplente. Corte = min(último dia do mês, ontem no fuso de SP).

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_corte_vencimento(p_ano integer, p_mes integer)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT LEAST(
    (date_trunc('month', make_date(p_ano, GREATEST(1, LEAST(p_mes, 12)), 1)) + interval '1 month - 1 day')::date,
    ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date - 1)
  );
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_corte_vencimento(integer, integer) IS
  'Data limite de vencimento para inadimplência: min(último dia do mês, ontem). Vencimento = hoje não entra.';
